import "server-only";
import { z } from "zod";

export const incomingMessageEventSchema = z.object({
  phoneNumberId: z.string().min(1),
  waMessageId: z.string().min(1),
  from: z.string().min(1),
  contactName: z.string().optional(),
  body: z.string(),
  audioMediaId: z.string().optional(),
  timestamp: z.string(),
});
export type IncomingMessageEventData = z.infer<typeof incomingMessageEventSchema>;

export const INCOMING_MESSAGE_EVENT = "wa/message.received";
