import "server-only";
import { env } from "@/lib/env";

const getKey = async (): Promise<CryptoKey> => {
  const keyBytes = Buffer.from(env.crypto.ENCRYPTION_KEY, "hex");
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

// Returns "ivHex:ciphertextBase64"
export const encrypt = async (plaintext: string): Promise<string> => {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${Buffer.from(iv).toString("hex")}:${Buffer.from(ciphertext).toString("base64")}`;
};

export const decrypt = async (encrypted: string): Promise<string> => {
  const key = await getKey();
  const colonIdx = encrypted.indexOf(":");
  if (colonIdx === -1) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(encrypted.slice(0, colonIdx), "hex");
  const ciphertext = Buffer.from(encrypted.slice(colonIdx + 1), "base64");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
};
