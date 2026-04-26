"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { T, Locale } from "@/lib/i18n/translations";

export const DashboardNav = ({ t, locale }: { t: T; locale: Locale }) => {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard/conversations", label: t.nav.conversations },
    { href: "/dashboard/appointments", label: t.nav.appointments },
    { href: "/dashboard/settings", label: t.nav.settings },
  ];

  return (
    <nav className="w-56 shrink-0 border-e bg-card flex flex-col p-4 gap-1">
      <p className="text-lg font-semibold px-2 mb-4">{t.nav.brand}</p>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            pathname.startsWith(l.href) && "bg-accent text-accent-foreground font-medium",
          )}
        >
          {l.label}
        </Link>
      ))}
      <div className="mt-auto pt-4 border-t">
        <LanguageSwitcher current={locale} />
      </div>
    </nav>
  );
};
