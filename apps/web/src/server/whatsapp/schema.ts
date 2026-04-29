import "server-only";
import { z } from "zod";

export const waTextMessageSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z
    .array(
      z.object({
        profile: z.object({ name: z.string().optional() }).optional(),
        wa_id: z.string(),
      }),
    )
    .optional(),
  messages: z
    .array(
      z.object({
        from: z.string(),
        id: z.string(),
        timestamp: z.string(),
        type: z.string(),
        text: z.object({ body: z.string() }).optional(),
      }),
    )
    .optional(),
  // Use z.string() (not enum) so unknown statuses Meta adds in future don't fail the whole payload.
  statuses: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        timestamp: z.string(),
        recipient_id: z.string(),
      }),
    )
    .optional(),
});

export const waWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: waTextMessageSchema,
          field: z.string(),
        }),
      ),
    }),
  ),
});

export type WaWebhookPayload = z.infer<typeof waWebhookPayloadSchema>;
