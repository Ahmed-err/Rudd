import "server-only";
import { db, appointments, contacts, conversations, messages, waAccounts, withTenant } from "@rudd/db";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { CalendarNotConnectedError, deleteCalendarEvent, getFreeBusy } from "@/server/calendar/client";
import { decrypt } from "@/server/crypto";
import { sendWhatsAppMessage } from "@/server/whatsapp/client";
import type { Interval } from "@/server/agent/availability";

/** Scheduled DB appointments plus Google Calendar busy blocks overlapping [from, to). */
export const getBusyIntervals = async (tenantId: string, from: Date, to: Date): Promise<Interval[]> => {
  const [booked, calendar] = await Promise.all([
    db
      .select({ start: appointments.startAt, end: appointments.endAt })
      .from(appointments)
      .where(
        and(
          withTenant(tenantId, appointments.tenantId),
          eq(appointments.status, "scheduled"),
          lt(appointments.startAt, to),
          gt(appointments.endAt, from),
        ),
      ),
    getFreeBusy(tenantId, from.toISOString(), to.toISOString()).catch((err: unknown) => {
      if (!(err instanceof CalendarNotConnectedError)) {
        console.warn("[appointments] free/busy lookup failed:", err instanceof Error ? err.message : "unknown");
      }
      return [];
    }),
  ]);

  return [
    ...booked,
    ...calendar.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
  ];
};

export type UpcomingAppointment = { id: string; serviceId: string | null; startAt: Date; endAt: Date };

export const listUpcomingForContact = async (
  tenantId: string,
  contactId: string,
  now = new Date(),
): Promise<UpcomingAppointment[]> =>
  db
    .select({
      id: appointments.id,
      serviceId: appointments.serviceId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .where(
      and(
        withTenant(tenantId, appointments.tenantId),
        eq(appointments.contactId, contactId),
        eq(appointments.status, "scheduled"),
        gt(appointments.startAt, now),
      ),
    )
    .orderBy(appointments.startAt)
    .limit(10);

const ARABIC_RE = /[؀-ۿ]/;

const cancellationNotice = (arabic: boolean, when: string): string =>
  arabic
    ? `تم إلغاء موعدك بتاريخ ${when}. يمكنك الرد على هذه الرسالة لحجز موعد جديد.`
    : `Your appointment on ${when} has been cancelled. Reply to this message if you'd like to book a new time.`;

const notifyCustomerOfCancellation = async (
  tenantId: string,
  contactId: string,
  startAt: Date,
  timeZone: string,
): Promise<void> => {
  const [row] = await db
    .select({
      waId: contacts.waId,
      conversationId: conversations.id,
      phoneNumberId: waAccounts.phoneNumberId,
      encryptedAccessToken: waAccounts.encryptedAccessToken,
    })
    .from(contacts)
    .innerJoin(conversations, eq(conversations.contactId, contacts.id))
    .innerJoin(waAccounts, eq(waAccounts.tenantId, contacts.tenantId))
    .where(and(withTenant(tenantId, contacts.tenantId), eq(contacts.id, contactId)))
    .limit(1);
  if (!row) return;

  const [lastInbound] = await db
    .select({ body: messages.body })
    .from(messages)
    .where(
      and(
        withTenant(tenantId, messages.tenantId),
        eq(messages.conversationId, row.conversationId),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const arabic = ARABIC_RE.test(lastInbound?.body ?? "");
  const when = new Intl.DateTimeFormat(arabic ? "ar-EG" : "en-GB", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startAt);
  const body = cancellationNotice(arabic, when);

  const accessToken = await decrypt(row.encryptedAccessToken);
  const sent = await sendWhatsAppMessage({ to: row.waId, body, phoneNumberId: row.phoneNumberId, accessToken });

  await db.insert(messages).values({
    tenantId,
    conversationId: row.conversationId,
    waMessageId: sent.messages[0]?.id ?? null,
    direction: "outbound",
    role: "assistant",
    body,
  });
};

type CancelOptions = {
  /** Restrict to this contact's appointments (used by the agent so customers can't cancel others'). */
  contactId?: string;
  /** Send the customer a WhatsApp notice (dashboard cancellations). */
  notify?: { timeZone: string };
};

export const cancelAppointmentForTenant = async (
  tenantId: string,
  appointmentId: string,
  options: CancelOptions = {},
): Promise<{ cancelled: boolean; notified: boolean }> => {
  const conditions = [
    withTenant(tenantId, appointments.tenantId),
    eq(appointments.id, appointmentId),
    eq(appointments.status, "scheduled"),
  ];
  if (options.contactId) conditions.push(eq(appointments.contactId, options.contactId));

  const [appt] = await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(...conditions))
    .returning({
      contactId: appointments.contactId,
      startAt: appointments.startAt,
      gcalEventId: appointments.gcalEventId,
    });
  if (!appt) return { cancelled: false, notified: false };

  if (appt.gcalEventId) {
    await deleteCalendarEvent(tenantId, appt.gcalEventId).catch((err: unknown) => {
      console.warn("[appointments] calendar delete failed:", err instanceof Error ? err.message : "unknown");
    });
  }

  let notified = false;
  if (options.notify) {
    try {
      await notifyCustomerOfCancellation(tenantId, appt.contactId, appt.startAt, options.notify.timeZone);
      notified = true;
    } catch (err) {
      // Typically the 24h customer-service window has closed; the owner is told via the return value.
      console.warn("[appointments] customer notice failed:", err instanceof Error ? err.message : "unknown");
    }
  }

  return { cancelled: true, notified };
};
