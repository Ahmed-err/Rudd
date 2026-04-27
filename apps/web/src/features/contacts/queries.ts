import "server-only";
import { db, contacts, conversations } from "@rudd/db";
import { eq, desc, count, sql } from "drizzle-orm";

export type ContactRow = {
  id: string;
  waId: string;
  name: string | null;
  email: string | null;
  leadStatus: string;
  conversationCount: number;
  lastSeen: Date | null;
};

export const listContacts = async (tenantId: string): Promise<ContactRow[]> => {
  const rows = await db
    .select({
      id: contacts.id,
      waId: contacts.waId,
      name: contacts.name,
      email: contacts.email,
      leadStatus: contacts.leadStatus,
      conversationCount: count(conversations.id),
      lastSeen: sql<Date | null>`max(${conversations.lastMessageAt})`,
    })
    .from(contacts)
    .leftJoin(conversations, eq(conversations.contactId, contacts.id))
    .where(eq(contacts.tenantId, tenantId))
    .groupBy(contacts.id)
    .orderBy(desc(sql`max(${conversations.lastMessageAt})`));

  return rows;
};
