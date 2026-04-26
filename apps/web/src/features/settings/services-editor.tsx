"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveServices } from "./actions";
import type { T } from "@/lib/i18n/translations";

type Service = { id: string; name: string; duration_minutes: number };

type Props = {
  initial: Service[];
  t: T["settings"]["services"];
};

export const ServicesEditor = ({ initial, t }: Props) => {
  const [services, setServices] = useState<Service[]>(initial);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [isPending, startTransition] = useTransition();

  const add = () => {
    const trimmed = name.trim();
    const dur = parseInt(duration, 10);
    if (!trimmed || !dur) return;
    setServices((prev) => [
      ...prev,
      { id: `${trimmed.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`, name: trimmed, duration_minutes: dur },
    ]);
    setName("");
    setDuration("30");
  };

  const save = () => {
    startTransition(async () => {
      await saveServices(services);
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {services.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        )}
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{s.name} — {s.duration_minutes} {t.durationUnit}</span>
            <button
              type="button"
              onClick={() => setServices((prev) => prev.filter((x) => x.id !== s.id))}
              className="text-muted-foreground hover:text-destructive text-xs ms-4"
            >
              {t.remove}
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1"
        />
        <Input
          type="number"
          placeholder={t.durationPlaceholder}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-20"
          min="5"
        />
        <Button type="button" variant="outline" onClick={add}>{t.add}</Button>
      </div>

      <Button onClick={save} disabled={isPending} size="sm">
        {isPending ? t.saving : t.save}
      </Button>
    </div>
  );
};
