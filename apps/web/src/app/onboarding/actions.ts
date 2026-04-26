"use server";

import { auth } from "@clerk/nextjs/server";
import { db, tenants, agentSettings } from "@rudd/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const setupSchema = z.object({
  businessName: z.string().min(1),
  timezone: z.string().min(1).default("UTC"),
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      duration_minutes: z.number().int().positive(),
    }),
  ),
});

export type SetupInput = z.infer<typeof setupSchema>;

export const completeTenantSetup = async (input: SetupInput): Promise<{ ok: true }> => {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No active organization");

  const parsed = setupSchema.parse(input);

  // Upsert tenant (webhook may have already created it)
  await db
    .insert(tenants)
    .values({ clerkOrgId: orgId, name: parsed.businessName })
    .onConflictDoNothing({ target: tenants.clerkOrgId });

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.clerkOrgId, orgId))
    .limit(1);

  if (!tenant) throw new Error("Tenant creation failed");

  await db
    .insert(agentSettings)
    .values({
      tenantId: tenant.id,
      businessName: parsed.businessName,
      timezone: parsed.timezone,
      workingHours: {
        Mon: "9am-5pm",
        Tue: "9am-5pm",
        Wed: "9am-5pm",
        Thu: "9am-5pm",
        Fri: "9am-5pm",
      },
      services: parsed.services,
    })
    .onConflictDoUpdate({
      target: agentSettings.tenantId,
      set: {
        businessName: parsed.businessName,
        timezone: parsed.timezone,
        services: parsed.services,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
};
