import "server-only";
import { db, appointments, contacts, conversations, tenants, agentSettings, withTenant } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import type { Service, WorkingHours } from "@rudd/shared";
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  captureLeadSchema,
  escalateToHumanSchema,
  proposeSlotsSchema,
  rescheduleAppointmentSchema,
} from "./tools";
import {
  MAX_RANGE_DAYS,
  addDays,
  formatLocalIso,
  generateSlots,
  isWithinWorkingHours,
  overlaps,
  parseDateTime,
  toLocalParts,
  zonedToUtc,
} from "./availability";
import { cancelAppointmentForTenant, getBusyIntervals } from "@/server/appointments";
import { createCalendarEvent, updateCalendarEvent } from "@/server/calendar/client";
import { sendEscalationEmail } from "@/server/notifications";

export type HandlerContext = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  timeZone: string;
  workingHours: WorkingHours;
  services: Service[];
  now: Date;
};

const DEFAULT_DURATION_MINUTES = 60;

const json = (value: unknown): string => JSON.stringify(value);

const resolveService = (ctx: HandlerContext, serviceId: string): Service | null => {
  const found = ctx.services.find((s) => s.id === serviceId);
  if (found) return found;
  // A business with no services configured still gets a generic booking.
  if (!ctx.services.length) return { id: serviceId || "general", name: "Appointment", duration_minutes: DEFAULT_DURATION_MINUTES };
  return null;
};

const unknownService = (ctx: HandlerContext): string =>
  json({ error: "unknown_service_id", valid_service_ids: ctx.services.map((s) => s.id) });

const findSlots = async (
  ctx: HandlerContext,
  service: Service,
  dateFrom: string,
  dateTo: string,
  count: number,
) => {
  const from = zonedToUtc(dateFrom, "00:00", ctx.timeZone);
  const to = zonedToUtc(addDays(dateTo, 1), "00:00", ctx.timeZone);
  const busy = await getBusyIntervals(ctx.tenantId, from, to);
  return generateSlots({
    workingHours: ctx.workingHours,
    timeZone: ctx.timeZone,
    dateFrom,
    dateTo,
    durationMinutes: service.duration_minutes,
    busy,
    now: ctx.now,
    count,
  });
};

const describeSlots = (ctx: HandlerContext, slots: Array<{ start: Date }>) =>
  slots.map((s) => ({
    start: formatLocalIso(s.start, ctx.timeZone),
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: ctx.timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(s.start),
  }));

export const handleListServices = async (_args: unknown, ctx: HandlerContext): Promise<string> =>
  ctx.services.length ? json(ctx.services) : "No services configured yet.";

export const handleProposeSlots = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = proposeSlotsSchema.parse(rawArgs);
  const service = resolveService(ctx, args.service_id);
  if (!service) return unknownService(ctx);

  const today = toLocalParts(ctx.now, ctx.timeZone).date;
  const dateFrom = args.date_from < today ? today : args.date_from;
  const maxTo = addDays(dateFrom, MAX_RANGE_DAYS - 1);
  const dateTo = args.date_to > maxTo ? maxTo : args.date_to < dateFrom ? dateFrom : args.date_to;

  let slots = await findSlots(ctx, service, dateFrom, dateTo, args.count);
  let searchedUntil = dateTo;
  if (!slots.length) {
    // Nothing in the requested window; look a week further so the customer still gets options.
    const extendedTo = addDays(dateTo, 7);
    slots = await findSlots(ctx, service, addDays(dateTo, 1), extendedTo, args.count);
    searchedUntil = extendedTo;
  }

  return json({
    service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes },
    timezone: ctx.timeZone,
    searched: { from: dateFrom, to: searchedUntil },
    slots: describeSlots(ctx, slots),
    ...(slots.length ? {} : { note: "No free times in this period. Ask for another date range or escalate." }),
  });
};

const isUniqueViolation = (err: unknown): boolean => {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
};

type SlotCheck =
  | { ok: true; startAt: Date; endAt: Date }
  | { ok: false; response: string };

