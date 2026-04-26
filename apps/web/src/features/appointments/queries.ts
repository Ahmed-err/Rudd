import "server-only";
import { db, appointments, contacts } from "@rudd/db";
import { eq, desc } from "drizzle-orm";

export type AppointmentRow = {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date;
  serviceId: string | null;
  notes: string | null;
  contactName: string | null;
  contactWaId: string;
  gcalEventId: string | null;
};

export const listAppointments = async (tenantId: string): Promise<AppointmentRow[]> =>
  db
    .select({
      id: appointments.id,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      serviceId: appointments.serviceId,
      notes: appointments.notes,
      gcalEventId: appointments.gcalEventId,
      contactName: contacts.name,
      contactWaId: contacts.waId,
    })
    .from(appointments)
    .innerJoin(contacts, eq(appointments.contactId, contacts.id))
    .where(eq(appointments.tenantId, tenantId))
    .orderBy(desc(appointments.startAt));
