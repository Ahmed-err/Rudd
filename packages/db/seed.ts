import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { DEFAULT_WORKING_HOURS } from "../shared/types/settings";

// Same "ivHex:ciphertextBase64" AES-GCM format as apps/web/src/server/crypto.ts.
const encryptToken = async (plaintext: string, keyHex: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", Buffer.from(keyHex, "hex"), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${Buffer.from(iv).toString("hex")}:${Buffer.from(ciphertext).toString("base64")}`;
};

const main = async () => {
  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) throw new Error("DATABASE_URL is not set");

  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!PHONE_NUMBER_ID) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");

  const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "unknown";
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ACCESS_TOKEN) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  if (ENCRYPTION_KEY?.length !== 64) throw new Error("ENCRYPTION_KEY must be a 64-char hex string");

  const db = drizzle(neon(DB_URL), { schema });

  console.log("Seeding tenant for phoneNumberId:", PHONE_NUMBER_ID);

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ clerkOrgId: "dev_org_placeholder", name: "My Business (dev)", plan: "free" })
    .onConflictDoNothing()
    .returning();

  if (!tenant) {
    const [existing] = await db.select().from(schema.tenants).limit(1);
    console.log("Tenant already exists:", existing?.id, existing?.name);
    return;
  }

  console.log("Created tenant:", tenant.id);

  await db.insert(schema.waAccounts).values({
    tenantId: tenant.id,
    phoneNumberId: PHONE_NUMBER_ID,
    businessAccountId: BUSINESS_ACCOUNT_ID,
    encryptedAccessToken: await encryptToken(ACCESS_TOKEN, ENCRYPTION_KEY),
  });

  await db.insert(schema.agentSettings).values({
    tenantId: tenant.id,
    businessName: "My Business",
    timezone: "UTC",
    workingHours: DEFAULT_WORKING_HOURS,
    services: [
      { id: "consult", name: "Consultation", duration_minutes: 30 },
      { id: "followup", name: "Follow-up", duration_minutes: 15 },
    ],
  });

  console.log("Done. Tenant ID:", tenant.id);
};

main().catch((err) => { console.error(err); process.exit(1); });
