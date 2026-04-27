import "server-only";
import { db, conversations, contacts, messages } from "@rudd/db";
import { eq, desc, and, asc, count } from "drizzle-orm";

export type ConversationRow = {
  id: string;
  status: string;
  lastMessageAt: Date | null;
  contactName: string | null;
  contactWaId: string;
  lastMessage: string | null;
  lastMessageDirection: string | null;
};

export const PAGE_SIZE = 20;

export const listConversations = async (
  tenantId: string,
  status?: string,
  waId?: string,
  page = 0,
): Promise<ConversationRow[]> => {
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (status) conditions.push(eq(conversations.status, status));
  if (waId) conditions.push(eq(contacts.waId, waId));

  const rows = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      contactName: contacts.name,
      contactWaId: contacts.waId,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const withLastMsg = await Promise.all(
    rows.map(async (row) => {
      try {
        const [msg] = await db
          .select({ body: messages.body, direction: messages.direction })
          .from(messages)
          .where(and(eq(messages.conversationId, row.id), eq(messages.tenantId, tenantId)))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        return { ...row, lastMessage: msg?.body ?? null, lastMessageDirection: msg?.direction ?? null };
      } catch {
        return { ...row, lastMessage: null, lastMessageDirection: null };
      }
    }),
  );

  return withLastMsg;
};

export const countConversations = async (
  tenantId: string,
  status?: string,
  waId?: string,
): Promise<number> => {
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (status) conditions.push(eq(conversations.status, status));
  if (waId) conditions.push(eq(contacts.waId, waId));

  const [row] = await db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(...conditions));

  return row?.count ?? 0;
};

export type MessageRow = {
  id: string;
  role: string;
  direction: string;
  body: string | null;
  createdAt: Date;
};

export type ConversationDetail = {
  conversation: {
    id: string;
    status: string;
    contactName: string | null;
    contactWaId: string;
  };
  messages: MessageRow[];
};

export const getConversationDetail = async (
  tenantId: string,
  conversationId: string,
): Promise<ConversationDetail | null> => {
  const [row] = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      contactName: contacts.name,
      contactWaId: contacts.waId,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
    .limit(1);

  if (!row) return null;

  const msgs = await db
    .select({
      id: messages.id,
      role: messages.role,
      direction: messages.direction,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId)))
    .orderBy(asc(messages.createdAt))
    .limit(100);

  return { conversation: row, messages: msgs };
};

