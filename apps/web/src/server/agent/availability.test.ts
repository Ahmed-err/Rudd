import { describe, expect, it } from "vitest";
import { DEFAULT_WORKING_HOURS } from "@rudd/shared";
import {
  addDays,
  formatLocalIso,
  generateSlots,
  isWithinWorkingHours,
  parseDateTime,
  toLocalParts,
  zonedToUtc,
} from "./availability";

describe("timezone helpers", () => {
  it("converts Cairo wall-clock time to UTC", () => {
    // Cairo is UTC+2 in winter.
    expect(zonedToUtc("2026-01-15", "10:00", "Africa/Cairo").toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("handles a DST transition (New York)", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("formats a local ISO string with offset", () => {
    expect(formatLocalIso(new Date("2026-01-15T08:00:00Z"), "Africa/Cairo")).toBe("2026-01-15T10:00:00+02:00");
    expect(formatLocalIso(new Date("2026-01-15T08:00:00Z"), "Asia/Kolkata")).toBe("2026-01-15T13:30:00+05:30");
  });

  it("reads the local weekday", () => {
    // 2026-01-15 23:30 UTC is already Friday in Dubai.
    expect(toLocalParts(new Date("2026-01-15T23:30:00Z"), "Asia/Dubai").weekday).toBe("fri");
  });

  it("parses bare local datetimes in the tenant timezone and respects explicit offsets", () => {
    expect(parseDateTime("2026-01-15T10:00", "Africa/Cairo")?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(parseDateTime("2026-01-15T10:00:00Z", "Africa/Cairo")?.toISOString()).toBe("2026-01-15T10:00:00.000Z");
    expect(parseDateTime("2026-01-15T10:00:00+04:00", "Africa/Cairo")?.toISOString()).toBe("2026-01-15T06:00:00.000Z");
    expect(parseDateTime("tomorrow", "Africa/Cairo")).toBeNull();
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("generateSlots", () => {
  const base = {
    workingHours: DEFAULT_WORKING_HOURS,
    timeZone: "Africa/Cairo",
    durationMinutes: 60,
    busy: [],
    now: new Date("2026-01-01T00:00:00Z"),
    count: 3,
  };

  it("only offers slots inside working hours on open days", () => {
    // 2026-01-17 is a Saturday (closed by default), 2026-01-19 a Monday.
    const slots = generateSlots({ ...base, dateFrom: "2026-01-17", dateTo: "2026-01-19" });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(isWithinWorkingHours(s, DEFAULT_WORKING_HOURS, "Africa/Cairo")).toBe(true);
      expect(toLocalParts(s.start, "Africa/Cairo").weekday).toBe("mon");
    }
    const [first] = slots;
    if (!first) throw new Error("expected a slot");
    expect(formatLocalIso(first.start, "Africa/Cairo")).toBe("2026-01-19T09:00:00+02:00");
  });

  it("skips busy intervals", () => {
    const busy = [{ start: new Date("2026-01-19T07:00:00Z"), end: new Date("2026-01-19T08:30:00Z") }];
    const slots = generateSlots({ ...base, busy, dateFrom: "2026-01-19", dateTo: "2026-01-19" });
    for (const s of slots) {
      expect(s.start >= new Date("2026-01-19T08:30:00Z") || s.end <= new Date("2026-01-19T07:00:00Z")).toBe(true);
    }
  });

  it("respects minimum notice", () => {
    const now = new Date("2026-01-19T09:10:00Z"); // 11:10 Cairo
    const slots = generateSlots({ ...base, now, dateFrom: "2026-01-19", dateTo: "2026-01-19" });
    expect(slots.every((s) => s.start.getTime() >= now.getTime() + 60 * 60_000)).toBe(true);
  });

  it("never exceeds the closing time", () => {
    const slots = generateSlots({ ...base, count: 20, maxPerDay: 20, durationMinutes: 90, dateFrom: "2026-01-19", dateTo: "2026-01-19" });
    const close = zonedToUtc("2026-01-19", "17:00", "Africa/Cairo");
    expect(slots.every((s) => s.end <= close)).toBe(true);
  });

  it("returns nothing when every day is closed", () => {
    const closed = Object.fromEntries(
      Object.entries(DEFAULT_WORKING_HOURS).map(([k, v]) => [k, { ...v, enabled: false }]),
    ) as typeof DEFAULT_WORKING_HOURS;
    expect(generateSlots({ ...base, workingHours: closed, dateFrom: "2026-01-19", dateTo: "2026-01-25" })).toEqual([]);
  });
});
