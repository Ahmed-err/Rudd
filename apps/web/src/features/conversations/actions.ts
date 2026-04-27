"use server";

import { getSessionTenant } from "@/lib/session";
import { db, conversations, contacts, tenants, agentSettings } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEscalationEmail } from "@/server/notifications";

const statusSchema = z.enum(["active", "resolved", "escalated"]);

export const setConversationStatus = async (
  conversationId: string,
  status: z.infer<typeof statusSchema>,
): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  statusSchema.parse(status);

  await db
    .update(conversations)
    .set({ status })
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

  if (status === "escalated") {
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
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (row) {
      await sendEscalationEmail({
        contactName: row.contactName,
        contactWaId: row.contactWaId,
        conversationId,
        tenantName: row.tenantName,
        notificationEmail: row.notificationEmail,
      });
    }
  }

  revalidatePath(`/dashboard/conversations/${conversationId}`);
  revalidatePath("/dashboard/conversations");
};
