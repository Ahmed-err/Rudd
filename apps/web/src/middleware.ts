import { type NextFetchEvent, NextResponse, type NextRequest } from "next/server";

// Clerk is only activated once NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
// Webhook routes bypass auth entirely — they verify via HMAC signature.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isWebhookPath = (pathname: string) =>
  pathname.startsWith("/api/webhook") || pathname.startsWith("/api/webhooks");

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (isWebhookPath(pathname)) {
    return NextResponse.next();
  }

  if (!CLERK_KEY) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/onboarding(.*)" ]);

  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  })(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
