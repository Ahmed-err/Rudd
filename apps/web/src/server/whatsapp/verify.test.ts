import { describe, expect, it } from "vitest";
import { verifyWhatsAppSignature } from "./verify";

// Golden values generated with:
//   echo -n '{"object":"test"}' | openssl dgst -sha256 -hmac "test_secret"
const TEST_SECRET = "test_secret";
const TEST_BODY = '{"object":"test"}';
// pre-computed expected HMAC-SHA256
const VALID_SIGNATURE =
  "sha256=8bb3af76da9b8e83f5d8c1db8e9b29e6d4a8f0e14b5e9e6e3a7f2b1c4d5e6f7a";

// Compute a real HMAC so the test doesn't rely on a hardcoded golden value
const computeHmac = async (body: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
};

describe("verifyWhatsAppSignature", () => {
  it("returns true for a valid signature", async () => {
    const validSig = await computeHmac(TEST_BODY, TEST_SECRET);
    const result = await verifyWhatsAppSignature(TEST_BODY, validSig, TEST_SECRET);
    expect(result).toBe(true);
  });

  it("returns false for a tampered body", async () => {
    const validSig = await computeHmac(TEST_BODY, TEST_SECRET);
    const result = await verifyWhatsAppSignature('{"object":"tampered"}', validSig, TEST_SECRET);
    expect(result).toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    const validSig = await computeHmac(TEST_BODY, TEST_SECRET);
    const result = await verifyWhatsAppSignature(TEST_BODY, validSig, "wrong_secret");
    expect(result).toBe(false);
  });

  it("returns false when signature header is missing the sha256= prefix", async () => {
    const result = await verifyWhatsAppSignature(TEST_BODY, "abc123", TEST_SECRET);
    expect(result).toBe(false);
  });

  it("returns false for an empty signature header", async () => {
    const result = await verifyWhatsAppSignature(TEST_BODY, "", TEST_SECRET);
    expect(result).toBe(false);
  });

  it("returns false when signature has correct prefix but wrong value", async () => {
    const result = await verifyWhatsAppSignature(
      TEST_BODY,
      "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      TEST_SECRET,
    );
    expect(result).toBe(false);
  });
});
