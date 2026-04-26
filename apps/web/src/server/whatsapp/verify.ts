import "server-only";

/**
 * Verifies the X-Hub-Signature-256 header sent by Meta on every webhook POST.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export const verifyWhatsAppSignature = async (
  rawBody: string,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> => {
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));

  const expectedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (receivedHex.length !== expectedHex.length) return false;

  // Timing-safe byte-by-byte comparison
  const a = new TextEncoder().encode(receivedHex);
  const b = new TextEncoder().encode(expectedHex);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: lengths are equal
    mismatch |= a[i]! ^ b[i]!;
  }
  return mismatch === 0;
};
