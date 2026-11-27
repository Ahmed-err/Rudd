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

  it("reports every missing group at startup", async () => {
    for (const key of ["META_APP_SECRET", "CLERK_SECRET_KEY", "DATABASE_URL", "GROQ_API_KEY", "OPENAI_API_KEY"]) {
      vi.stubEnv(key, "");
    }
    const { validateEnvAtStartup } = await loadEnv();
    expect(validateEnvAtStartup).toThrow(/whatsapp\.webhook[\s\S]*clerk[\s\S]*llm[\s\S]*db/);
  });
});
