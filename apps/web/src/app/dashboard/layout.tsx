import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/features/dashboard-nav";
import { getLocale, getT } from "@/lib/i18n/server";

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
  }

  const [t, locale] = await Promise.all([getT(), getLocale()]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardNav t={t} locale={locale} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
};

export default DashboardLayout;
