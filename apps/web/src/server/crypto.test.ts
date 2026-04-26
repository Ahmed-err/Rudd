import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64); // 32-byte hex key for tests
});

// Dynamic import so env is set before the module resolves env.crypto
const getCrypto = () => import("./crypto");

describe("encrypt / decrypt", () => {
  it("round-trips a plaintext string", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const original = "ya29.some-google-refresh-token";
    const ciphertext = await encrypt(original);
    expect(ciphertext).not.toBe(original);
    expect(await decrypt(ciphertext)).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", async () => {
    const { encrypt } = await getCrypto();
    const a = await encrypt("same-value");
    const b = await encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const ct = await encrypt("secret");
    const tampered = ct.slice(0, -4) + "XXXX";
    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it("throws on malformed ciphertext (no colon)", async () => {
    const { decrypt } = await getCrypto();
    await expect(decrypt("nodivider")).rejects.toThrow("Invalid encrypted token format");
  });
});
