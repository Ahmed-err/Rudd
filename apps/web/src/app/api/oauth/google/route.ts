import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getAuthUrl } from "@/server/calendar/client";
import { getApiTenant } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const tenant = await getApiTenant();
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // State carries only a CSRF nonce; the tenant is re-derived from the session in the callback.
  const nonce = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("gcal_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(getAuthUrl(nonce));
}
