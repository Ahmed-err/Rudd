"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { CalendarDays, LayoutDashboard, LogOut, Menu, MessagesSquare, Settings, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { T, Locale } from "@/lib/i18n/translations";

type Props = { t: T; locale: Locale; attentionCount: number; authEnabled: boolean };

const SignOutButton = ({ label }: { label: string }): ReactElement => {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: "/" })}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <LogOut className="size-4" aria-hidden />
      {label}
    </button>
  );
};

export const DashboardNav = ({ t, locale, attentionCount, authEnabled }: Props): ReactElement => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/dashboard/conversations", label: t.nav.conversations, icon: MessagesSquare, badge: attentionCount },
    { href: "/dashboard/appointments", label: t.nav.appointments, icon: CalendarDays },
    { href: "/dashboard/contacts", label: t.nav.contacts, icon: Users },
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings },
  ];

  const isActive = (href: string): boolean =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const navContent = (
    <>
      <div className="px-2 pb-6 pt-1">
        <BrandLogo name={t.nav.brand} />
      </div>
      <div className="flex flex-col gap-0.5">
        {links.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive(href) && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {badge ? (
              <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
                {badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      <div className="mt-auto space-y-1 border-t pt-4">
        <LanguageSwitcher current={locale} />
        {authEnabled && <SignOutButton label={t.nav.signOut} />}
      </div>
    </>
  );

  return (
    <>
      <nav className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e bg-sidebar p-4 md:flex">
        {navContent}
      </nav>

      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-sidebar px-4 md:hidden">
        <BrandLogo name={t.nav.brand} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 hover:bg-accent"
          aria-label="Menu"
          aria-expanded={open}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 start-0 flex w-64 flex-col bg-sidebar p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute end-3 top-3 rounded-lg p-2 hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="size-4" aria-hidden />
            </button>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
