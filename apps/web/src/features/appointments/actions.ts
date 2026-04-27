"use server";

import { getSessionTenant } from "@/lib/session";
import { db, appointments } from "@rudd/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const cancelAppointment = async (appointmentId: string): Promise<void> => {
  const { tenantId } = await getSessionTenant();

  await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)));

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
};
