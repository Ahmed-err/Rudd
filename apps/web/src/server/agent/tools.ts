import "server-only";
import { z } from "zod";
import type OpenAI from "openai";

// ── Zod schemas (source of truth) ─────────────────────────────────────────────

export const listServicesSchema = z.object({});

export const getAvailabilitySchema = z.object({
  service_id: z.string().describe("ID of the service to check availability for"),
  date_from: z.string().describe("Start date in YYYY-MM-DD format"),
  date_to: z.string().describe("End date in YYYY-MM-DD format (max 7 days range)"),
});

export const proposeSlotsSchema = z.object({
  service_id: z.string(),
  date_from: z.string().describe("Start date in YYYY-MM-DD format"),
  date_to: z.string().describe("End date in YYYY-MM-DD format"),
  count: z.number().int().min(1).max(5).default(3),
});

export const bookAppointmentSchema = z.object({
  service_id: z.string(),
  contact_name: z.string(),
  start_iso: z.string().describe("ISO 8601 datetime for the appointment start"),
  duration_minutes: z.number().int().positive().default(60),
  notes: z.string().optional(),
});

export const cancelAppointmentSchema = z.object({
  appointment_id: z.string().uuid(),
});

export const captureLeadSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  intent: z.string().describe("What the contact is looking for"),
  qualification_answers: z.record(z.string()).optional(),
});

export const escalateToHumanSchema = z.object({
  reason: z.string().describe("Why this conversation needs human attention"),
});

// ── OpenAI tool definitions ────────────────────────────────────────────────────

// Unwrap ZodOptional / ZodDefault to get the inner type name
const unwrap = (val: z.ZodTypeAny): z.ZodTypeAny => {
  const name = val._def.typeName;
  if (name === "ZodOptional" || name === "ZodDefault") return unwrap(val._def.innerType);
  return val;
};

const zodToJsonSchema = (schema: z.ZodObject<z.ZodRawShape>) => ({
  type: "object" as const,
  properties: Object.fromEntries(
    Object.entries(schema.shape).map(([key, val]) => {
      const inner = unwrap(val as z.ZodTypeAny);
      const typeName = inner._def.typeName;
      const base: Record<string, unknown> = {};
      if ((val as z.ZodTypeAny)._def.description) base.description = (val as z.ZodTypeAny)._def.description;
      if (typeName === "ZodString") base.type = "string";
      else if (typeName === "ZodNumber") base.type = "number";
      else if (typeName === "ZodBoolean") base.type = "boolean";
      else if (typeName === "ZodRecord") base.type = "object";
      else base.type = "string";
      return [key, base];
    }),
  ),
  required: Object.keys(schema.shape).filter((k) => {
    const field = schema.shape[k] as z.ZodTypeAny;
    return !(field instanceof z.ZodOptional) && !(field instanceof z.ZodDefault);
  }),
});

export const TOOL_DEFINITIONS: OpenAI.Beta.Assistants.AssistantTool[] = [
  {
    type: "function",
    function: {
      name: "listServices",
      description: "List all services offered by the business",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getAvailability",
      description: "Check available time slots for a service within a date range",
      parameters: zodToJsonSchema(getAvailabilitySchema),
    },
  },
  {
    type: "function",
    function: {
      name: "proposeSlots",
      description: "Suggest a few specific appointment times for the contact to choose from",
      parameters: zodToJsonSchema(proposeSlotsSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "bookAppointment",
      description: "Create an appointment and add it to the calendar",
      parameters: zodToJsonSchema(bookAppointmentSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "cancelAppointment",
      description: "Cancel an existing appointment",
      parameters: zodToJsonSchema(cancelAppointmentSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "captureLead",
      description: "Save contact information and qualification data",
      parameters: zodToJsonSchema(captureLeadSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "escalateToHuman",
      description: "Hand off the conversation to a human agent",
      parameters: zodToJsonSchema(escalateToHumanSchema),
    },
  },
];
