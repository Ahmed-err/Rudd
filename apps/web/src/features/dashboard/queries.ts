import "server-only";
import { db, appointments, contacts, conversations, messages, agentSettings, withTenant } from "@rudd/db";
import { and, asc, count, desc, eq, gte, or, sql } from "drizzle-orm";
import { parseServices } from "@rudd/shared";

const DAY = 24 * 60 * 60_000;
export const CHART_DAYS = 14;

export type DashboardData = {
  timeZone: string;
  stats: {
    bookings30d: number;
    cancellations30d: number;
    conversations30d: number;
    aiReplies30d: number;
    upcoming: number;
    needsAttention: number;
  };
  bookingsByDay: Array<{ date: string; count: number }>;
  nextAppointments: Array<{
    id: string;
    startAt: Date;
    serviceName: string;
    contactName: string | null;
    contactWaId: string;
  }>;
  attention: Array<{
    id: string;
    status: string;
    aiPaused: boolean;
    contactName: string | null;
    contactWaId: string;
    lastMessageAt: Date | null;
  }>;
};

const localDate = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

export const getDashboardData = async (tenantId: string, now = new Date()): Promise<DashboardData> => {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const sinceChart = new Date(now.getTime() - CHART_DAYS * DAY);
  const attentionWhere = and(
    withTenant(tenantId, conversations.tenantId),
    or(eq(conversations.status, "escalated"), and(eq(conversations.aiPaused, true), sql`${conversations.status} <> 'resolved'`)),
  );

  const [
    [settings],
    [bookings],
    [cancellations],
    [convs],
    [aiReplies],
    [upcoming],
    [attentionCount],
    recentBookings,
    next,
    attention,
  ] = await Promise.all([
    db
      .select({ timezone: agentSettings.timezone, services: agentSettings.services })
      .from(agentSettings)
      .where(withTenant(tenantId, agentSettings.tenantId))
      .limit(1),
    db.select({ n: count() }).from(appointments)
      .where(and(withTenant(tenantId, appointments.tenantId), gte(appointments.createdAt, since30))),
    db.select({ n: count() }).from(appointments)
      .where(and(withTenant(tenantId, appointments.tenantId), eq(appointments.status, "cancelled"), gte(appointments.updatedAt, since30))),
    db.select({ n: count() }).from(conversations)
      .where(and(withTenant(tenantId, conversations.tenantId), gte(conversations.createdAt, since30))),
    db.select({ n: count() }).from(messages)
      .where(and(withTenant(tenantId, messages.tenantId), eq(messages.direction, "outbound"), gte(messages.createdAt, since30))),
    db.select({ n: count() }).from(appointments)
      .where(and(withTenant(tenantId, appointments.tenantId), eq(appointments.status, "scheduled"), gte(appointments.startAt, now))),
    db.select({ n: count() }).from(conversations).where(attentionWhere),
    db.select({ createdAt: appointments.createdAt }).from(appointments)
      .where(and(withTenant(tenantId, appointments.tenantId), gte(appointments.createdAt, sinceChart))),
    db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        serviceId: appointments.serviceId,
        contactName: contacts.name,
        contactWaId: contacts.waId,
      })
      .from(appointments)
      .innerJoin(contacts, eq(contacts.id, appointments.contactId))
      .where(and(withTenant(tenantId, appointments.tenantId), eq(appointments.status, "scheduled"), gte(appointments.startAt, now)))
      .orderBy(asc(appointments.startAt))
      .limit(5),
    db
      .select({
        id: conversations.id,
        status: conversations.status,
        aiPaused: conversations.aiPaused,
        contactName: contacts.name,
        contactWaId: contacts.waId,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(attentionWhere)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(5),
  ]);

  const timeZone = settings?.timezone ?? "UTC";
  const services = parseServices(settings?.services);

  const counts = new Map<string, number>();
  for (const b of recentBookings) {
    const d = localDate(b.createdAt, timeZone);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const bookingsByDay = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = localDate(new Date(now.getTime() - (CHART_DAYS - 1 - i) * DAY), timeZone);
    return { date, count: counts.get(date) ?? 0 };
  });

  return {
    timeZone,
    stats: {
      bookings30d: bookings?.n ?? 0,
      cancellations30d: cancellations?.n ?? 0,
      conversations30d: convs?.n ?? 0,
      aiReplies30d: aiReplies?.n ?? 0,
      upcoming: upcoming?.n ?? 0,
      needsAttention: attentionCount?.n ?? 0,
    },
    bookingsByDay,
    nextAppointments: next.map((a) => ({
      id: a.id,
      startAt: a.startAt,
      serviceName: services.find((s) => s.id === a.serviceId)?.name ?? a.serviceId ?? "Appointment",
      contactName: a.contactName,
      contactWaId: a.contactWaId,
    })),
    attention,
  };
};
