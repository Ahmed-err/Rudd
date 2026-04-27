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
    console.log("[inngest] handle-incoming-message started", event.data);

    const {
      phoneNumberId,
      waMessageId,
      from,
      contactName,
      body,
    } = event.data as IncomingMessageEventData;

    // ── 1. Resolve tenant ───────────────────────────────────────────────────
    const ctx = await step.run("load-context", async () => {
      const [waAccount] = await db
        .select({
          tenantId: waAccounts.tenantId,
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
      return waAccount;
    });

    // ── 2. Upsert contact (atomic — unique index on tenantId+waId) ────────────
    const contactId = await step.run("upsert-contact", async () => {
      const [row] = await db
        .insert(contacts)
        .values({ tenantId: ctx.tenantId, waId: from, name: contactName })
        .onConflictDoUpdate({
          target: [contacts.tenantId, contacts.waId],
          set: { name: contactName ?? contacts.name },
        })
        .returning({ id: contacts.id });
      if (!row) throw new Error("Failed to upsert contact");
      return row.id;
    });

    // ── 3. Upsert conversation (atomic — unique index on tenantId+contactId) ──
    const conversationId = await step.run("upsert-conversation", async () => {
      const [row] = await db
        .insert(conversations)
        .values({ tenantId: ctx.tenantId, contactId, lastMessageAt: new Date() })
        .onConflictDoUpdate({
          target: [conversations.tenantId, conversations.contactId],
          set: { lastMessageAt: new Date() },
        })
        .returning({ id: conversations.id });
      if (!row) throw new Error("Failed to upsert conversation");
      return row.id;
    });

    // ── 4. Persist inbound message (idempotent on waMessageId) ─────────────
    await step.run("persist-inbound", async () => {
      await db
        .insert(messages)
        .values({
          tenantId: ctx.tenantId,
          conversationId,
          waMessageId,
          direction: "inbound",
          role: "user",
          body,
        })
        .onConflictDoNothing({ target: messages.waMessageId });
    });

    // ── 5. Run the assistant ────────────────────────────────────────────────
    const reply = await step.run("run-assistant", () =>
      runAssistant({
        tenantId: ctx.tenantId,
        conversationId,
        contactId,
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

    // ── 6. Send WhatsApp reply ───────────────────────────────────────────────
    await step.run("send-reply", async () => {
      const [waAcct] = await db
        .select({ encryptedAccessToken: waAccounts.encryptedAccessToken })
        .from(waAccounts)
        .where(eq(waAccounts.phoneNumberId, phoneNumberId))
        .limit(1);
      if (!waAcct) throw new Error(`WA account missing for phoneNumberId=${phoneNumberId}`);
      const accessToken = await decrypt(waAcct.encryptedAccessToken);
      return sendWhatsAppMessage({ to: from, body: reply, phoneNumberId, accessToken });
    });

    // ── 7. Persist outbound + update conversation ───────────────────────────
    await step.run("persist-outbound", async () => {
      await db.insert(messages).values({
        tenantId: ctx.tenantId,
        conversationId,
        direction: "outbound",
        role: "assistant",
        body: reply,
      });

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));

      await db
        .update(webhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(webhookEvents.waMessageId, waMessageId));
    });

    return { ok: true, reply };
  },
);
