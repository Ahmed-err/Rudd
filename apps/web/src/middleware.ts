import { type NextFetchEvent, NextResponse, type NextRequest } from "next/server";

// Without a Clerk key, dev runs unauthenticated; production refuses to serve.
// Webhook/API routes bypass Clerk — each verifies its own signature or bearer key.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isWebhookPath = (pathname: string) =>
  pathname.startsWith("/api/webhook") ||
  pathname.startsWith("/api/webhooks") ||
  pathname.startsWith("/api/inngest") ||
  pathname.startsWith("/api/outbound");

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (isWebhookPath(pathname)) {
    return NextResponse.next();
  }

  if (!CLERK_KEY) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Authentication is not configured", { status: 503 });
    }
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/onboarding(.*)",
    "/privacy",
    // Search engines fetch these signed out; behind auth.protect() they were 404.
    "/robots.txt",
    "/sitemap.xml",
  ]);

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
