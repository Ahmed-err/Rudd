"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveReminderSettings } from "./actions";
import type { T } from "@/lib/i18n/translations";

type Props = {
  initial: { enabled: boolean; hoursBefore: number; templateName: string | null; templateLanguage: string };
  t: T["settings"]["reminders"];
};

export const ReminderSettingsForm = ({ initial, t }: Props): ReactElement => {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hoursBefore, setHoursBefore] = useState(String(initial.hoursBefore));
  const [templateName, setTemplateName] = useState(initial.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(initial.templateLanguage);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (): void => {
    setStatus(null);
    startTransition(async () => {
      const result = await saveReminderSettings({ enabled, hoursBefore: Number(hoursBefore), templateName, templateLanguage });
      setStatus(result.ok ? { ok: true, message: t.saved } : { ok: false, message: result.error });
    });
  };

  return (
    <div className="space-y-5 max-w-lg">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 size-4 accent-primary"
        />
        <span>
          <span className="block text-sm font-medium">{t.enable}</span>
          <span className="block text-sm text-muted-foreground">{t.enableHint}</span>
        </span>
      </label>

      <div className="space-y-1">
        <Label htmlFor="hoursBefore">{t.hoursBefore}</Label>
        <Input
          id="hoursBefore"
          type="number"
          min={1}
          max={72}
          value={hoursBefore}
          onChange={(e) => setHoursBefore(e.target.value)}
          className="w-28"
          disabled={!enabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1">
          <Label htmlFor="templateName">{t.templateName}</Label>
          <Input
            id="templateName"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="appointment_reminder"
            disabled={!enabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="templateLanguage">{t.templateLanguage}</Label>
          <Input
            id="templateLanguage"
            value={templateLanguage}
            onChange={(e) => setTemplateLanguage(e.target.value)}
            placeholder="en"
            disabled={!enabled}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
        <p className="font-medium">{t.templateHelpTitle}</p>
        <p className="text-muted-foreground">{t.templateHelp}</p>
        <pre className="whitespace-pre-wrap rounded-md bg-background border p-3 text-xs" dir="ltr">
          {"Hi {{1}}, this is a reminder of your appointment at {{2}} on {{3}}. Reply to this message to reschedule or cancel."}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? t.saving : t.save}
        </Button>
        {status && (
          <span className={status.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{status.message}</span>
        )}
      </div>
    </div>
  );
};
