import { env } from "@/lib/env";
import { inngest } from "@/server/inngest/client";
import { waWebhookPayloadSchema } from "@/server/whatsapp/schema";
import { verifyWhatsAppSignature } from "@/server/whatsapp/verify";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

// GET — Meta webhook verification handshake
export const GET = (req: NextRequest): NextResponse => {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === env.whatsappWebhook.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
};

// POST — inbound messages from Meta
// Returns 200 immediately; all heavy work runs in after() so Meta never times out.
export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`wa:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  const valid = await verifyWhatsAppSignature(
    rawBody,
    signature,
    env.whatsappWebhook.META_APP_SECRET,
  );
  if (!valid) {
    console.error("[webhook] invalid signature — rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = waWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[webhook] unrecognised payload shape — acking anyway", parsed.error.flatten());
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const events: Array<{ name: string; id: string; data: Record<string, unknown> }> = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const { messages, contacts, metadata } = change.value;
      if (!messages?.length) continue;

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text) continue;

        const contact = contacts?.find((c) => c.wa_id === msg.from);

        events.push({
          name: "wa/message.received",
          id: msg.id,
          data: {
            phoneNumberId: metadata.phone_number_id,
            waMessageId: msg.id,
            from: msg.from,
            contactName: contact?.profile.name,
            body: msg.text.body,
            timestamp: msg.timestamp,
          },
        });
      }
    }
  }

  console.log(`[webhook] parsed ${events.length} inbound text message(s), ${parsed.data.entry.flatMap(e => e.changes).flatMap(c => c.value.statuses ?? []).length} status update(s)`);

  if (events.length > 0) {
    console.log("[webhook] enqueuing to Inngest:", events.map(e => `${e.id} from=${e.data.from}`));

    // Fire-and-forget — 200 is already on its way to Meta, Inngest runs in background
    inngest
      .send(events as Parameters<typeof inngest.send>[0])
      .then((r) => console.log("[webhook] inngest.send() ok:", JSON.stringify(r)))
      .catch((err) => console.error("[webhook] inngest.send() FAILED:", err));
  }

  return NextResponse.json({ received: true }, { status: 200 });
};
