"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { completeTenantSetup } from "../actions";
import type { T } from "@/lib/i18n/translations";

type Service = { id: string; name: string; duration_minutes: number };

type Props = {
  defaultBusinessName: string;
  t: T["onboarding"]["setup"];
};

export const SetupForm = ({ defaultBusinessName, t }: Props) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [timezone, setTimezone] = useState("UTC");
  const [services, setServices] = useState<Service[]>([
    { id: "consult", name: "Consultation", duration_minutes: 30 },
  ]);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [error, setError] = useState("");

  const addService = () => {
    const name = newName.trim();
    const dur = parseInt(newDuration, 10);
    if (!name || !dur) return;
    setServices((prev) => [
      ...prev,
      { id: `${name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`, name, duration_minutes: dur },
    ]);
    setNewName("");
    setNewDuration("30");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await completeTenantSetup({ businessName, timezone, services });
        router.push("/dashboard");
      } catch {
        setError(t.error);
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t.cardTitle}</CardTitle>
        <CardDescription>{t.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <div className="space-y-1">
            <Label htmlFor="businessName">{t.businessName}</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t.businessNamePlaceholder}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="timezone">{t.timezone}</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder={t.timezonePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label>{t.services}</Label>
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{s.name} — {s.duration_minutes} min</span>
                <button
                  type="button"
                  onClick={() => setServices((prev) => prev.filter((x) => x.id !== s.id))}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder={t.businessNamePlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="30"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-20"
                min="5"
              />
              <Button type="button" variant="outline" onClick={addService}>+</Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending || services.length === 0}>
            {isPending ? t.finishing : t.finish}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
