import { describe, expect, it } from "vitest";
import {
  TOOL_DEFINITIONS,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  proposeSlotsSchema,
  zodToJsonSchema,
} from "./tools";

describe("tool schemas", () => {
  it("defaults the slot count", () => {
    expect(proposeSlotsSchema.parse({ service_id: "s", date_from: "2026-01-01", date_to: "2026-01-02" }).count).toBe(3);
  });

  it("rejects malformed dates", () => {
    expect(proposeSlotsSchema.safeParse({ service_id: "s", date_from: "tomorrow", date_to: "2026-01-02" }).success).toBe(false);
  });

  it("requires a uuid to cancel", () => {
    expect(cancelAppointmentSchema.safeParse({ appointment_id: "abc" }).success).toBe(false);
  });

  it("allows booking without a name", () => {
    expect(bookAppointmentSchema.safeParse({ service_id: "s", start: "2026-01-01T10:00:00+02:00" }).success).toBe(true);
  });
});

describe("zodToJsonSchema", () => {
  it("marks optional and defaulted fields as not required", () => {
    const json = zodToJsonSchema(proposeSlotsSchema);
    expect(json.required).toEqual(["service_id", "date_from", "date_to"]);
    expect(json.properties.count).toMatchObject({ type: "integer" });
    expect(json.properties.date_from).toMatchObject({ type: "string" });
    expect(json.properties.date_from?.description).toContain("YYYY-MM-DD");
  });

  it("produces a definition for every tool", () => {
    const names = TOOL_DEFINITIONS.map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names).toEqual([
      "listServices",
      "proposeSlots",
      "bookAppointment",
      "rescheduleAppointment",
      "cancelAppointment",
      "captureLead",
      "escalateToHuman",
    ]);
  });
});
