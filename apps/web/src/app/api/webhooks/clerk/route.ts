import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { z } from "zod";
import { db } from "@rudd/db";
import { tenants, agentSettings } from "@rudd/db";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

const orgEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
  }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.clerk.CLERK_WEBHOOK_SECRET;
  const headersList = await headers();

  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const rawBody = await request.text();

  let payload: z.infer<typeof orgEventSchema>;
  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    payload = orgEventSchema.parse(verified);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (payload.type === "organization.created") {
    const { id: clerkOrgId, name } = payload.data;

    await db
      .insert(tenants)
      .values({ clerkOrgId, name })
      .onConflictDoNothing({ target: tenants.clerkOrgId });

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkOrgId, clerkOrgId))
      .limit(1);

    if (tenant) {
      await db
        .insert(agentSettings)
        .values({
          tenantId: tenant.id,
          businessName: name,
          timezone: "UTC",
          workingHours: { Mon: "9am-5pm", Tue: "9am-5pm", Wed: "9am-5pm", Thu: "9am-5pm", Fri: "9am-5pm" },
          services: [],
        })
        .onConflictDoNothing({ target: agentSettings.tenantId });
    }
  }

  return NextResponse.json({ ok: true });
}
