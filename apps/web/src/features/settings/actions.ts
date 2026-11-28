"use server";

import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { db, agentSettings, waAccounts, withTenant } from "@rudd/db";
import { serviceSchema, timezoneSchema, workingHoursSchema } from "@rudd/shared";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encrypt } from "@/server/crypto";
import { verifyPhoneNumberAccess } from "@/server/whatsapp/client";

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  timezone: timezoneSchema,
  systemPromptOverride: z.string().max(4000).optional(),
  notificationEmail: z.string().email().optional().or(z.literal("")),
});

export const saveAgentSettings = async (formData: FormData): Promise<void> => {
  const { tenantId } = await getSessionTenant();

  const parsed = settingsSchema.safeParse({
    businessName: formData.get("businessName"),
    timezone: formData.get("timezone") || "UTC",
    systemPromptOverride: formData.get("systemPromptOverride") || undefined,
    notificationEmail: formData.get("notificationEmail") || undefined,
  });

  if (!parsed.success) throw new Error("Invalid form data");

  await db
    .update(agentSettings)
    .set({
      businessName: parsed.data.businessName,
      timezone: parsed.data.timezone,
      systemPromptOverride: parsed.data.systemPromptOverride ?? null,
      notificationEmail: parsed.data.notificationEmail || null,
      updatedAt: new Date(),
    })
    .where(withTenant(tenantId, agentSettings.tenantId));

  revalidatePath("/dashboard/settings");
};

const waCredentialsSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,32}$/, "Phone Number ID must be numeric"),
  businessAccountId: z.string().trim().regex(/^\d{5,32}$/, "Business Account ID must be numeric"),
  accessToken: z.string().trim().min(20),
});

export type SaveWhatsAppResult = { ok: true } | { ok: false; error: string };

export const saveWhatsAppCredentials = async (input: unknown): Promise<SaveWhatsAppResult> => {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);
  const parsed = waCredentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.settings.integrations.waErrorInvalid };
  const { phoneNumberId, businessAccountId, accessToken } = parsed.data;

  const [taken] = await db
    .select({ id: waAccounts.id })
    .from(waAccounts)
    .where(and(eq(waAccounts.phoneNumberId, phoneNumberId), ne(waAccounts.tenantId, tenantId)))
    .limit(1);
  if (taken) return { ok: false, error: t.settings.integrations.waErrorInUse };

  try {
    await verifyPhoneNumberAccess({ phoneNumberId, accessToken });
  } catch {
    return { ok: false, error: t.settings.integrations.waErrorInvalid };
  }

  const encryptedAccessToken = await encrypt(accessToken);
  try {
    await db
      .insert(waAccounts)
      .values({ tenantId, phoneNumberId, businessAccountId, encryptedAccessToken })
      .onConflictDoUpdate({
        target: waAccounts.tenantId,
        set: { phoneNumberId, businessAccountId, encryptedAccessToken },
      });
  } catch {
    // Unique phone_number_id: another tenant claimed it between our check and insert.
    return { ok: false, error: t.settings.integrations.waErrorInUse };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
};

export const disconnectWhatsApp = async (): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  await db.delete(waAccounts).where(withTenant(tenantId, waAccounts.tenantId));
  revalidatePath("/dashboard/settings");
};

export const saveWorkingHours = async (hours: unknown): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  const parsed = workingHoursSchema.parse(hours);

  await db
    .update(agentSettings)
    .set({ workingHours: parsed, updatedAt: new Date() })
    .where(withTenant(tenantId, agentSettings.tenantId));

  revalidatePath("/dashboard/settings");
};

export const saveServices = async (services: unknown[]): Promise<void> => {
  const { tenantId } = await getSessionTenant();
  const parsed = z.array(serviceSchema).max(50).parse(services);

  await db
    .update(agentSettings)
    .set({ services: parsed, updatedAt: new Date() })
    .where(withTenant(tenantId, agentSettings.tenantId));

  revalidatePath("/dashboard/settings");
};
