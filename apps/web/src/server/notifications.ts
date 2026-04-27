import "server-only";

type EscalationPayload = {
  contactName: string | null;
  contactWaId: string;
  conversationId: string;
  tenantName: string;
  notificationEmail: string | null;
};

export const sendEscalationEmail = async (payload: EscalationPayload): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const to = payload.notificationEmail; // each tenant sets their own email
  if (!apiKey || !to) return;

  const displayName = payload.contactName ?? payload.contactWaId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const link = `${appUrl}/dashboard/conversations/${payload.conversationId}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rudd <notifications@resend.dev>",
      to,
      subject: `⚠️ Conversation escalated — ${displayName}`,
      html: `
        <p>A conversation has been escalated and needs your attention.</p>
        <p><strong>Customer:</strong> ${displayName}</p>
        <p><strong>WhatsApp:</strong> ${payload.contactWaId}</p>
        <a href="${link}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">
          View Conversation
        </a>
      `,
    }),
  }).catch((err) => console.error("[notifications] email send failed:", err));
};
