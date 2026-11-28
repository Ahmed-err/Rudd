"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWhatsAppCredentials, disconnectWhatsApp } from "./actions";
import type { T } from "@/lib/i18n/translations";

type Props = {
  connected: { phoneNumberId: string } | null;
  t: T["settings"]["integrations"];
};

export const WhatsAppSetup = ({ connected, t }: Props) => {
  const [showForm, setShowForm] = useState(!connected);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      const result = await saveWhatsAppCredentials({ phoneNumberId, businessAccountId, accessToken });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPhoneNumberId("");
      setBusinessAccountId("");
      setAccessToken("");
      setShowForm(false);
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectWhatsApp();
    });
  };

  if (connected && !showForm) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-green-700 font-medium">
          {t.waConnectedLabel} · {connected.phoneNumberId}
        </span>
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)} disabled={isPending}>
          {t.reconnect}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={isPending}
          className="text-destructive hover:text-destructive">
          {t.waDisconnect}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-sm">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      <div className="space-y-1">
        <Label>{t.waPhoneNumberId}</Label>
        <Input
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder={t.waPhoneNumberIdPlaceholder}
        />
      </div>
      <div className="space-y-1">
        <Label>{t.waBusinessAccountId}</Label>
        <Input
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          placeholder={t.waBusinessAccountIdPlaceholder}
        />
      </div>
      <div className="space-y-1">
        <Label>{t.waAccessToken}</Label>
        <Input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={t.waAccessTokenPlaceholder}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isPending || !phoneNumberId || !businessAccountId || !accessToken}
          size="sm"
        >
          {isPending ? t.waConnecting : t.waConnect}
        </Button>
        {connected && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
