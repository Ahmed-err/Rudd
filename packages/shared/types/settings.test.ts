import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKING_HOURS,
  parseServices,
  parseWorkingHours,
  serviceSchema,
  timezoneSchema,
  workingHoursSchema,
} from "./settings";

describe("workingHoursSchema", () => {
  it("accepts the defaults", () => {
    expect(workingHoursSchema.parse(DEFAULT_WORKING_HOURS)).toEqual(DEFAULT_WORKING_HOURS);
  });

  it("rejects closing before opening on an open day", () => {
    const bad = { ...DEFAULT_WORKING_HOURS, mon: { enabled: true, open: "17:00", close: "09:00" } };
    expect(workingHoursSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects invalid times", () => {
    const bad = { ...DEFAULT_WORKING_HOURS, mon: { enabled: true, open: "25:00", close: "26:00" } };
    expect(workingHoursSchema.safeParse(bad).success).toBe(false);
  });
});

describe("parseWorkingHours", () => {
  it("falls back to defaults for the legacy onboarding shape", () => {
    expect(parseWorkingHours({ Mon: "9am-5pm", Tue: "9am-5pm" })).toEqual(DEFAULT_WORKING_HOURS);
  });

  it("keeps valid days and repairs invalid ones", () => {
    const result = parseWorkingHours({ sat: { enabled: true, open: "10:00", close: "14:00" }, mon: "junk" });
    expect(result.sat).toEqual({ enabled: true, open: "10:00", close: "14:00" });
    expect(result.mon).toEqual(DEFAULT_WORKING_HOURS.mon);
  });

  it("handles null", () => {
    expect(parseWorkingHours(null)).toEqual(DEFAULT_WORKING_HOURS);
  });
});

describe("services", () => {
  it("coerces numeric strings for duration", () => {
    expect(serviceSchema.parse({ id: "a", name: "Cut", duration_minutes: "45" }).duration_minutes).toBe(45);
  });

  it("returns [] for malformed service lists", () => {
    expect(parseServices([{ id: "a" }])).toEqual([]);
    expect(parseServices("nope")).toEqual([]);
  });
});

describe("timezoneSchema", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(timezoneSchema.safeParse("Africa/Cairo").success).toBe(true);
    expect(timezoneSchema.safeParse("Mars/Olympus").success).toBe(false);
  });
});
