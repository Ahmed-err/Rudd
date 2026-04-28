import "server-only";
import { db, contacts, conversations } from "@rudd/db";
import { eq, desc, count, sql } from "drizzle-orm";

export const CONTACTS_PAGE_SIZE = 25;

export type ContactRow = {
  id: string;
  waId: string;
  name: string | null;
  email: string | null;
  leadStatus: string;
  conversationCount: number;
  lastSeen: Date | null;
};

export const listContacts = async (tenantId: string, page = 0): Promise<ContactRow[]> => {
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
    .orderBy(desc(sql`max(${conversations.lastMessageAt})`))
    .limit(CONTACTS_PAGE_SIZE)
    .offset(page * CONTACTS_PAGE_SIZE);

  return rows;
};

export const countContacts = async (tenantId: string): Promise<number> => {
  const [row] = await db
    .select({ count: count() })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId));
  return row?.count ?? 0;
};
