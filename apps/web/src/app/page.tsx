import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCheck,
  Languages,
  Mic,
  UserRound,
} from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { T } from "@/lib/i18n/translations";

const FEATURE_ICONS = [CalendarClock, Languages, CalendarCheck, BellRing, UserRound, Mic];

const ChatPreview = ({ t }: { t: T["home"]["chat"] }): ReactElement => (
  <div className="relative mx-auto w-full max-w-sm">
    <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-accent to-transparent blur-2xl" />
    <div className="overflow-hidden rounded-3xl border bg-card shadow-xl">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="grid size-9 place-items-center rounded-full bg-primary-foreground/20 text-sm font-semibold">G</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t.title}</p>
          <p className="text-xs opacity-80">{t.status}</p>
        </div>
      </div>
      <div className="space-y-2.5 bg-[oklch(0.96_0.012_120)] p-4 text-sm">
        <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-se-sm bg-[oklch(0.92_0.06_150)] px-3 py-2">{t.customer1}</p>
        <p className="w-fit max-w-[85%] rounded-2xl rounded-ss-sm bg-card px-3 py-2 shadow-xs">{t.bot1}</p>
        <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-se-sm bg-[oklch(0.92_0.06_150)] px-3 py-2">{t.customer2}</p>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-ss-sm bg-card px-3 py-2 shadow-xs">
          <p>{t.bot2}</p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCheck className="size-3.5 text-sky-500" aria-hidden />
            12:31
          </p>
        </div>
        <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-primary shadow-xs">
          <CalendarCheck className="size-3.5" aria-hidden />
          {t.booked}
        </p>
      </div>
    </div>
  </div>
);

const HomePage = async () => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId, orgId } = await auth();
    if (userId && orgId) redirect("/dashboard");
    if (userId && !orgId) redirect("/onboarding");
  }

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const h = t.home;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <BrandLogo name={t.nav.brand} />
          <nav className="flex items-center gap-2">
            <LanguageSwitcher current={locale} className="w-auto" />
            <Link href="/sign-in" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent sm:block">
              {h.signIn}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {h.primaryCta}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-accent-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {h.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">{h.headline}</h1>
            <p className="max-w-xl text-lg text-muted-foreground text-pretty">{h.subhead}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {h.primaryCta}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
              <Link href="/sign-in" className="rounded-lg border bg-card px-5 py-3 text-sm font-medium hover:bg-accent">
                {h.secondaryCta}
              </Link>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" aria-hidden />
              {h.trust}
            </p>
          </div>
          <ChatPreview t={h.chat} />
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">{h.featuresTitle}</h2>
              <p className="text-muted-foreground">{h.featuresSubtitle}</p>
            </div>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {h.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i] ?? Check;
                return (
                  <div key={f.title} className="space-y-2">
                    <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="font-medium">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <h2 className="text-3xl font-semibold tracking-tight">{h.stepsTitle}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {h.steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-card p-6 shadow-xs">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-primary px-8 py-10 text-primary-foreground md:flex-row md:items-center">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">{h.ctaTitle}</h2>
              <p className="opacity-85">{h.ctaBody}</p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-foreground px-5 py-3 text-sm font-medium text-primary hover:bg-primary-foreground/90"
            >
              {h.primaryCta}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-8">
          <span>© {new Date().getFullYear()} {t.nav.brand}</span>
          <Link href="/privacy" className="hover:text-foreground">
            {h.privacy}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
