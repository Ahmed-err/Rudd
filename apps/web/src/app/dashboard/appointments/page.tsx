import { PageHeader } from "@/components/page-header";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listAppointments, countAppointments, APPOINTMENTS_PAGE_SIZE } from "@/features/appointments/queries";
import { CancelButton } from "@/features/appointments/cancel-button";
import { Pagination } from "@/components/pagination";
import { CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAgentSettings } from "@/features/settings/queries";
import { parseServices } from "@rudd/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ tenantId }, t, { page: pageParam }] = await Promise.all([
    getSessionTenant(),
    getT(),
    searchParams,
  ]);
  const page = Math.max(0, Number(pageParam ?? 0));
  const [appts, total, settings] = await Promise.all([
    listAppointments(tenantId, page),
    countAppointments(tenantId),
    getAgentSettings(tenantId),
  ]);
  const timeZone = settings?.timezone ?? "UTC";
  const services = parseServices(settings?.services);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name ?? id ?? "—";
  const fmtDate = new Intl.DateTimeFormat(t.locale, { timeZone, weekday: "short", day: "numeric", month: "short" });
  const fmtTime = new Intl.DateTimeFormat(t.locale, { timeZone, hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <PageHeader title={t.appointments.title} description={t.appointments.subtitle} />
      {appts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <CalendarDays className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t.appointments.empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table className="min-w-[44rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{t.appointments.columns.customer}</TableHead>
                <TableHead className="w-32">{t.appointments.columns.service}</TableHead>
                <TableHead className="w-52">{t.appointments.columns.dateTime}</TableHead>
                <TableHead className="w-28">{t.appointments.columns.status}</TableHead>
                <TableHead className="w-24">{t.appointments.columns.calendar}</TableHead>
                <TableHead className="w-24">{t.appointments.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium truncate">{a.contactName ?? `+${a.contactWaId}`}</TableCell>
                  <TableCell className="truncate">{serviceName(a.serviceId)}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    <span className="font-medium">{fmtDate.format(a.startAt)}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {fmtTime.format(a.startAt)}–{fmtTime.format(a.endAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={a.status}
                      label={t.appointments.status[a.status as keyof typeof t.appointments.status] ?? a.status}
                    />
                  </TableCell>
                  <TableCell>
                    {a.gcalEventId
                      ? <span className="text-xs text-emerald-700">{t.appointments.synced}</span>
                      : <span className="text-xs text-muted-foreground">{t.appointments.notSynced}</span>}
                  </TableCell>
                  <TableCell className="">
                    {a.status === "scheduled" && (
                      <CancelButton
                        appointmentId={a.id}
                        label={t.appointments.cancel}
                        cancellingLabel={t.appointments.cancelling}
                        confirmLabel={t.appointments.confirmCancel}
                        notNotifiedLabel={t.appointments.notNotified}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {appts.length > 0 && (
        <Pagination page={page} total={total} pageSize={APPOINTMENTS_PAGE_SIZE} searchParams={{}} />
      )}
    </div>
  );
}
