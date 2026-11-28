import { describe, expect, it } from "vitest";
import { isReminderDue, planReminder, type ReminderInput } from "./plan";

const H = 60 * 60_000;
const start = new Date("2026-03-10T10:00:00Z");

const base: ReminderInput = {
  startAt: start,
  createdAt: new Date(start.getTime() - 72 * H),
  now: new Date(start.getTime() - 23 * H),
  hoursBefore: 24,
  lastInboundAt: null,
  lastInboundBody: null,
  customerName: "Sara",
  businessName: "Glow Clinic",
  serviceName: "Consultation",
  timeZone: "Africa/Cairo",
  template: { name: "appointment_reminder", language: "en" },
};

describe("isReminderDue", () => {
  it("waits until the window opens", () => {
    expect(isReminderDue({ ...base, now: new Date(start.getTime() - 25 * H) })).toBe("not_due");
  });
  it("is due inside the window", () => {
    expect(isReminderDue(base)).toBe("due");
  });
  it("skips when the appointment is less than an hour away", () => {
    expect(isReminderDue({ ...base, now: new Date(start.getTime() - 30 * 60_000) })).toBe("too_late");
  });
  it("skips appointments booked after the window opened", () => {
    expect(isReminderDue({ ...base, createdAt: new Date(start.getTime() - 5 * H) })).toBe("booked_inside_window");
  });
});

describe("planReminder", () => {
  it("sends free text while the 24h window is open", () => {
    const plan = planReminder({ ...base, lastInboundAt: new Date(base.now.getTime() - 2 * H), lastInboundBody: "thanks" });
    expect(plan.kind).toBe("text");
    if (plan.kind === "text") expect(plan.body).toContain("Glow Clinic");
  });

  it("uses the template when the window is closed", () => {
    const plan = planReminder({ ...base, lastInboundAt: new Date(base.now.getTime() - 30 * H) });
    expect(plan.kind).toBe("template");
    if (plan.kind === "template") {
      expect(plan.template.name).toBe("appointment_reminder");
      expect(JSON.stringify(plan.template.components)).toContain("Sara");
    }
  });

  it("skips when the window is closed and no template is configured", () => {
    expect(planReminder({ ...base, template: null })).toEqual({ kind: "skip", reason: "no_template_outside_window" });
  });

  it("writes Arabic reminders for Arabic-speaking customers", () => {
    const plan = planReminder({ ...base, lastInboundAt: new Date(base.now.getTime() - H), lastInboundBody: "شكرا" });
    expect(plan.kind === "text" && /[؀-ۿ]/.test(plan.body)).toBe(true);
  });

  it("falls back to a generic greeting without a name", () => {
    const plan = planReminder({ ...base, customerName: null });
    expect(plan.kind === "template" && JSON.stringify(plan.template.components)).toContain("there");
  });
});