// `ignore` is the appointment being moved: its own DB row and calendar event must not count as a clash.
const checkSlot = async (
  ctx: HandlerContext,
  service: Service,
  start: string,
  ignore?: { start: Date; end: Date },
): Promise<SlotCheck> => {
  const startAt = parseDateTime(start, ctx.timeZone);
  if (!startAt) {
    return { ok: false, response: json({ error: "invalid_start", hint: "Use the exact `start` value returned by proposeSlots" }) };
  }
  const endAt = new Date(startAt.getTime() + service.duration_minutes * 60_000);
  const slot = { start: startAt, end: endAt };

  const fail = async (reason: string): Promise<SlotCheck> => {
    const day = toLocalParts(startAt, ctx.timeZone).date;
    const alternatives = describeSlots(ctx, await findSlots(ctx, service, day, addDays(day, 2), 3));
    return { ok: false, response: json({ success: false, reason, alternatives }) };
  };

  if (startAt <= ctx.now) return fail("time_in_past");
  if (!isWithinWorkingHours(slot, ctx.workingHours, ctx.timeZone)) return fail("outside_working_hours");

  const busy = (await getBusyIntervals(ctx.tenantId, startAt, endAt)).filter(
    (b) => !ignore || b.start.getTime() !== ignore.start.getTime() || b.end.getTime() !== ignore.end.getTime(),
  );
  if (busy.some((b) => overlaps(slot, b))) return fail("slot_taken");

  return { ok: true, startAt, endAt };
};

export const handleBookAppointment = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = bookAppointmentSchema.parse(rawArgs);
  const service = resolveService(ctx, args.service_id);
  if (!service) return unknownService(ctx);

  const check = await checkSlot(ctx, service, args.start);
  if (!check.ok) return check.response;
  const { startAt, endAt } = check;
  const alternatives = async (): Promise<unknown> => {
    const day = toLocalParts(startAt, ctx.timeZone).date;
    return describeSlots(ctx, await findSlots(ctx, service, day, addDays(day, 2), 3));
  };

  let appointmentId: string | undefined;
  try {
    const [appt] = await db
      .insert(appointments)
      .values({
        tenantId: ctx.tenantId,
        contactId: ctx.contactId,
        serviceId: service.id,
        startAt,
        endAt,
        notes: args.notes,
        status: "scheduled",
      })
      .returning({ id: appointments.id });
    appointmentId = appt?.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return json({ success: false, reason: "slot_taken", alternatives: await alternatives() });
    }
    throw err;
  }
  if (!appointmentId) throw new Error("Appointment insert returned no row");

  const [contact] = await db
    .update(contacts)
    .set({
      ...(args.contact_name ? { name: args.contact_name } : {}),
      leadStatus: "booked",
      updatedAt: new Date(),
    })
    .where(and(withTenant(ctx.tenantId, contacts.tenantId), eq(contacts.id, ctx.contactId)))
    .returning({ name: contacts.name, email: contacts.email });

  let calendarSynced = false;
  try {
    const gcalEventId = await createCalendarEvent(ctx.tenantId, {
      summary: `${service.name} — ${contact?.name ?? "Customer"}`,
      ...(args.notes ? { description: args.notes } : {}),
      startIso: startAt.toISOString(),
      endIso: endAt.toISOString(),
      timezone: ctx.timeZone,
      ...(contact?.email ? { attendeeEmail: contact.email } : {}),
    });
    await db
      .update(appointments)
      .set({ gcalEventId })
      .where(and(withTenant(ctx.tenantId, appointments.tenantId), eq(appointments.id, appointmentId)));
    calendarSynced = true;
  } catch (err) {
    console.warn("[handlers] calendar sync skipped:", err instanceof Error ? err.message : "unknown");
  }

  return json({
    success: true,
    appointment_id: appointmentId,
    service: service.name,
    start: formatLocalIso(startAt, ctx.timeZone),
    end: formatLocalIso(endAt, ctx.timeZone),
    calendar_synced: calendarSynced,
  });
};

