"use client";

import { useTransition, type ReactElement } from "react";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/translations";

export const LanguageSwitcher = ({ current, className }: { current: Locale; className?: string }): ReactElement => {
  const [isPending, startTransition] = useTransition();
  const next: Locale = current === "en" ? "ar" : "en";
  const label = current === "en" ? "العربية" : "English";

  return (
    <button
      type="button"
      onClick={() => startTransition(() => setLocale(next))}
      disabled={isPending}
      lang={next}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {label}
    </button>
  );
};
