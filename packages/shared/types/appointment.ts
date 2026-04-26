import { z } from "zod";

export const appointmentStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const leadStatusSchema = z.enum(["new", "qualified", "booked", "disqualified"]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const conversationStatusSchema = z.enum(["active", "resolved", "escalated"]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;
