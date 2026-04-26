import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@rudd/db";
import { tenants } from "@rudd/db";
import { eq } from "drizzle-orm";
import { getAuthUrl } from "@/server/calendar/client";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export async function GET(): Promise<NextResponse> {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.clerkOrgId, orgId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // CSRF: store a random nonce in a short-lived cookie; embed tenantId + nonce in state
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ tenantId: tenant.id, nonce })).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set("gcal_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(getAuthUrl(state));
}
