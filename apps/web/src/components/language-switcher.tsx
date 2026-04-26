"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/translations";

export const LanguageSwitcher = ({ current }: { current: Locale }) => {
  const [isPending, startTransition] = useTransition();
  const next: Locale = current === "en" ? "ar" : "en";
  const label = current === "en" ? "العربية" : "English";

  return (
    <button
      onClick={() => startTransition(() => setLocale(next))}
      disabled={isPending}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
    >
      {label}
    </button>
  );
};
