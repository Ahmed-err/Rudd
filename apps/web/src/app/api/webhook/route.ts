import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/server/inngest/client";
import { INCOMING_MESSAGE_EVENT, type IncomingMessageEventData } from "@/server/inngest/events";
import { extractInboundContent } from "@/server/whatsapp/inbound";
import { waWebhookPayloadSchema } from "@/server/whatsapp/schema";
import { verifyWhatsAppSignature } from "@/server/whatsapp/verify";
import { safeEqual } from "@/server/safe-equal";
import { db, webhookEvents } from "@rudd/db";
import { NextResponse, type NextRequest } from "next/server";

// GET — Meta webhook verification handshake
export const GET = (req: NextRequest): NextResponse => {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && challenge && safeEqual(token, env.whatsappWebhook.WHATSAPP_VERIFY_TOKEN)) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
};

// POST — inbound messages from Meta
export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  const valid = await verifyWhatsAppSignature(rawBody, signature, env.whatsappWebhook.META_APP_SECRET);
  if (!valid) {
    // Only unsigned traffic is throttled: Meta delivers from a small pool of IPs,
    // so limiting valid requests by IP would drop real messages at volume.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const status = rateLimit(`wa-invalid:${ip}`, 30, 60_000) ? 401 : 429;
    return NextResponse.json({ error: "Invalid signature" }, { status });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = waWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[webhook] unrecognised payload shape — acking anyway");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const events: Array<{ name: typeof INCOMING_MESSAGE_EVENT; id: string; data: IncomingMessageEventData }> = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const { messages, contacts, metadata } = change.value;
      for (const msg of messages ?? []) {
        const content = extractInboundContent(msg);
        if (!content) continue;

        const contactName = contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
        events.push({
          name: INCOMING_MESSAGE_EVENT,
          id: msg.id,
          data: {
            phoneNumberId: metadata.phone_number_id,
            waMessageId: msg.id,
            from: msg.from,
            ...(contactName ? { contactName } : {}),
            body: content.body,
            ...(content.kind === "audio" ? { audioMediaId: content.mediaId } : {}),
            timestamp: msg.timestamp,
          },
        });
      }
    }
  }

  if (events.length === 0) return NextResponse.json({ received: true }, { status: 200 });

  try {
    // Both sides are idempotent (unique waMessageId; Inngest dedupes by event id),
    // so a Meta retry after a partial failure cannot double-process.
    await Promise.all([
      inngest.send(events),
      db
        .insert(webhookEvents)
        .values(events.map((e) => ({ waMessageId: e.id, payload: json as Record<string, unknown> })))
        .onConflictDoNothing({ target: webhookEvents.waMessageId }),
    ]);
  } catch (err) {
    console.error("[webhook] enqueue/persist failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Enqueue failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
};
