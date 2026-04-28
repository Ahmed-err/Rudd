import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { db, conversations, appointments } from "@rudd/db";
import { eq, and, gte, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/features/conversations/auto-refresh";

export default async function DashboardPage() {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeConvs, escalatedConvs, todayAppts, totalAppts] = await Promise.all([
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.status, "active")))
      .catch(() => [{ count: 0 }]),
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.status, "escalated")))
      .catch(() => [{ count: 0 }]),
    db.select({ count: count() }).from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), gte(appointments.startAt, today)))
      .catch(() => [{ count: 0 }]),
    db.select({ count: count() }).from(appointments)
      .where(eq(appointments.tenantId, tenantId))
      .catch(() => [{ count: 0 }]),
  ]);

  const stats = [
    { label: t.dashboard.activeConversations, value: activeConvs[0]?.count ?? 0, color: "text-green-600" },
    { label: t.dashboard.escalated, value: escalatedConvs[0]?.count ?? 0, color: "text-red-600" },
    { label: t.dashboard.upcomingAppointments, value: todayAppts[0]?.count ?? 0, color: "text-blue-600" },
    { label: t.dashboard.totalAppointments, value: totalAppts[0]?.count ?? 0, color: "text-foreground" },
  ];

  const isNew = stats.every((s) => s.value === 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <AutoRefresh intervalMs={30000} />
      <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isNew && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.gettingStarted}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.dashboard.emptyHint}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/settings?tab=integrations"
                className="text-sm text-primary hover:underline">{t.nav.settings}</Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/dashboard/conversations"
                className="text-sm text-primary hover:underline">{t.nav.conversations}</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
