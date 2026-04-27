import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listAppointments } from "@/features/appointments/queries";
import { CancelButton } from "@/features/appointments/cancel-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AppointmentsPage() {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);
  const appts = await listAppointments(tenantId);

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t.appointments.title}</h1>
      {appts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.appointments.empty}</p>
      ) : (
        <div className="rounded-md border">
          <Table className="table-fixed w-full">
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
                  <TableCell className="font-medium truncate">{a.contactName ?? a.contactWaId}</TableCell>
                  <TableCell className="truncate">{a.serviceId ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(a.startAt).toLocaleString(t.locale)} – {new Date(a.endAt).toLocaleTimeString(t.locale)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[a.status] ?? "bg-gray-100 text-gray-800"} variant="outline">
                      {t.appointments.status[a.status as keyof typeof t.appointments.status] ?? a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.gcalEventId
                      ? <span className="text-xs text-green-600">{t.appointments.synced}</span>
                      : <span className="text-xs text-muted-foreground">{t.appointments.notSynced}</span>}
                  </TableCell>
                  <TableCell className="">
                    {a.status === "scheduled" && (
                      <CancelButton
                        appointmentId={a.id}
                        label={t.appointments.cancel}
                        cancellingLabel={t.appointments.cancelling}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
