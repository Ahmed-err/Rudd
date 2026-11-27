"use server";

import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { db, conversations, contacts, messages, waAccounts, withTenant } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decrypt } from "@/server/crypto";
import { isOutsideServiceWindowError, sendWhatsAppMessage } from "@/server/whatsapp/client";

export const sendManualReply = async (conversationId: string, body: string): Promise<void> => {
  z.string().uuid().parse(conversationId);
  const text = z.string().min(1).max(4096).parse(body.trim());

  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);

  const [row] = await db
    .select({ waId: contacts.waId })
    .from(conversations)
    .innerJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)))
    .limit(1);
  if (!row) throw new Error("Conversation not found");

  const [waAcct] = await db
    .select({ phoneNumberId: waAccounts.phoneNumberId, encryptedAccessToken: waAccounts.encryptedAccessToken })
    .from(waAccounts)
    .where(withTenant(tenantId, waAccounts.tenantId))
    .limit(1);
  if (!waAcct) throw new Error(t.conversations.detail.errorWaNotConnected);

  const accessToken = await decrypt(waAcct.encryptedAccessToken);
  let sentId: string | null = null;
  try {
    const sent = await sendWhatsAppMessage({ to: row.waId, body: text, phoneNumberId: waAcct.phoneNumberId, accessToken });
    sentId = sent.messages[0]?.id ?? null;
  } catch (err) {
    if (isOutsideServiceWindowError(err)) throw new Error(t.conversations.detail.errorOutsideWindow);
    throw err;
  }

  await db.insert(messages).values({
    tenantId,
    conversationId,
    waMessageId: sentId,
    direction: "outbound",
    role: "assistant",
    body: text,
  });

  // A human replying takes over the chat so the AI doesn't talk over them.
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), aiPaused: true })
    .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)));

  revalidatePath(`/dashboard/conversations/${conversationId}`);
};
