import "server-only";
import { db, tenants } from "@rudd/db";
import { eq, asc } from "drizzle-orm";
import { redirect } from "next/navigation";

type SessionTenant = { tenantId: string; orgId: string | null };

export const isClerkConfigured = (): boolean => !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// The no-auth dev fallback must never be reachable in production: a missing Clerk key
// would otherwise expose the first tenant's data to anyone.
export const assertAuthConfigured = (): void => {
  if (!isClerkConfigured() && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production");
  }
};

const tenantIdForOrg = async (orgId: string): Promise<string | null> => {
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.clerkOrgId, orgId))
    .limit(1);
  return tenant?.id ?? null;
};

const devFallbackTenant = async (): Promise<SessionTenant> => {
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .orderBy(asc(tenants.createdAt))
    .limit(1);
  if (!tenant) throw new Error("No tenant in DB. Run: pnpm --filter @rudd/db seed");
  return { tenantId: tenant.id, orgId: null };
};

/** For pages and server actions: redirects when unauthenticated or not onboarded. */
export const getSessionTenant = async (): Promise<SessionTenant> => {
  assertAuthConfigured();
  if (!isClerkConfigured()) return devFallbackTenant();

  const { auth } = await import("@clerk/nextjs/server");
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");

  const tenantId = await tenantIdForOrg(orgId);
  if (!tenantId) redirect("/onboarding");
  return { tenantId, orgId };
};

/** For route handlers: returns null instead of redirecting. */
export const getApiTenant = async (): Promise<SessionTenant | null> => {
  assertAuthConfigured();
  if (!isClerkConfigured()) return devFallbackTenant();

  const { auth } = await import("@clerk/nextjs/server");
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const tenantId = await tenantIdForOrg(orgId);
  return tenantId ? { tenantId, orgId } : null;
};
