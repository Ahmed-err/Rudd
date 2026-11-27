import "server-only";
import {
  db,
  agentSettings,
  contacts,
  conversations,
  messages,
  waAccounts,
  webhookEvents,
  withTenant,
} from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { parseServices, parseWorkingHours } from "@rudd/shared";
import { inngest } from "./client";
import { INCOMING_MESSAGE_EVENT, incomingMessageEventSchema } from "./events";
import { runAssistant } from "../agent/runner";
import { transcribeAudio } from "../agent/llm";
import { downloadWhatsAppMedia, sendWhatsAppMessage } from "../whatsapp/client";
import { decrypt } from "../crypto";

const getAccessToken = async (tenantId: string): Promise<string> => {
  const [row] = await db
    .select({ encryptedAccessToken: waAccounts.encryptedAccessToken })
    .from(waAccounts)
    .where(withTenant(tenantId, waAccounts.tenantId))
    .limit(1);
  if (!row) throw new Error("WhatsApp account disconnected");
  return decrypt(row.encryptedAccessToken);
};

const markProcessed = async (tenantId: string, waMessageId: string): Promise<void> => {
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date(), tenantId })
    .where(eq(webhookEvents.waMessageId, waMessageId));
};

// Each external call is its own step: a failure retries only that step, and completed
// steps (including the inbound insert) are memoised, so a retry can never mistake
// its own earlier write for a Meta duplicate and drop the reply.
export const handleIncomingMessage = inngest.createFunction(
  {
    id: "handle-incoming-message",
    triggers: [{ event: INCOMING_MESSAGE_EVENT }],
    retries: 3,
    concurrency: { limit: 1, key: 'event.data.phoneNumberId + "-" + event.data.from' },
    timeouts: { finish: "3m" },
  },
  async ({ event, step }) => {
    const data = incomingMessageEventSchema.parse(event.data);

    const tenant = await step.run("resolve-tenant", async () => {
      const [row] = await db
        .select({
          tenantId: waAccounts.tenantId,
          businessName: agentSettings.businessName,
          systemPrompt: agentSettings.systemPromptOverride,
          services: agentSettings.services,
          workingHours: agentSettings.workingHours,
          timezone: agentSettings.timezone,
        })
        .from(waAccounts)
        .leftJoin(agentSettings, eq(agentSettings.tenantId, waAccounts.tenantId))
        .where(eq(waAccounts.phoneNumberId, data.phoneNumberId))
        .limit(1);
      return row ?? null;
    });

    if (!tenant) {
      console.warn("[inngest] message for an unregistered phone number — ignoring");
      return { ok: false, reason: "unknown_phone_number" };
    }

    let body = data.body;
    if (data.audioMediaId) {
      const mediaId = data.audioMediaId;
      const transcript = await step.run("transcribe-audio", async () => {
        try {
          const { bytes, mimeType } = await downloadWhatsAppMedia(mediaId, await getAccessToken(tenant.tenantId));
          return await transcribeAudio(bytes, mimeType);
        } catch (err) {
          console.warn("[inngest] transcription failed:", err instanceof Error ? err.message : "unknown");
          return "";
        }
      });
      if (transcript) body = `[Voice message] ${transcript}`;
    }

    const persisted = await step.run("persist-inbound", async () => {
      const [contactRow] = await db
        .insert(contacts)
        .values({ tenantId: tenant.tenantId, waId: data.from, name: data.contactName })
        .onConflictDoUpdate({
          target: [contacts.tenantId, contacts.waId],
          set: data.contactName ? { name: data.contactName } : { updatedAt: new Date() },
        })
        .returning({ id: contacts.id });
      if (!contactRow) throw new Error("Failed to upsert contact");

      const now = new Date();
      const [convRow] = await db
        .insert(conversations)
        .values({ tenantId: tenant.tenantId, contactId: contactRow.id, lastMessageAt: now })
        .onConflictDoUpdate({
          target: [conversations.tenantId, conversations.contactId],
          set: { lastMessageAt: now },
        })
        .returning({ id: conversations.id, status: conversations.status, aiPaused: conversations.aiPaused });
      if (!convRow) throw new Error("Failed to upsert conversation");

      // A new message on a resolved conversation reopens it.
      if (convRow.status === "resolved") {
        await db
          .update(conversations)
          .set({ status: "active" })
          .where(and(withTenant(tenant.tenantId, conversations.tenantId), eq(conversations.id, convRow.id)));
      }

      const inserted = await db
        .insert(messages)
        .values({
          tenantId: tenant.tenantId,
          conversationId: convRow.id,
          waMessageId: data.waMessageId,
          direction: "inbound",
          role: "user",
          body,
        })
        .onConflictDoNothing({ target: messages.waMessageId })
        .returning({ id: messages.id });

      return {
        duplicate: inserted.length === 0,
        contactId: contactRow.id,
        conversationId: convRow.id,
        aiPaused: convRow.aiPaused,
      };
    });

    if (persisted.duplicate) return { ok: true, duplicate: true };

    if (persisted.aiPaused) {
      await step.run("mark-processed", () => markProcessed(tenant.tenantId, data.waMessageId));
      return { ok: true, skipped: "ai_paused" };
    }

    const reply = await step.run("generate-reply", () =>
      runAssistant({
        tenantId: tenant.tenantId,
        conversationId: persisted.conversationId,
        contactId: persisted.contactId,
        userMessage: body,
        context: {
          businessName: tenant.businessName ?? "this business",
          services: parseServices(tenant.services),
          workingHours: parseWorkingHours(tenant.workingHours),
          timezone: tenant.timezone ?? "UTC",
          systemPrompt: tenant.systemPrompt ?? undefined,
        },
      }),
    );

    const sentId = await step.run("send-reply", async () => {
      const result = await sendWhatsAppMessage({
        to: data.from,
        body: reply,
        phoneNumberId: data.phoneNumberId,
        accessToken: await getAccessToken(tenant.tenantId),
      });
      return result.messages[0]?.id ?? null;
    });

    await step.run("record-reply", async () => {
      const now = new Date();
      await Promise.all([
        db
          .insert(messages)
          .values({
            tenantId: tenant.tenantId,
            conversationId: persisted.conversationId,
            waMessageId: sentId,
            direction: "outbound",
            role: "assistant",
            body: reply,
          })
          .onConflictDoNothing({ target: messages.waMessageId }),
        db
          .update(conversations)
          .set({ lastMessageAt: now })
          .where(and(withTenant(tenant.tenantId, conversations.tenantId), eq(conversations.id, persisted.conversationId))),
        markProcessed(tenant.tenantId, data.waMessageId),
      ]);
    });

    return { ok: true };
  },
);
