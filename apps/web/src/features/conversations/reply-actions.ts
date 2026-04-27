"use server";

import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { db, conversations, contacts, messages, waAccounts } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decrypt } from "@/server/crypto";
import { sendWhatsAppMessage } from "@/server/whatsapp/client";

export const sendManualReply = async (conversationId: string, body: string): Promise<void> => {
  z.string().uuid().parse(conversationId);
  const text = z.string().min(1).max(4096).parse(body.trim());

  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);

  const [conv] = await db
    .select({ contactId: conversations.contactId })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
    .limit(1);

  if (!conv) throw new Error("Conversation not found");

  const [contact] = await db
    .select({ waId: contacts.waId })
    .from(contacts)
    .where(and(eq(contacts.id, conv.contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  if (!contact) throw new Error("Contact not found");

  const [waAcct] = await db
    .select({ phoneNumberId: waAccounts.phoneNumberId, encryptedAccessToken: waAccounts.encryptedAccessToken })
    .from(waAccounts)
    .where(eq(waAccounts.tenantId, tenantId))
    .limit(1);

  if (!waAcct) throw new Error(t.conversations.detail.errorWaNotConnected);

  const accessToken = await decrypt(waAcct.encryptedAccessToken);
  await sendWhatsAppMessage({ to: contact.waId, body: text, phoneNumberId: waAcct.phoneNumberId, accessToken });

  await db.insert(messages).values({
    tenantId,
    conversationId,
    direction: "outbound",
    role: "assistant",
    body: text,
  });

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  revalidatePath(`/dashboard/conversations/${conversationId}`);
};
