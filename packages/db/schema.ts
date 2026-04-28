import { pgTable, text, timestamp, uuid, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";

// ── Tenants (mirrors Clerk Organizations) ─────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: varchar("clerk_org_id", { length: 256 }).notNull().unique(),
  name: text("name").notNull(),
  plan: varchar("plan", { length: 64 }).notNull().default("free"),
  openaiAssistantId: text("openai_assistant_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── WhatsApp Accounts ──────────────────────────────────────────────────────────
export const waAccounts = pgTable("wa_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  phoneNumberId: text("phone_number_id").notNull(),
  businessAccountId: text("business_account_id").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Google Accounts ────────────────────────────────────────────────────────────
export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Agent Settings ─────────────────────────────────────────────────────────────
export const agentSettings = pgTable("agent_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  businessName: text("business_name").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  workingHours: jsonb("working_hours").notNull().default({}),
  services: jsonb("services").notNull().default([]),
  systemPromptOverride: text("system_prompt_override"),
  notificationEmail: text("notification_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Contacts ───────────────────────────────────────────────────────────────────
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  waId: varchar("wa_id", { length: 32 }).notNull(), // E.164
  name: text("name"),
  email: text("email"),
  leadStatus: varchar("lead_status", { length: 64 }).notNull().default("new"),
  qualificationData: jsonb("qualification_data").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("contacts_tenant_wa_id_idx").on(t.tenantId, t.waId)]);

// ── Conversations ──────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  assistantThreadId: text("assistant_thread_id"),
  status: varchar("status", { length: 64 }).notNull().default("active"), // active | resolved | escalated
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("conversations_tenant_contact_idx").on(t.tenantId, t.contactId)]);

// ── Messages ───────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  waMessageId: text("wa_message_id").unique(), // null for outbound before delivery
  direction: varchar("direction", { length: 8 }).notNull(), // inbound | outbound
  role: varchar("role", { length: 16 }).notNull(), // user | assistant | tool
  body: text("body"),
  toolCalls: jsonb("tool_calls"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Appointments ───────────────────────────────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  gcalEventId: text("gcal_event_id"),
  serviceId: text("service_id"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: varchar("status", { length: 64 }).notNull().default("scheduled"), // scheduled | completed | cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Raw Webhook Events (for replay / debugging) ────────────────────────────────
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"), // null until we resolve which tenant the event belongs to
  waMessageId: text("wa_message_id").unique(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
