"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveWorkingHours } from "./actions";
import { cn } from "@/lib/utils";
import { DAY_KEYS as DAYS, DEFAULT_WORKING_HOURS as DEFAULT_HOURS, parseWorkingHours as parseInitial, type WorkingHours } from "@rudd/shared";
import type { T } from "@/lib/i18n/translations";

type DayKey = keyof WorkingHours;

type Props = {
  initial: unknown;
  t: T["settings"]["hours"];
};

export const WorkingHoursEditor = ({ initial, t }: Props) => {
  const [hours, setHours] = useState<WorkingHours>(() => parseInitial(initial));
  const [isPending, startTransition] = useTransition();

  const toggle = (day: DayKey) =>
    setHours((prev) => {
      const d = prev[day] ?? DEFAULT_HOURS[day];
      return { ...prev, [day]: { ...d, enabled: !d.enabled } };
    });

  const setTime = (day: DayKey, field: "open" | "close", value: string) =>
    setHours((prev) => {
      const d = prev[day] ?? DEFAULT_HOURS[day];
      return { ...prev, [day]: { ...d, [field]: value } };
    });

  const save = () => {
    startTransition(async () => {
      await saveWorkingHours(hours);
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {DAYS.map((day) => {
          const d = hours[day] ?? DEFAULT_HOURS[day];
          return (
            <div key={day} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(day)}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors shrink-0",
                  d.enabled ? "bg-primary" : "bg-muted",
                )}
                aria-pressed={d.enabled}
              >
                <span
                  className={cn(
                    "block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1",
                    d.enabled ? "ltr:translate-x-4 rtl:-translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
              <span className={cn("w-24 text-sm shrink-0", !d.enabled && "text-muted-foreground")}>
                {t.days[day]}
              </span>
              <div className={cn("flex items-center gap-2", !d.enabled && "opacity-40 pointer-events-none")}>
                <input
                  type="time"
                  value={d.open}
                  onChange={(e) => setTime(day, "open", e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="time"
                  value={d.close}
                  onChange={(e) => setTime(day, "close", e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={save} disabled={isPending} size="sm">
        {isPending ? t.saving : t.save}
      </Button>
    </div>
  );
};
