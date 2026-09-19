import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { db, contacts, conversations, messages, waAccounts } from "@rudd/db";
import { decrypt } from "@/server/crypto";
import { sendWhatsAppMessage } from "@/server/whatsapp/client";

const leadSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(8).max(32),
  message: z.string().min(1).max(4096),
  leadData: z.record(z.string(), z.unknown()).optional(),
});

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  try {
    // 1. Authenticate LeadHunter
    const authorization = req.headers.get("authorization");

    if (authorization !== `Bearer ${env.leadHunter.API_KEY}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Parse request body
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 },
      );
    }

    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { name, phone, message, leadData } = parsed.data;

    const tenantId = env.leadHunter.TENANT_ID;

    // 3. Get the WhatsApp account for this tenant
    const [waAccount] = await db
      .select({
        phoneNumberId: waAccounts.phoneNumberId,
        encryptedAccessToken: waAccounts.encryptedAccessToken,
      })
      .from(waAccounts)
      .where(eq(waAccounts.tenantId, tenantId))
      .limit(1);

    if (!waAccount) {
      return NextResponse.json(
        { error: "WhatsApp account not connected" },
        { status: 404 },
      );
    }

    // 4. Find or create the contact
    const [existingContact] = await db
      .select({
        id: contacts.id,
        qualificationData: contacts.qualificationData,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.waId, phone),
        ),
      )
      .limit(1);

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;

      await db
        .update(contacts)
        .set({
          name,
          qualificationData: {
            ...(existingContact.qualificationData as Record<string, unknown>),
            ...(leadData ?? {}),
            source: "leadhunter",
          },
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId));
    } else {
      const [newContact] = await db
        .insert(contacts)
        .values({
          tenantId,
          waId: phone,
          name,
          leadStatus: "new",
          qualificationData: {
            ...(leadData ?? {}),
            source: "leadhunter",
          },
        })
        .returning({
          id: contacts.id,
        });

      if (!newContact) {
        throw new Error("Failed to create contact");
      }

      contactId = newContact.id;
    }

    // 5. Find or create conversation
    const [existingConversation] = await db
      .select({
        id: conversations.id,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.contactId, contactId),
        ),
      )
      .limit(1);

    let conversationId: string;

    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const [newConversation] = await db
        .insert(conversations)
        .values({
          tenantId,
          contactId,
          lastMessageAt: new Date(),
        })
        .returning({
          id: conversations.id,
        });

      if (!newConversation) {
        throw new Error("Failed to create conversation");
      }

      conversationId = newConversation.id;
    }

    // 6. Send WhatsApp message using Rudd's existing infrastructure
    const accessToken = await decrypt(
      waAccount.encryptedAccessToken,
    );

    const whatsappResult = await sendWhatsAppMessage({
      to: phone,
      body: message,
      phoneNumberId: waAccount.phoneNumberId,
      accessToken,
    });

    // 7. Save outbound message
    await db.insert(messages).values({
      tenantId,
      conversationId,
      direction: "outbound",
      role: "assistant",
      body: message,
    });

    // 8. Update conversation timestamp
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({
      success: true,
      contactId,
      conversationId,
      whatsappMessageId: whatsappResult.messages?.[0]?.id ?? null,
    });
  } catch (error) {
    console.error("[lead-hunter] outbound lead error:", error);

    return NextResponse.json(
      {
        error: "Failed to send lead message",
      },
      { status: 500 },
    );
  }
};
