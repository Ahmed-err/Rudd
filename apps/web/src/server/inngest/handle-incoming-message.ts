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
    // Hard cap so a stuck run can't block the per-user concurrency queue forever.
    // 45s covers worst-case: cold Neon (1s) + 3-round LLM (24s) + WA send (8s) + slack.
    timeouts: { finish: "45s" },
  },
  async ({ event, step }) => {
    const {
      phoneNumberId,
      waMessageId,
      from,
      contactName,
      body,
    } = event.data as IncomingMessageEventData;

    // Single step — Inngest step boundaries cost ~500ms each on hobby tier.
    // Trade-off: on transient failure the LLM call is repeated. Acceptable because
    // (a) failures are rare and (b) Meta will redeliver anyway, so a "preserved"
    // LLM result wouldn't help if WA send dies permanently.
    const result = await step.run("process-message", async () => {
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

      // Idempotency: returning is empty when the row already existed → Meta retry, bail.
      const inserted = await db
        .insert(messages)
        .values({
          tenantId: waAccount.tenantId,
          conversationId: convRow.id,
          waMessageId,
          direction: "inbound",
          role: "user",
          body,
        })
        .onConflictDoNothing({ target: messages.waMessageId })
        .returning({ id: messages.id });
      if (!inserted.length) {
        console.log(`[inngest] duplicate webhook for waMessageId=${waMessageId} — skipping`);
        return { ok: true, duplicate: true };
      }

      const reply = await runAssistant({
        tenantId: waAccount.tenantId,
        conversationId: convRow.id,
        contactId: contactRow.id,
        userMessage: body,
        context: {
          businessName: waAccount.businessName ?? "this business",
          services: waAccount.services ?? [],
          workingHours: waAccount.workingHours,
          timezone: waAccount.timezone ?? "UTC",
          systemPrompt: waAccount.systemPrompt ?? undefined,
        },
      });

      const accessToken = await decrypt(waAccount.encryptedAccessToken);
      const now = new Date();

      await Promise.all([
        sendWhatsAppMessage({ to: from, body: reply, phoneNumberId, accessToken }),
        db.insert(messages).values({
          tenantId: waAccount.tenantId,
          conversationId: convRow.id,
          direction: "outbound",
          role: "assistant",
          body: reply,
        }),
        db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, convRow.id)),
        db.update(webhookEvents).set({ processedAt: now, tenantId: waAccount.tenantId }).where(eq(webhookEvents.waMessageId, waMessageId)),
      ]);

      return { ok: true, reply };
    });

    return result;
  },
);
