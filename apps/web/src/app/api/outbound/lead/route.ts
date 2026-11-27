import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { db, contacts, conversations, messages, waAccounts, withTenant } from "@rudd/db";
import { decrypt } from "@/server/crypto";
import { safeEqual } from "@/server/safe-equal";
import { normalizePhone } from "@/server/whatsapp/phone";
import {
  isOutsideServiceWindowError,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  WhatsAppApiError,
} from "@/server/whatsapp/client";

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

const leadSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().min(8).max(32),
    // Free text: only deliverable inside the 24h customer-service window.
    message: z.string().min(1).max(4096).optional(),
    // Approved template: required to open a conversation with a cold lead.
    template: z
      .object({
        name: z.string().min(1).max(512),
        language: z.string().min(2).max(15).default("en"),
        components: z.array(z.unknown()).optional(),
      })
      .optional(),
    leadData: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => v.message || v.template, { message: "Provide `message` or `template`" });

const error = (status: number, code: string, extra: Record<string, unknown> = {}): NextResponse =>
  NextResponse.json({ error: code, ...extra }, { status });

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authorization = req.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${env.leadHunter.LEADHUNTER_API_KEY}`)) {
    return error(401, "unauthorized");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid_json");
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return error(400, "invalid_request", { details: parsed.error.flatten() });

  const { name, message, template, leadData } = parsed.data;
  const waId = normalizePhone(parsed.data.phone);
  if (!waId) return error(400, "invalid_phone", { hint: "Use international format, e.g. +201001234567" });

  const tenantId = env.leadHunter.LEADHUNTER_TENANT_ID;

  try {
    const [waAccount] = await db
      .select({ phoneNumberId: waAccounts.phoneNumberId, encryptedAccessToken: waAccounts.encryptedAccessToken })
      .from(waAccounts)
      .where(withTenant(tenantId, waAccounts.tenantId))
      .limit(1);
    if (!waAccount) return error(404, "whatsapp_not_connected");

    const [existing] = await db
      .select({ qualificationData: contacts.qualificationData })
      .from(contacts)
      .where(and(withTenant(tenantId, contacts.tenantId), eq(contacts.waId, waId)))
      .limit(1);

    const qualificationData = {
      ...((existing?.qualificationData as Record<string, unknown> | undefined) ?? {}),
      ...(leadData ?? {}),
      source: "leadhunter",
    };

    const [contact] = await db
      .insert(contacts)
      .values({ tenantId, waId, name, leadStatus: "new", qualificationData })
      .onConflictDoUpdate({
        target: [contacts.tenantId, contacts.waId],
        set: { name, qualificationData, updatedAt: new Date() },
      })
      .returning({ id: contacts.id });
    if (!contact) throw new Error("Failed to upsert contact");

    const [conversation] = await db
      .insert(conversations)
      .values({ tenantId, contactId: contact.id, lastMessageAt: new Date() })
      .onConflictDoUpdate({
        target: [conversations.tenantId, conversations.contactId],
        set: { lastMessageAt: new Date() },
      })
      .returning({ id: conversations.id });
    if (!conversation) throw new Error("Failed to upsert conversation");

    const [lastInbound] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          withTenant(tenantId, messages.tenantId),
          eq(messages.conversationId, conversation.id),
          eq(messages.direction, "inbound"),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const windowOpen = !!lastInbound && Date.now() - lastInbound.createdAt.getTime() < SERVICE_WINDOW_MS;

    if (!template && !windowOpen) {
      return error(422, "template_required", {
        hint: "This contact has not messaged in the last 24 hours; WhatsApp only allows approved templates.",
        contactId: contact.id,
      });
    }

    const accessToken = await decrypt(waAccount.encryptedAccessToken);
    const credentials = { to: waId, phoneNumberId: waAccount.phoneNumberId, accessToken };

    let sent: Awaited<ReturnType<typeof sendWhatsAppMessage>>;
    let storedBody: string;
    try {
      if (template) {
        sent = await sendWhatsAppTemplate({ ...credentials, template });
        storedBody = message ?? `[Template: ${template.name}]`;
      } else {
        sent = await sendWhatsAppMessage({ ...credentials, body: message ?? "" });
        storedBody = message ?? "";
      }
    } catch (err) {
      if (isOutsideServiceWindowError(err)) return error(422, "template_required", { contactId: contact.id });
      if (err instanceof WhatsAppApiError && err.status >= 400 && err.status < 500) {
        return error(502, "whatsapp_rejected", { whatsappErrorCode: err.code ?? null });
      }
      throw err;
    }

    const whatsappMessageId = sent.messages[0]?.id ?? null;
    await db.insert(messages).values({
      tenantId,
      conversationId: conversation.id,
      waMessageId: whatsappMessageId,
      direction: "outbound",
      role: "assistant",
      body: storedBody,
    });

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappMessageId,
      sentAs: template ? "template" : "text",
    });
  } catch (err) {
    console.error("[lead-hunter] outbound lead error:", err instanceof Error ? err.message : "unknown");
    return error(500, "send_failed");
  }
};
