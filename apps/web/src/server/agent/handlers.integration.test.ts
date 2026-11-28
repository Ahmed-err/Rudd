import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { DEFAULT_WORKING_HOURS } from "@rudd/shared";
import { addDays, formatLocalIso, toLocalParts, zonedToUtc } from "./availability";

// Runs only against a disposable local database (see README: local Postgres).
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!LOCAL_DB)("booking tools against Postgres", async () => {
  const { db, tenants, contacts, conversations, appointments, agentSettings } = await import("@rudd/db");
  const { eq } = await import("drizzle-orm");
  const handlers = await import("./handlers");

  const tenantId = randomUUID();
  const contactId = randomUUID();
  const otherContactId = randomUUID();
  const timeZone = "Africa/Cairo";
  const now = new Date();
  // Next Monday at 10:00 local, safely in the future and inside default hours.
  const today = toLocalParts(now, timeZone);
  const offset = ((8 - ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(today.weekday)) % 7) || 7;
  const monday = addDays(today.date, offset);
  const at = (time: string) => formatLocalIso(zonedToUtc(monday, time, timeZone), timeZone);

  const ctx = (who = contactId) => ({
    tenantId,
    conversationId: randomUUID(),
    contactId: who,
    timeZone,
    workingHours: DEFAULT_WORKING_HOURS,
    services: [{ id: "consult", name: "Consultation", duration_minutes: 30 }],
    now,
  });
  const call = async (fn: (a: unknown, c: ReturnType<typeof ctx>) => Promise<string>, args: unknown, c = ctx()) =>
    JSON.parse(await fn(args, c)) as Record<string, unknown>;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, clerkOrgId: `test_${tenantId}`, name: "Test" });
    await db.insert(agentSettings).values({ tenantId, businessName: "Test", timezone: timeZone });
    await db.insert(contacts).values([
      { id: contactId, tenantId, waId: "201000000001" },
      { id: otherContactId, tenantId, waId: "201000000002" },
    ]);
    await db.insert(conversations).values({ tenantId, contactId });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  let appointmentId = "";

  it("proposes slots inside working hours", async () => {
    const res = await call(handlers.handleProposeSlots, { service_id: "consult", date_from: monday, date_to: monday });
    const slots = res.slots as Array<{ start: string }>;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.start).toBe(at("09:00"));
  });

  it("books a slot", async () => {
    const res = await call(handlers.handleBookAppointment, { service_id: "consult", start: at("10:00") });
    expect(res.success).toBe(true);
    appointmentId = String(res.appointment_id);
  });

  it("refuses an overlapping booking", async () => {
    const res = await call(handlers.handleBookAppointment, { service_id: "consult", start: at("10:15") }, ctx(otherContactId));
    expect(res).toMatchObject({ success: false, reason: "slot_taken" });
    expect((res.alternatives as unknown[]).length).toBeGreaterThan(0);
  });

  it("refuses a booking outside working hours", async () => {
    const res = await call(handlers.handleBookAppointment, { service_id: "consult", start: at("20:00") });
    expect(res).toMatchObject({ success: false, reason: "outside_working_hours" });
  });

  it("does not let another customer reschedule the appointment", async () => {
    const res = await call(
      handlers.handleRescheduleAppointment,
      { appointment_id: appointmentId, new_start: at("11:00") },
      ctx(otherContactId),
    );
    expect(res).toMatchObject({ success: false, reason: "not_found_or_not_scheduled" });
  });

  it("reschedules, including to a time overlapping its own old slot", async () => {
    const res = await call(handlers.handleRescheduleAppointment, { appointment_id: appointmentId, new_start: at("10:15") });
    expect(res).toMatchObject({ success: true, start: at("10:15") });
    const [row] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    expect(row?.reminderSentAt).toBeNull();
  });

  it("cancels only the customer's own appointment", async () => {
    const other = await call(handlers.handleCancelAppointment, { appointment_id: appointmentId }, ctx(otherContactId));
    expect(other.success).toBe(false);
    const mine = await call(handlers.handleCancelAppointment, { appointment_id: appointmentId });
    expect(mine.success).toBe(true);
  });

  it("frees the slot after cancelling", async () => {
    const res = await call(handlers.handleBookAppointment, { service_id: "consult", start: at("10:15") }, ctx(otherContactId));
    expect(res.success).toBe(true);
  });
});
