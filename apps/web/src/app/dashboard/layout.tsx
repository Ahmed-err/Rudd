import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/features/dashboard-nav";
import { getLocale, getT } from "@/lib/i18n/server";
import { getSessionTenant } from "@/lib/session";
import { countNeedsAttention } from "@/features/conversations/queries";

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
  }

  const [t, locale, { tenantId }] = await Promise.all([getT(), getLocale(), getSessionTenant()]);
  const attentionCount = await countNeedsAttention(tenantId).catch(() => 0);

  return (
    <div className="min-h-screen bg-background md:flex">
      <DashboardNav t={t} locale={locale} attentionCount={attentionCount} authEnabled={!!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
