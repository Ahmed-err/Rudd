"use server";

import { getSessionTenant } from "@/lib/session";
import { db, conversations } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  revalidatePath(`/dashboard/conversations/${conversationId}`);
  revalidatePath("/dashboard/conversations");
};