export const handleRescheduleAppointment = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = rescheduleAppointmentSchema.parse(rawArgs);

  const [existing] = await db
    .select({
      serviceId: appointments.serviceId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      gcalEventId: appointments.gcalEventId,
    })
    .from(appointments)
    .where(
      and(
        withTenant(ctx.tenantId, appointments.tenantId),
        eq(appointments.id, args.appointment_id),
        eq(appointments.contactId, ctx.contactId),
        eq(appointments.status, "scheduled"),
      ),
    )
    .limit(1);
  if (!existing) return json({ success: false, reason: "not_found_or_not_scheduled" });

  const service = resolveService(ctx, existing.serviceId ?? "general");
  if (!service) return unknownService(ctx);

  const check = await checkSlot(ctx, service, args.new_start, { start: existing.startAt, end: existing.endAt });
  if (!check.ok) return check.response;

  try {
    await db
      .update(appointments)
      .set({ startAt: check.startAt, endAt: check.endAt, reminderSentAt: null, updatedAt: new Date() })
      .where(and(withTenant(ctx.tenantId, appointments.tenantId), eq(appointments.id, args.appointment_id)));
  } catch (err) {
    if (isUniqueViolation(err)) return json({ success: false, reason: "slot_taken" });
    throw err;
  }

  let calendarSynced = !existing.gcalEventId;
  if (existing.gcalEventId) {
    try {
      await updateCalendarEvent(ctx.tenantId, existing.gcalEventId, {
        startIso: check.startAt.toISOString(),
        endIso: check.endAt.toISOString(),
        timezone: ctx.timeZone,
      });
      calendarSynced = true;
    } catch (err) {
      console.warn("[handlers] calendar update failed:", err instanceof Error ? err.message : "unknown");
    }
  }

  return json({
    success: true,
    appointment_id: args.appointment_id,
    previous_start: formatLocalIso(existing.startAt, ctx.timeZone),
    start: formatLocalIso(check.startAt, ctx.timeZone),
    end: formatLocalIso(check.endAt, ctx.timeZone),
    calendar_synced: calendarSynced,
  });
};

export const handleCancelAppointment = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = cancelAppointmentSchema.parse(rawArgs);
  const { cancelled } = await cancelAppointmentForTenant(ctx.tenantId, args.appointment_id, {
    contactId: ctx.contactId,
  });
  return cancelled
    ? json({ success: true, appointment_id: args.appointment_id })
    : json({ success: false, reason: "not_found_or_already_cancelled" });
};

export const handleCaptureLead = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = captureLeadSchema.parse(rawArgs);

  const [existing] = await db
    .select({ qualificationData: contacts.qualificationData, leadStatus: contacts.leadStatus })
    .from(contacts)
    .where(and(withTenant(ctx.tenantId, contacts.tenantId), eq(contacts.id, ctx.contactId)))
    .limit(1);

  await db
    .update(contacts)
    .set({
      name: args.name,
      ...(args.email ? { email: args.email } : {}),
      leadStatus: existing?.leadStatus === "booked" ? "booked" : "qualified",
      qualificationData: {
        ...((existing?.qualificationData as Record<string, unknown> | undefined) ?? {}),
        ...(args.qualification_answers ?? {}),
        intent: args.intent,
      },
      updatedAt: new Date(),
    })
    .where(and(withTenant(ctx.tenantId, contacts.tenantId), eq(contacts.id, ctx.contactId)));

  return json({ success: true });
};

export const handleEscalateToHuman = async (rawArgs: unknown, ctx: HandlerContext): Promise<string> => {
  const args = escalateToHumanSchema.parse(rawArgs);

  await db
    .update(conversations)
    .set({ status: "escalated", aiPaused: true })
    .where(and(withTenant(ctx.tenantId, conversations.tenantId), eq(conversations.id, ctx.conversationId)));

  const [row] = await db
    .select({
      contactName: contacts.name,
      contactWaId: contacts.waId,
      tenantName: tenants.name,
      notificationEmail: agentSettings.notificationEmail,
    })
    .from(contacts)
    .innerJoin(tenants, eq(tenants.id, contacts.tenantId))
    .leftJoin(agentSettings, eq(agentSettings.tenantId, contacts.tenantId))
    .where(and(withTenant(ctx.tenantId, contacts.tenantId), eq(contacts.id, ctx.contactId)))
    .limit(1);

  if (row) {
    await sendEscalationEmail({ ...row, conversationId: ctx.conversationId, reason: args.reason });
  }

  return json({ success: true, note: "A team member will take over. Tell the customer someone will follow up shortly." });
};

export const dispatchToolCall = async (name: string, args: unknown, ctx: HandlerContext): Promise<string> => {
  switch (name) {
    case "listServices":
      return handleListServices(args, ctx);
    case "proposeSlots":
      return handleProposeSlots(args, ctx);
    case "bookAppointment":
      return handleBookAppointment(args, ctx);
    case "rescheduleAppointment":
      return handleRescheduleAppointment(args, ctx);
    case "cancelAppointment":
      return handleCancelAppointment(args, ctx);
    case "captureLead":
      return handleCaptureLead(args, ctx);
    case "escalateToHuman":
      return handleEscalateToHuman(args, ctx);
    default:
      return json({ error: `Unknown tool: ${name}` });
  }
};
