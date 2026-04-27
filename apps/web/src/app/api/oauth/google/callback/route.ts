import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeAndStore } from "@/server/calendar/client";
import { z } from "zod";

const stateSchema = z.object({
  tenantId: z.string().uuid(),
  nonce: z.string(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/dashboard/settings?error=google_denied", request.url));
  }

  if (!code || !rawState) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let state: z.infer<typeof stateSchema>;
  try {
    state = stateSchema.parse(JSON.parse(Buffer.from(rawState, "base64url").toString()));
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("gcal_oauth_nonce")?.value;
  if (!storedNonce || storedNonce !== state.nonce) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }
  cookieStore.delete("gcal_oauth_nonce");

  try {
    await exchangeCodeAndStore(state.tenantId, code);
  } catch (err) {
    console.error("[oauth/google] exchange failed:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?error=google_exchange", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?success=google_connected", request.url));
}
