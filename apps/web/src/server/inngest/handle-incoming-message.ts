import "server-only";
import { db } from "@rudd/db";
import {
  agentSettings,
  contacts,
  conversations,
  messages,
  tenants,
  waAccounts,
  webhookEvents,
} from "@rudd/db";
import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { runAssistant } from "../agent/runner";
import { sendWhatsAppMessage } from "../whatsapp/client";
import { decrypt } from "../crypto";

export type IncomingMessageEventData = {
  phoneNumberId: string;
  waMessageId: string;
  from: string;
  contactName: string | undefined;
  body: string;
  timestamp: string;
};

export const handleIncomingMessage = inngest.createFunction(
  {
    id: "handle-incoming-message",
    triggers: [{ event: "wa/message.received" }],
    retries: 3,
    concurrency: { limit: 1, key: "event.data.from" },
  },
  async ({ event, step }) => {
    const {
      phoneNumberId,
      waMessageId,
      from,
      contactName,
      body,
    } = event.data as IncomingMessageEventData;

    // ── Step 1: resolve tenant + upsert contact/conversation + persist inbound ──
    // Merged into one step to minimise Inngest round-trips and DB cold-start cost.
    const ctx = await step.run("setup", async () => {
      const [waAccount] = await db
        .select({
          tenantId: waAccounts.tenantId,
          encryptedAccessToken: waAccounts.encryptedAccessToken,
          businessName: agentSettings.businessName,
          systemPrompt: agentSettings.systemPromptOverride,
          services: agentSettings.services,
          workingHours: agentSettings.workingHours,
          timezone: agentSettings.timezone,
        })
        .from(waAccounts)
        .innerJoin(tenants, eq(waAccounts.tenantId, tenants.id))
        .leftJoin(agentSettings, eq(agentSettings.tenantId, tenants.id))
        .where(eq(waAccounts.phoneNumberId, phoneNumberId))
        .limit(1);

      if (!waAccount) throw new Error(`No tenant found for phoneNumberId=${phoneNumberId}`);

      const [contactRow] = await db
        .insert(contacts)
        .values({ tenantId: waAccount.tenantId, waId: from, name: contactName })
        .onConflictDoUpdate({
          target: [contacts.tenantId, contacts.waId],
          set: { name: contactName ?? contacts.name },
        })
        .returning({ id: contacts.id });
      if (!contactRow) throw new Error("Failed to upsert contact");

      const [convRow] = await db
        .insert(conversations)
        .values({ tenantId: waAccount.tenantId, contactId: contactRow.id, lastMessageAt: new Date() })
        .onConflictDoUpdate({
          target: [conversations.tenantId, conversations.contactId],
          set: { lastMessageAt: new Date() },
        })
        .returning({ id: conversations.id });
      if (!convRow) throw new Error("Failed to upsert conversation");

      await db
        .insert(messages)
        .values({
          tenantId: waAccount.tenantId,
          conversationId: convRow.id,
          waMessageId,
          direction: "inbound",
          role: "user",
          body,
        })
        .onConflictDoNothing({ target: messages.waMessageId });

      return {
        tenantId: waAccount.tenantId,
        contactId: contactRow.id,
        conversationId: convRow.id,
        encryptedAccessToken: waAccount.encryptedAccessToken,
        businessName: waAccount.businessName,
        systemPrompt: waAccount.systemPrompt,
        services: waAccount.services,
        workingHours: waAccount.workingHours,
        timezone: waAccount.timezone,
      };
    });

    // ── Step 2: run AI assistant ────────────────────────────────────────────
    const reply = await step.run("run-assistant", () =>
      runAssistant({
        tenantId: ctx.tenantId,
        conversationId: ctx.conversationId,
        contactId: ctx.contactId,
        userMessage: body,
        context: {
          businessName: ctx.businessName ?? "this business",
          services: ctx.services ?? [],
          workingHours: ctx.workingHours,
          timezone: ctx.timezone ?? "UTC",
          systemPrompt: ctx.systemPrompt ?? undefined,
        },
      }),
    );

    // ── Step 3: send reply + persist outbound (WA send + DB writes in parallel) ──
    await step.run("send-and-persist", async () => {
      const accessToken = await decrypt(ctx.encryptedAccessToken);
      const now = new Date();

      await Promise.all([
        sendWhatsAppMessage({ to: from, body: reply, phoneNumberId, accessToken }),
        db.insert(messages).values({
          tenantId: ctx.tenantId,
          conversationId: ctx.conversationId,
          direction: "outbound",
          role: "assistant",
          body: reply,
        }),
        db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, ctx.conversationId)),
        db.update(webhookEvents).set({ processedAt: now }).where(eq(webhookEvents.waMessageId, waMessageId)),
      ]);
    });

    return { ok: true, reply };
  },
);
