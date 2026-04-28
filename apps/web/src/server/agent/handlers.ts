import "server-only";
import { db, agentSettings, appointments, contacts, conversations } from "@rudd/db";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  captureLeadSchema,
  escalateToHumanSchema,
  getAvailabilitySchema,
  proposeSlotsSchema,
} from "./tools";
import {
  getFreeBusy,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/server/calendar/client";

type HandlerContext = {
  tenantId: string;
  conversationId: string;
  contactId: string;
};

// ── list_services ──────────────────────────────────────────────────────────────
export const handleListServices = async (
  _args: unknown,
  { tenantId }: HandlerContext,
): Promise<string> => {
  const [settings] = await db
    .select({ services: agentSettings.services })
    .from(agentSettings)
    .where(eq(agentSettings.tenantId, tenantId))
    .limit(1);

  const services = settings?.services as Array<{ id: string; name: string; duration_minutes: number; price?: string }> ?? [];
  if (!services.length) return "No services configured yet.";
  return JSON.stringify(services);
};

// ── get_availability ───────────────────────────────────────────────────────────
export const handleGetAvailability = async (
  rawArgs: unknown,
  { tenantId }: HandlerContext,
): Promise<string> => {
  const args = getAvailabilitySchema.parse(rawArgs);

  const [settings] = await db
    .select({ workingHours: agentSettings.workingHours, timezone: agentSettings.timezone })
    .from(agentSettings)
    .where(eq(agentSettings.tenantId, tenantId))
    .limit(1);

  const timeMin = `${args.date_from}T00:00:00Z`;
  const timeMax = `${args.date_to}T23:59:59Z`;

  let busySlots: Array<{ start: string; end: string }> = [];
  try {
    busySlots = await getFreeBusy(tenantId, timeMin, timeMax);
  } catch {
    // Fall back to DB-only availability if calendar not yet connected
    const booked = await db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, new Date(timeMin)),
          lte(appointments.endAt, new Date(timeMax)),
        ),
      );
    busySlots = booked.map((b) => ({ start: b.startAt.toISOString(), end: b.endAt.toISOString() }));
  }

  return JSON.stringify({
    busy_slots: busySlots,
    working_hours: settings?.workingHours ?? {},
    timezone: settings?.timezone ?? "UTC",
    date_range: { from: args.date_from, to: args.date_to },
  });
};

// ── propose_slots ──────────────────────────────────────────────────────────────
export const handleProposeSlots = async (
  rawArgs: unknown,
  { tenantId: _tenantId }: HandlerContext,
): Promise<string> => {
  const args = proposeSlotsSchema.parse(rawArgs);

  // Simple slot generation: return `count` slots starting from date_from at 9am, spaced 1 day apart
  // The agent will format these nicely for the user
  const slots = [];
  const start = new Date(`${args.date_from}T09:00:00`);
  for (let i = 0; i < args.count; i++) {
    const slotStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
  }

  return JSON.stringify({ proposed_slots: slots, service_id: args.service_id });
};

// ── book_appointment ───────────────────────────────────────────────────────────
export const handleBookAppointment = async (
  rawArgs: unknown,
  { tenantId, contactId }: HandlerContext,
): Promise<string> => {
  const args = bookAppointmentSchema.parse(rawArgs);

  const startAt = new Date(args.start_iso);
  const endAt = new Date(startAt.getTime() + args.duration_minutes * 60 * 1000);

  const [settings] = await db
    .select({ businessName: agentSettings.businessName, timezone: agentSettings.timezone })
    .from(agentSettings)
    .where(eq(agentSettings.tenantId, tenantId))
    .limit(1);

  const [contact] = await db
    .select({ name: contacts.name, email: contacts.email })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  const [appt] = await db
    .insert(appointments)
    .values({
      tenantId,
      contactId,
      serviceId: args.service_id,
      startAt,
      endAt,
      notes: args.notes,
      status: "scheduled",
    })
    .returning({ id: appointments.id });

  let gcalEventId: string | undefined;
  try {
    gcalEventId = await createCalendarEvent(tenantId, {
      summary: `${args.service_id ?? "Appointment"} — ${contact?.name ?? "Customer"}`,
      ...(args.notes ? { description: args.notes } : {}),
      startIso: startAt.toISOString(),
      endIso: endAt.toISOString(),
      timezone: settings?.timezone ?? "UTC",
      ...(contact?.email ? { attendeeEmail: contact.email } : {}),
    });
    await db
      .update(appointments)
      .set({ gcalEventId })
      .where(eq(appointments.id, appt?.id ?? ""));
  } catch (err) {
    // Calendar not connected or failed — appointment still saved in DB
    console.warn("[handlers] GCal createEvent skipped:", err);
  }

  return JSON.stringify({
    success: true,
    appointment_id: appt?.id,
    start: startAt.toISOString(),
    end: endAt.toISOString(),
    calendar_synced: !!gcalEventId,
  });
};

// ── cancel_appointment ─────────────────────────────────────────────────────────
export const handleCancelAppointment = async (
  rawArgs: unknown,
  { tenantId }: HandlerContext,
): Promise<string> => {
  const args = cancelAppointmentSchema.parse(rawArgs);

  const [appt] = await db
    .select({ gcalEventId: appointments.gcalEventId })
    .from(appointments)
    .where(and(eq(appointments.id, args.appointment_id), eq(appointments.tenantId, tenantId)))
    .limit(1);

  await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(appointments.id, args.appointment_id), eq(appointments.tenantId, tenantId)));

  if (appt?.gcalEventId) {
    try {
      await deleteCalendarEvent(tenantId, appt.gcalEventId);
    } catch (err) {
      console.warn("[handlers] GCal deleteEvent failed:", err);
    }
  }

  return JSON.stringify({ success: true, appointment_id: args.appointment_id });
};

// ── capture_lead ───────────────────────────────────────────────────────────────
export const handleCaptureLead = async (
  rawArgs: unknown,
  { tenantId, contactId }: HandlerContext,
): Promise<string> => {
  const args = captureLeadSchema.parse(rawArgs);

  await db
    .update(contacts)
    .set({
      name: args.name,
      email: args.email,
      leadStatus: "qualified",
      qualificationData: args.qualification_answers ?? {},
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));

  return JSON.stringify({ success: true });
};

// ── escalate_to_human ──────────────────────────────────────────────────────────
export const handleEscalateToHuman = async (
  rawArgs: unknown,
  { tenantId, conversationId }: HandlerContext,
): Promise<string> => {
  const args = escalateToHumanSchema.parse(rawArgs);

  await db
    .update(conversations)
    .set({ status: "escalated" })
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

  // TODO: notify owner via email/push in next phase

  return JSON.stringify({ success: true, reason: args.reason });
};

// ── Dispatcher ────────────────────────────────────────────────────────────────
export const dispatchToolCall = async (
  name: string,
  args: unknown,
  ctx: HandlerContext,
): Promise<string> => {
  switch (name) {
    case "listServices":     return handleListServices(args, ctx);
    case "getAvailability":  return handleGetAvailability(args, ctx);
    case "proposeSlots":     return handleProposeSlots(args, ctx);
    case "bookAppointment":  return handleBookAppointment(args, ctx);
    case "cancelAppointment": return handleCancelAppointment(args, ctx);
    case "captureLead":      return handleCaptureLead(args, ctx);
    case "escalateToHuman":  return handleEscalateToHuman(args, ctx);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
};
