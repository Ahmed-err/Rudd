"use server";

import { getSessionTenant } from "@/lib/session";
import { db, agentSettings, withTenant } from "@rudd/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelAppointmentForTenant } from "@/server/appointments";

export const cancelAppointment = async (appointmentId: string): Promise<{ notified: boolean }> => {
  z.string().uuid().parse(appointmentId);
  const { tenantId } = await getSessionTenant();

  const [settings] = await db
    .select({ timezone: agentSettings.timezone })
    .from(agentSettings)
    .where(withTenant(tenantId, agentSettings.tenantId))
    .limit(1);

  const { notified } = await cancelAppointmentForTenant(tenantId, appointmentId, {
    notify: { timeZone: settings?.timezone ?? "UTC" },
  });

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
  return { notified };
};
