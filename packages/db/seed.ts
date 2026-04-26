import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const main = async () => {
  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) throw new Error("DATABASE_URL is not set");

  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!PHONE_NUMBER_ID) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");

  const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "unknown";

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
    encryptedAccessToken: "see_env_WHATSAPP_ACCESS_TOKEN",
  });

  await db.insert(schema.agentSettings).values({
    tenantId: tenant.id,
    businessName: "My Business",
    timezone: "UTC",
    workingHours: { mon: "09:00-17:00", tue: "09:00-17:00", wed: "09:00-17:00", thu: "09:00-17:00", fri: "09:00-17:00" },
    services: [
      { id: "consult", name: "Consultation", duration_minutes: 30 },
      { id: "followup", name: "Follow-up", duration_minutes: 15 },
    ],
  });

  console.log("Done. Tenant ID:", tenant.id);
};

main().catch((err) => { console.error(err); process.exit(1); });
