import { z } from "zod";

// Only these two are needed for webhook verification (GET + POST signature check).
// Keeping them separate avoids crashing the webhook route if the send-side vars are misconfigured.
const whatsappWebhookSchema = z.object({
  META_APP_SECRET: z.string().min(1, "META_APP_SECRET is required"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, "WHATSAPP_VERIFY_TOKEN is required"),
});


const clerkSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
});

// Only the Clerk webhook route needs this, so a missing value must not stop the whole app booting.
const clerkWebhookSchema = z.object({
  CLERK_WEBHOOK_SECRET: z.string().min(1),
});

const llmSchema = z
  .object({
    GROQ_API_KEY: z.string().min(1).optional(),
    GROQ_MODEL: z.string().min(1).optional(),
    GROQ_TRANSCRIPTION_MODEL: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .refine((v) => v.GROQ_API_KEY || v.OPENAI_API_KEY, {
    message: "Set GROQ_API_KEY or OPENAI_API_KEY",
    path: ["GROQ_API_KEY"],
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
  LEADHUNTER_API_KEY: z
    .string()
    .min(32, "LEADHUNTER_API_KEY must be at least 32 characters"),

  LEADHUNTER_TENANT_ID: z.string().uuid(),
});

const notificationsSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  // Must be on a domain verified in Resend; the resend.dev sandbox only delivers to the account owner.
  RESEND_FROM_EMAIL: z.string().min(3).default("Rudd <notifications@resend.dev>"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// `FOO=` in an env file yields "", which should mean "unset" so optional vars and defaults work.
const definedEnv = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => !!e[1]?.trim()));

const parseGroup = <S extends z.ZodTypeAny>(schema: S, label: string): z.infer<S> => {
  const result = schema.safeParse(definedEnv());
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[env:${label}] Missing / invalid environment variables:\n${missing}`);
  }
  return result.data;
};

// Validated on first access so a build without secrets still succeeds;
// validateEnvAtStartup() makes production crash on boot instead of on first use.
const makeGroup = <S extends z.ZodTypeAny>(schema: S, label: string) => {
  let cached: z.infer<S> | null = null;
  const load = (): z.infer<S> => {
    cached ??= parseGroup(schema, label);
    return cached;
  };
  const proxy = new Proxy({} as z.infer<S>, {
    get(_target, prop) {
      return load()[prop as keyof z.infer<S>];
    },
  });
  return { proxy, load };
};

const groups = {
  whatsappWebhook: makeGroup(whatsappWebhookSchema, "whatsapp.webhook"),
  clerk: makeGroup(clerkSchema, "clerk"),
  clerkWebhook: makeGroup(clerkWebhookSchema, "clerk.webhook"),
  llm: makeGroup(llmSchema, "llm"),
  google: makeGroup(googleSchema, "google"),
  db: makeGroup(dbSchema, "db"),
  inngest: makeGroup(inngestSchema, "inngest"),
  crypto: makeGroup(cryptoSchema, "crypto"),
  leadHunter: makeGroup(leadHunterSchema, "leadHunter"),
  notifications: makeGroup(notificationsSchema, "notifications"),
};

const REQUIRED_AT_STARTUP = ["whatsappWebhook", "clerk", "llm", "google", "db", "crypto"] as const;

export const validateEnvAtStartup = (): void => {
  const errors: string[] = [];
  for (const name of REQUIRED_AT_STARTUP) {
    try {
      groups[name].load();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (process.env.NODE_ENV === "production" && !process.env.INNGEST_SIGNING_KEY) {
    errors.push("[env:inngest] INNGEST_SIGNING_KEY is required in production");
  }
  if (errors.length) throw new Error(errors.join("\n"));
};

export const env = {
  whatsappWebhook: groups.whatsappWebhook.proxy,
  clerk: groups.clerk.proxy,
  clerkWebhook: groups.clerkWebhook.proxy,
  llm: groups.llm.proxy,
  google: groups.google.proxy,
  db: groups.db.proxy,
  inngest: groups.inngest.proxy,
  crypto: groups.crypto.proxy,
  leadHunter: groups.leadHunter.proxy,
  notifications: groups.notifications.proxy,
};
