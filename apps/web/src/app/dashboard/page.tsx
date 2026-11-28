import Link from "next/link";
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleAlert,
  MessagesSquare,
  Send,
} from "lucide-react";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getDashboardData } from "@/features/dashboard/queries";
import { BookingsChart } from "@/features/dashboard/bookings-chart";
import { AutoRefresh } from "@/features/conversations/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";

export default async function DashboardPage() {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);
  const data = await getDashboardData(tenantId);
  const d = t.dashboard;
  const isNew = data.stats.conversations30d === 0 && data.stats.upcoming === 0 && data.stats.bookings30d === 0;

  const fmtWhen = (date: Date) =>
    new Intl.DateTimeFormat(t.locale, {
      timeZone: data.timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={30000} />
      <PageHeader title={d.title} description={d.subtitle} />

      {isNew && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-accent/50 p-5">
          <p className="font-medium">{d.gettingStarted}</p>
          <p className="mt-1 text-sm text-muted-foreground">{d.emptyHint}</p>
          <Link href="/dashboard/settings" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            {t.nav.settings}
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.last30}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label={d.bookings30d} value={data.stats.bookings30d} icon={<CalendarCheck className="size-4" />} />
          <StatTile label={d.upcoming} value={data.stats.upcoming} icon={<CalendarClock className="size-4" />} />
          <StatTile label={d.conversations30d} value={data.stats.conversations30d} icon={<MessagesSquare className="size-4" />} />
          <StatTile label={d.messagesSent30d} value={data.stats.aiReplies30d} icon={<Send className="size-4" />} />
          <StatTile label={d.cancellations30d} value={data.stats.cancellations30d} icon={<CalendarX className="size-4" />} />
          <StatTile
            label={d.needsAttention}
            value={data.stats.needsAttention}
            icon={<CircleAlert className="size-4" />}
            tone={data.stats.needsAttention ? "warning" : "default"}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BookingsChart
            data={data.bookingsByDay}
            locale={t.locale}
            title={d.chartTitle}
            totalLabel={d.chartTotal}
            barLabel={d.bookingsOn}
          />
        </div>

        <section className="rounded-xl border bg-card shadow-xs lg:col-span-2">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-medium">{d.nextAppointments}</h2>
            <Link href="/dashboard/appointments" className="text-xs font-medium text-primary hover:underline">
              {d.viewAll}
            </Link>
          </header>
          {data.nextAppointments.length ? (
            <ul className="divide-y">
              {data.nextAppointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.contactName ?? a.contactWaId}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.serviceName}</p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtWhen(a.startAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{d.noUpcoming}</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-card shadow-xs">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="size-4 text-amber-600" aria-hidden />
            {d.attentionTitle}
          </h2>
          <Link href="/dashboard/conversations?status=escalated" className="text-xs font-medium text-primary hover:underline">
            {d.viewAll}
          </Link>
        </header>
        {data.attention.length ? (
          <ul className="divide-y">
            {data.attention.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.contactName ?? c.contactWaId}</p>
                    <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">+{c.contactWaId}</p>
                  </div>
                  {c.status === "escalated" ? (
                    <StatusBadge status="escalated" label={t.conversations.filter.escalated} />
                  ) : (
                    <StatusBadge status="paused" label={d.aiPaused} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">{d.attentionEmpty}</p>
        )}
      </section>
    </div>
  );
}
