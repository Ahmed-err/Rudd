import "server-only";
import { z } from "zod";

export const waChangeValueSchema = z.object({
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
        interactive: z
          .object({
            type: z.string(),
            button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
            list_reply: z
              .object({ id: z.string(), title: z.string(), description: z.string().optional() })
              .optional(),
          })
          .optional(),
        button: z.object({ text: z.string(), payload: z.string().optional() }).optional(),
        audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
        image: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
        video: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
        document: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
        location: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
            name: z.string().optional(),
            address: z.string().optional(),
          })
          .optional(),
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
          value: waChangeValueSchema,
          field: z.string(),
        }),
      ),
    }),
  ),
});

export type WaWebhookPayload = z.infer<typeof waWebhookPayloadSchema>;
export type WaInboundMessage = NonNullable<z.infer<typeof waChangeValueSchema>["messages"]>[number];
