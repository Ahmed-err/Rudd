import "server-only";
import { db, conversations, contacts, messages, withTenant } from "@rudd/db";
import { eq, and, desc, count, sql } from "drizzle-orm";

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
const MESSAGE_LIMIT = 200;

const lastMessageQuery = (column: "body" | "direction") =>
  sql<string | null>`(
    select ${sql.raw(`m.${column}`)} from ${messages} m
    where m.conversation_id = ${conversations.id} and m.tenant_id = ${conversations.tenantId}
    order by m.created_at desc limit 1
  )`;

export const listConversations = async (
  tenantId: string,
  status?: string,
  waId?: string,
  page = 0,
): Promise<ConversationRow[]> => {
  const conditions = [withTenant(tenantId, conversations.tenantId)];
  if (status) conditions.push(eq(conversations.status, status));
  if (waId) conditions.push(eq(contacts.waId, waId));

  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      contactName: contacts.name,
      contactWaId: contacts.waId,
      lastMessage: lastMessageQuery("body"),
      lastMessageDirection: lastMessageQuery("direction"),
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(sql`${conversations.lastMessageAt} desc nulls last`)
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);
};

export const countConversations = async (
  tenantId: string,
  status?: string,
  waId?: string,
): Promise<number> => {
  const conditions = [withTenant(tenantId, conversations.tenantId)];
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
    aiPaused: boolean;
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
      aiPaused: conversations.aiPaused,
      contactName: contacts.name,
      contactWaId: contacts.waId,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(withTenant(tenantId, conversations.tenantId), eq(conversations.id, conversationId)))
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
    .where(and(withTenant(tenantId, messages.tenantId), eq(messages.conversationId, conversationId)))
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGE_LIMIT);

  return { conversation: row, messages: msgs.reverse() };
};

