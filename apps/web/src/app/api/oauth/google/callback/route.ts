import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeAndStore } from "@/server/calendar/client";
import { getApiTenant } from "@/lib/session";
import { safeEqual } from "@/server/safe-equal";

const settingsUrl = (request: NextRequest, query: string): URL =>
  new URL(`/dashboard/settings?${query}`, request.url);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (searchParams.get("error")) {
    return NextResponse.redirect(settingsUrl(request, "error=google_denied"));
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("gcal_oauth_nonce")?.value;
  cookieStore.delete("gcal_oauth_nonce");
  if (!storedNonce || !safeEqual(storedNonce, state)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const tenant = await getApiTenant();
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await exchangeCodeAndStore(tenant.tenantId, code);
  } catch (err) {
    console.error("[oauth/google] exchange failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.redirect(settingsUrl(request, "error=google_exchange"));
  }

  return NextResponse.redirect(settingsUrl(request, "success=google_connected"));
}
