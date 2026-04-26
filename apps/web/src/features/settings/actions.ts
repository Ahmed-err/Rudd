"use server";

import { getSessionTenant } from "@/lib/session";
import { db, agentSettings, waAccounts } from "@rudd/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encrypt } from "@/server/crypto";

const settingsSchema = z.object({
  businessName: z.string().min(1),
  timezone: z.string().min(1).default("UTC"),
  systemPromptOverride: z.string().optional(),
});

export const saveAgentSettings = async (formData: FormData): Promise<void> => {
  const { tenantId } = await getSessionTenant();

  const parsed = settingsSchema.safeParse({
    businessName: formData.get("businessName"),
    timezone: formData.get("timezone"),
    systemPromptOverride: formData.get("systemPromptOverride") || undefined,
  });

  if (!parsed.success) throw new Error("Invalid form data");

  await db
    .update(agentSettings)
    .set({
      businessName: parsed.data.businessName,
      timezone: parsed.data.timezone,
      systemPromptOverride: parsed.data.systemPromptOverride ?? null,
      updatedAt: new Date(),
    })
    .where(eq(agentSettings.tenantId, tenantId));

  revalidatePath("/dashboard/settings");
};

const waCredentialsSchema = z.object({
  phoneNumberId: z.string().min(1),
  businessAccountId: z.string().min(1),
  accessToken: z.string().min(1),
});

export const saveWhatsAppCredentials = async (input: unknown): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  const { phoneNumberId, businessAccountId, accessToken } = waCredentialsSchema.parse(input);
  const encryptedAccessToken = await encrypt(accessToken);

  await db.delete(waAccounts).where(eq(waAccounts.tenantId, tenantId));
  await db.insert(waAccounts).values({ tenantId, phoneNumberId, businessAccountId, encryptedAccessToken });

  revalidatePath("/dashboard/settings");
};

export const disconnectWhatsApp = async (): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  await db.delete(waAccounts).where(eq(waAccounts.tenantId, tenantId));
  revalidatePath("/dashboard/settings");
};

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const workingHoursSchema = z.object({
  mon: dayScheduleSchema,
  tue: dayScheduleSchema,
  wed: dayScheduleSchema,
  thu: dayScheduleSchema,
  fri: dayScheduleSchema,
  sat: dayScheduleSchema,
  sun: dayScheduleSchema,
});

export const saveWorkingHours = async (hours: unknown): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  const parsed = workingHoursSchema.parse(hours);

  await db
    .update(agentSettings)
    .set({ workingHours: parsed, updatedAt: new Date() })
    .where(eq(agentSettings.tenantId, tenantId));

  revalidatePath("/dashboard/settings");
};

const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive(),
});

export const saveServices = async (services: unknown[]): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  const parsed = z.array(serviceSchema).parse(services);

  await db
    .update(agentSettings)
    .set({ services: parsed, updatedAt: new Date() })
    .where(eq(agentSettings.tenantId, tenantId));

  revalidatePath("/dashboard/settings");
};
