import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getAgentSettings, hasGoogleConnected, getWhatsAppAccount } from "@/features/settings/queries";
import { AgentSettingsForm } from "@/features/settings/agent-settings-form";
import { ServicesEditor } from "@/features/settings/services-editor";
import { WorkingHoursEditor } from "@/features/settings/working-hours-editor";
import { WhatsAppSetup } from "@/features/settings/whatsapp-setup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);
  const { success, error } = await searchParams;

  const [settings, googleConnected, waAccount] = await Promise.all([
    getAgentSettings(tenantId),
    hasGoogleConnected(tenantId),
    getWhatsAppAccount(tenantId),
  ]);

  const services = Array.isArray(settings?.services)
    ? (settings.services as Array<{ id: string; name: string; duration_minutes: number }>)
    : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      {success === "google_connected" && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
          {t.settings.integrations.successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-800">
          {error === "google_denied" ? t.settings.integrations.errorDenied : error === "google_exchange" ? t.settings.integrations.errorGeneric : (decodeURIComponent(error) || t.settings.integrations.errorGeneric)}
        </div>
      )}

      <Tabs defaultValue="agent">
        <TabsList>
          <TabsTrigger value="agent">{t.settings.tabs.agent}</TabsTrigger>
          <TabsTrigger value="services">{t.settings.tabs.services}</TabsTrigger>
          <TabsTrigger value="hours">{t.settings.tabs.hours}</TabsTrigger>
          <TabsTrigger value="integrations">{t.settings.tabs.integrations}</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.agent.title}</CardTitle>
              <CardDescription>{t.settings.agent.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <AgentSettingsForm settings={settings} t={t.settings.agent} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.services.title}</CardTitle>
              <CardDescription>{t.settings.services.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ServicesEditor initial={services} t={t.settings.services} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.hours.title}</CardTitle>
              <CardDescription>{t.settings.hours.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkingHoursEditor initial={settings?.workingHours} t={t.settings.hours} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.integrations.waTitle}</CardTitle>
              <CardDescription>{t.settings.integrations.waDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsAppSetup connected={waAccount} t={t.settings.integrations} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.settings.integrations.calendarTitle}</CardTitle>
              <CardDescription>{t.settings.integrations.calendarDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {googleConnected ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-700 font-medium">{t.settings.integrations.connected}</span>
                  <a href="/api/oauth/google">
                    <Button variant="outline" size="sm">{t.settings.integrations.reconnect}</Button>
                  </a>
                </div>
              ) : (
                <a href="/api/oauth/google">
                  <Button>{t.settings.integrations.connect}</Button>
                </a>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
