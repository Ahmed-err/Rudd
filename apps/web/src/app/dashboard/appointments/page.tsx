import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listAppointments } from "@/features/appointments/queries";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.appointments.columns.customer}</TableHead>
                <TableHead>{t.appointments.columns.service}</TableHead>
                <TableHead>{t.appointments.columns.dateTime}</TableHead>
                <TableHead>{t.appointments.columns.status}</TableHead>
                <TableHead>{t.appointments.columns.calendar}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.contactName ?? a.contactWaId}</TableCell>
                  <TableCell>{a.serviceId ?? "—"}</TableCell>
                  <TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
