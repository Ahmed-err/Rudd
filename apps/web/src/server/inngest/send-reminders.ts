import "server-only";
import {
  db,
  agentSettings,
  appointments,
  contacts,
  conversations,
  messages,
  waAccounts,
  withTenant,
} from "@rudd/db";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { parseServices } from "@rudd/shared";
import { inngest } from "./client";
import { planReminder } from "../reminders/plan";
import { decrypt } from "../crypto";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "../whatsapp/client";

const HOUR = 60 * 60_000;

type TenantReminderConfig = {
  tenantId: string;
  businessName: string;
  timeZone: string;
  hoursBefore: number;
  template: { name: string; language: string } | null;
  services: Array<{ id: string; name: string }>;
};

const listDueAppointments = async (cfg: TenantReminderConfig, now: Date) =>
  db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      createdAt: appointments.createdAt,
      serviceId: appointments.serviceId,
      contactId: appointments.contactId,
    })
    .from(appointments)
    .where(
      and(
        withTenant(cfg.tenantId, appointments.tenantId),
        eq(appointments.status, "scheduled"),
        isNull(appointments.reminderSentAt),
        gt(appointments.startAt, now),
        lt(appointments.startAt, new Date(now.getTime() + cfg.hoursBefore * HOUR)),
      ),
    )
    .limit(200);

const sendReminder = async (cfg: TenantReminderConfig, appointmentId: string): Promise<string> => {
  const now = new Date();
  // Claim first so overlapping runs can't both send.
  const [claimed] = await db
    .update(appointments)
    .set({ reminderSentAt: now })
    .where(
      and(
        withTenant(cfg.tenantId, appointments.tenantId),
        eq(appointments.id, appointmentId),
        eq(appointments.status, "scheduled"),
        isNull(appointments.reminderSentAt),
      ),
    )
    .returning({
      startAt: appointments.startAt,
      createdAt: appointments.createdAt,
      serviceId: appointments.serviceId,
      contactId: appointments.contactId,
    });
  if (!claimed) return "already_handled";

  const release = () =>
    db
      .update(appointments)
      .set({ reminderSentAt: null })
      .where(and(withTenant(cfg.tenantId, appointments.tenantId), eq(appointments.id, appointmentId)));

  try {
    const [row] = await db
      .select({
        waId: contacts.waId,
        name: contacts.name,
        conversationId: conversations.id,
        phoneNumberId: waAccounts.phoneNumberId,
        encryptedAccessToken: waAccounts.encryptedAccessToken,
      })
      .from(contacts)
      .innerJoin(conversations, eq(conversations.contactId, contacts.id))
      .innerJoin(waAccounts, eq(waAccounts.tenantId, contacts.tenantId))
      .where(and(withTenant(cfg.tenantId, contacts.tenantId), eq(contacts.id, claimed.contactId)))
      .limit(1);
    if (!row) return "no_whatsapp_or_conversation";

    const [lastInbound] = await db
      .select({ createdAt: messages.createdAt, body: messages.body })
      .from(messages)
      .where(
        and(
          withTenant(cfg.tenantId, messages.tenantId),
          eq(messages.conversationId, row.conversationId),
          eq(messages.direction, "inbound"),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const plan = planReminder({
      startAt: claimed.startAt,
      createdAt: claimed.createdAt,
      now,
      hoursBefore: cfg.hoursBefore,
      lastInboundAt: lastInbound?.createdAt ?? null,
      lastInboundBody: lastInbound?.body ?? null,
      customerName: row.name,
      businessName: cfg.businessName,
      serviceName: cfg.services.find((s) => s.id === claimed.serviceId)?.name ?? "appointment",
      timeZone: cfg.timeZone,
      template: cfg.template,
    });

    // Skipped reminders stay claimed: they would be skipped again on every run.
    if (plan.kind === "skip") return `skipped:${plan.reason}`;

    const accessToken = await decrypt(row.encryptedAccessToken);
    const credentials = { to: row.waId, phoneNumberId: row.phoneNumberId, accessToken };
    const sent =
      plan.kind === "text"
        ? await sendWhatsAppMessage({ ...credentials, body: plan.body })
        : await sendWhatsAppTemplate({ ...credentials, template: plan.template });

    await db.insert(messages).values({
      tenantId: cfg.tenantId,
      conversationId: row.conversationId,
      waMessageId: sent.messages[0]?.id ?? null,
      direction: "outbound",
      role: "assistant",
      body: plan.body,
    });
    return `sent:${plan.kind}`;
  } catch (err) {
    await release();
    throw err;
  }
};

export const sendAppointmentReminders = inngest.createFunction(
  {
    id: "send-appointment-reminders",
    triggers: [{ cron: "*/15 * * * *" }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ step }) => {
    // The one deliberately cross-tenant read: discovering which tenants opted in.
    // Everything after it is scoped to a single tenant.
    const tenants = await step.run("list-tenants", async () => {
      const rows = await db
        .select({
          tenantId: agentSettings.tenantId,
          businessName: agentSettings.businessName,
          timeZone: agentSettings.timezone,
          hoursBefore: agentSettings.reminderHoursBefore,
          templateName: agentSettings.reminderTemplateName,
          templateLanguage: agentSettings.reminderTemplateLanguage,
          services: agentSettings.services,
        })
        .from(agentSettings)
        .where(eq(agentSettings.remindersEnabled, true));
      return rows.map(
        (r): TenantReminderConfig => ({
          tenantId: r.tenantId,
          businessName: r.businessName,
          timeZone: r.timeZone,
          hoursBefore: r.hoursBefore,
          template: r.templateName ? { name: r.templateName, language: r.templateLanguage } : null,
          services: parseServices(r.services),
        }),
      );
    });

    const results: Record<string, number> = {};
    for (const cfg of tenants) {
      const due = await step.run(`due-${cfg.tenantId}`, async () =>
        (await listDueAppointments(cfg, new Date())).map((a) => a.id),
      );
      for (const appointmentId of due) {
        const outcome = await step.run(`remind-${appointmentId}`, () => sendReminder(cfg, appointmentId));
        results[outcome] = (results[outcome] ?? 0) + 1;
      }
    }
    return { tenants: tenants.length, results };
  },
);
