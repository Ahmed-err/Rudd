"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveAgentSettings } from "./actions";
import type { AgentSettingsRow } from "./queries";
import type { T } from "@/lib/i18n/translations";

type Props = {
  settings: AgentSettingsRow | null;
  t: T["settings"]["agent"];
};

export const AgentSettingsForm = ({ settings, t }: Props) => {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveAgentSettings(fd);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="businessName">{t.businessName}</Label>
        <Input id="businessName" name="businessName" defaultValue={settings?.businessName ?? ""} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="timezone">{t.timezone}</Label>
        <Input id="timezone" name="timezone" defaultValue={settings?.timezone ?? "UTC"} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notificationEmail">{t.notificationEmail}</Label>
        <Input
          id="notificationEmail"
          name="notificationEmail"
          type="email"
          defaultValue={settings?.notificationEmail ?? ""}
          placeholder={t.notificationEmailPlaceholder}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="systemPromptOverride">{t.instructions}</Label>
        <Textarea
          id="systemPromptOverride"
          name="systemPromptOverride"
          defaultValue={settings?.systemPromptOverride ?? ""}
          placeholder={t.instructionsPlaceholder}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.saving : t.save}
      </Button>
    </form>
  );
};
