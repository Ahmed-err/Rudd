import "server-only";
import { db, agentSettings, googleAccounts, waAccounts } from "@rudd/db";
import { eq } from "drizzle-orm";

export type AgentSettingsRow = {
  id: string;
  businessName: string;
  timezone: string;
  workingHours: unknown;
  services: unknown;
  systemPromptOverride: string | null;
};

export const getAgentSettings = async (tenantId: string): Promise<AgentSettingsRow | null> => {
  const [row] = await db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.tenantId, tenantId))
    .limit(1);
  return row ?? null;
};

export const getWhatsAppAccount = async (tenantId: string): Promise<{ phoneNumberId: string } | null> => {
  const [row] = await db
    .select({ phoneNumberId: waAccounts.phoneNumberId })
    .from(waAccounts)
    .where(eq(waAccounts.tenantId, tenantId))
    .limit(1);
  return row ?? null;
};

export const hasGoogleConnected = async (tenantId: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.tenantId, tenantId))
    .limit(1);
  return !!row;
};
