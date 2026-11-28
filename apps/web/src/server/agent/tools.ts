import "server-only";
import { z } from "zod";
import type OpenAI from "openai";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const listServicesSchema = z.object({});

export const proposeSlotsSchema = z.object({
  service_id: z.string().describe("The [service_id: ...] of the chosen service"),
  date_from: dateString.describe("First day to search, YYYY-MM-DD in the business timezone"),
  date_to: dateString.describe("Last day to search, YYYY-MM-DD (at most 14 days after date_from)"),
  count: z.number().int().min(1).max(5).default(3).describe("How many options to return"),
});

export const bookAppointmentSchema = z.object({
  service_id: z.string().describe("The [service_id: ...] of the chosen service"),
  start: z.string().describe("Start time exactly as returned by proposeSlots, e.g. 2026-11-28T10:00:00+02:00"),
  contact_name: z.string().optional().describe("Customer's name if they gave it"),
  notes: z.string().max(1000).optional(),
});

export const cancelAppointmentSchema = z.object({
  appointment_id: z.string().uuid().describe("ID from the customer's upcoming appointments list"),
});

export const captureLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  intent: z.string().describe("What the contact is looking for"),
  qualification_answers: z.record(z.string()).optional(),
});

export const escalateToHumanSchema = z.object({
  reason: z.string().describe("Why this conversation needs human attention"),
});

type JsonSchemaProperty = { type: string; description?: string; enum?: string[] };

const unwrap = (val: z.ZodTypeAny): z.ZodTypeAny =>
  val instanceof z.ZodOptional || val instanceof z.ZodDefault || val instanceof z.ZodEffects
    ? unwrap(val instanceof z.ZodEffects ? val.innerType() : val._def.innerType)
    : val;

const jsonTypeOf = (inner: z.ZodTypeAny): JsonSchemaProperty => {
  if (inner instanceof z.ZodNumber) return { type: inner.isInt ? "integer" : "number" };
  if (inner instanceof z.ZodBoolean) return { type: "boolean" };
  if (inner instanceof z.ZodRecord || inner instanceof z.ZodObject) return { type: "object" };
  if (inner instanceof z.ZodEnum) return { type: "string", enum: inner.options as string[] };
  return { type: "string" };
};

export const zodToJsonSchema = (schema: z.AnyZodObject) => ({
  type: "object" as const,
  properties: Object.fromEntries(
    Object.entries(schema.shape as Record<string, z.ZodTypeAny>).map(([key, val]) => {
      const prop = jsonTypeOf(unwrap(val));
      const description = val.description ?? unwrap(val).description;
      return [key, description ? { ...prop, description } : prop];
    }),
  ),
  required: Object.entries(schema.shape as Record<string, z.ZodTypeAny>)
    .filter(([, val]) => !val.isOptional())
    .map(([key]) => key),
});

const tool = (name: string, description: string, schema: z.AnyZodObject): OpenAI.Chat.ChatCompletionTool => ({
  type: "function",
  function: { name, description, parameters: zodToJsonSchema(schema) },
});

export const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  tool("listServices", "List all services offered by the business", listServicesSchema),
  tool(
    "proposeSlots",
    "Find real free appointment times for a service, respecting working hours and existing bookings",
    proposeSlotsSchema,
  ),
  tool("bookAppointment", "Book one of the times returned by proposeSlots", bookAppointmentSchema),
  tool("cancelAppointment", "Cancel one of this customer's upcoming appointments", cancelAppointmentSchema),
  tool("captureLead", "Save contact information and qualification data", captureLeadSchema),
  tool("escalateToHuman", "Hand the conversation to a human; the AI stops replying afterwards", escalateToHumanSchema),
];
