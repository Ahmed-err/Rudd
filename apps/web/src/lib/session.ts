import "server-only";
import { db, tenants } from "@rudd/db";
import { eq, asc } from "drizzle-orm";
import { redirect } from "next/navigation";

type SessionTenant = { tenantId: string; orgId: string | null };

/**
 * Resolves the current tenant from Clerk org context.
 * Falls back to the first tenant in the DB when Clerk is not configured (dev mode).
 * Redirects to /sign-in if Clerk is configured but the user is not authenticated.
 */
export const getSessionTenant = async (): Promise<SessionTenant> => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId, orgId } = await auth();
    if (!userId) redirect("/sign-in");
    if (!orgId) redirect("/onboarding");

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkOrgId, orgId))
      .limit(1);

    if (!tenant) redirect("/onboarding");
    return { tenantId: tenant.id, orgId };
  }

  // Dev fallback — use the first (seed) tenant
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .orderBy(asc(tenants.createdAt))
    .limit(1);

  if (!tenant) {
    throw new Error("No tenant in DB. Run: pnpm --filter @rudd/db seed");
  }

  return { tenantId: tenant.id, orgId: null };
};
