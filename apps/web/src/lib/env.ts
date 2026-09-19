import { z } from "zod";

// Each group is validated lazily when first accessed, so the app only crashes
// if you actually use a missing var — not on every cold start.

// Only these two are needed for webhook verification (GET + POST signature check).
// Keeping them separate avoids crashing the webhook route if the send-side vars are misconfigured.
const whatsappWebhookSchema = z.object({
  META_APP_SECRET: z.string().min(1, "META_APP_SECRET is required"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, "WHATSAPP_VERIFY_TOKEN is required"),
});


const clerkSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
});

const openaiSchema = z.object({
  GROQ_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

const googleSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
});

const dbSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const inngestSchema = z.object({
  // Optional in local dev when INNGEST_DEV=1; required in production
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

const cryptoSchema = z.object({
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
});

const leadHunterSchema = z.object({
  API_KEY: z.string().min(32, "LEADHUNTER_API_KEY must be at least 32 characters"),
  TENANT_ID: z.string().uuid(),
});

const makeGroup = <T extends z.ZodRawShape>(schema: z.ZodObject<T>, label: string) => {
  let cached: z.infer<typeof schema> | null = null;
  return new Proxy({} as z.infer<typeof schema>, {
    get(_target, prop) {
      if (!cached) {
        // biome-ignore lint/suspicious/noExplicitAny: validated below
        const result = schema.safeParse(process.env as any);
        if (!result.success) {
          const missing = result.error.issues
            .map((i) => `  ${i.path.join(".")}: ${i.message}`)
            .join("\n");
          throw new Error(`[env:${label}] Missing / invalid environment variables:\n${missing}`);
        }
        cached = result.data;
      }
      return cached[prop as keyof typeof cached];
    },
  });
};

export const env = {
  whatsappWebhook: makeGroup(whatsappWebhookSchema, "whatsapp.webhook"),
  clerk: makeGroup(clerkSchema, "clerk"),
  openai: makeGroup(openaiSchema, "openai"),
  google: makeGroup(googleSchema, "google"),
  db: makeGroup(dbSchema, "db"),
  inngest: makeGroup(inngestSchema, "inngest"),
  crypto: makeGroup(cryptoSchema, "crypto"),
  leadHunter: makeGroup(leadHunterSchema, "leadHunter"),
};
