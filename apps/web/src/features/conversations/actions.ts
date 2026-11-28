"use server";

import { getSessionTenant } from "@/lib/session";
import { db, conversations, contacts, tenants, agentSettings, withTenant } from "@rudd/db";
import { conversationStatusSchema, type ConversationStatus } from "@rudd/shared";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEscalationEmail } from "@/server/notifications";

const revalidateConversation = (conversationId: string): void => {
  revalidatePath(`/dashboard/conversations/${conversationId}`);
  revalidatePath("/dashboard/conversations");
};

export const setConversationStatus = async (conversationId: string, status: ConversationStatus): Promise<void> => {
  z.string().uuid().parse(conversationId);
  const parsedStatus = conversationStatusSchema.parse(status);
  const { tenantId } = await getSessionTenant();

  // Escalating hands the chat to a human; reopening or resolving gives it back to the AI.
  const [updated] = await db
    .update(conversations)
    .set({ status: parsedStatus, aiPaused: parsedStatus === "escalated" })
    .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)))
    .returning({ id: conversations.id });
  if (!updated) throw new Error("Conversation not found");

  if (parsedStatus === "escalated") {
    const [row] = await db
      .select({
        contactName: contacts.name,
        contactWaId: contacts.waId,
        tenantName: tenants.name,
        notificationEmail: agentSettings.notificationEmail,
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .innerJoin(tenants, eq(conversations.tenantId, tenants.id))
      .leftJoin(agentSettings, eq(agentSettings.tenantId, tenants.id))
      .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)))
      .limit(1);

    if (row) await sendEscalationEmail({ ...row, conversationId });
  }

  revalidateConversation(conversationId);
};

export const setAiPaused = async (conversationId: string, paused: boolean): Promise<void> => {
  z.string().uuid().parse(conversationId);
  z.boolean().parse(paused);
  const { tenantId } = await getSessionTenant();

  await db
    .update(conversations)
    .set({ aiPaused: paused })
    .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)));

  revalidateConversation(conversationId);
};
