"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { T, Locale } from "@/lib/i18n/translations";

export const DashboardNav = ({ t, locale }: { t: T; locale: Locale }) => {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/dashboard/conversations", label: t.nav.conversations },
    { href: "/dashboard/contacts", label: t.nav.contacts },
    { href: "/dashboard/appointments", label: t.nav.appointments },
    { href: "/dashboard/settings", label: t.nav.settings },
  ];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const navContent = (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={cn(
            "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            isActive(l.href) && "bg-accent text-accent-foreground font-medium",
          )}
        >
          {l.label}
        </Link>
      ))}
      <div className="mt-auto pt-4 border-t space-y-1">
        <LanguageSwitcher current={locale} />
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full text-start rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {t.nav.signOut}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 shrink-0 border-e bg-card flex-col p-4 gap-1">
        <p className="text-lg font-semibold px-2 mb-4">{t.nav.brand}</p>
        {navContent}
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b bg-card px-4 h-12">
        <p className="text-base font-semibold">{t.nav.brand}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-md hover:bg-accent"
          aria-label="Menu"
        >
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute top-0 bottom-0 start-0 w-56 bg-card border-e flex flex-col p-4 gap-1">
            <p className="text-lg font-semibold px-2 mb-4">{t.nav.brand}</p>
            {navContent}
          </div>
        </div>
      )}

      {/* Mobile top bar spacer */}
      <div className="md:hidden h-12 shrink-0" />
    </>
  );
};
