import { afterEach, describe, expect, it, vi } from "vitest";

const loadEnv = async () => {
  vi.resetModules();
  return import("./env");
};

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats blank values as unset so defaults apply", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "  ");
    const { env } = await loadEnv();
    expect(env.notifications.RESEND_FROM_EMAIL).toContain("resend.dev");
    expect(env.notifications.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });

  it("requires at least one LLM key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const { env } = await loadEnv();
    expect(() => env.llm.GROQ_API_KEY).toThrow(/GROQ_API_KEY or OPENAI_API_KEY/);
  });

  it("rejects a short encryption key", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "abc");
    const { env } = await loadEnv();
    expect(() => env.crypto.ENCRYPTION_KEY).toThrow(/ENCRYPTION_KEY/);
  });

  it("does not require the Clerk webhook secret at startup", async () => {
    const required = {
      META_APP_SECRET: "x", WHATSAPP_VERIFY_TOKEN: "x",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk", CLERK_WEBHOOK_SECRET: "",
      GROQ_API_KEY: "g", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s",
      GOOGLE_REDIRECT_URI: "https://example.com/cb", DATABASE_URL: "postgres://u:p@h/db",
      ENCRYPTION_KEY: "a".repeat(64),
    };
    for (const [k, v] of Object.entries(required)) vi.stubEnv(k, v);
    const { env, validateEnvAtStartup } = await loadEnv();
    expect(validateEnvAtStartup).not.toThrow();
    expect(() => env.clerkWebhook.CLERK_WEBHOOK_SECRET).toThrow(/CLERK_WEBHOOK_SECRET/);
  });

  it("reports every missing group at startup", async () => {
    for (const key of ["META_APP_SECRET", "CLERK_SECRET_KEY", "DATABASE_URL", "GROQ_API_KEY", "OPENAI_API_KEY"]) {
      vi.stubEnv(key, "");
    }
    const { validateEnvAtStartup } = await loadEnv();
    expect(validateEnvAtStartup).toThrow(/whatsapp\.webhook[\s\S]*clerk[\s\S]*llm[\s\S]*db/);
  });
});
