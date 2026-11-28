import "server-only";
import { env } from "@/lib/env";

type EscalationPayload = {
  contactName: string | null;
  contactWaId: string;
  conversationId: string;
  tenantName: string;
  notificationEmail: string | null;
  reason?: string;
};

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

export const buildEscalationEmail = (
  payload: EscalationPayload,
  appUrl: string,
): { subject: string; html: string } => {
  const displayName = payload.contactName ?? payload.contactWaId;
  const link = `${appUrl.replace(/\/$/, "")}/dashboard/conversations/${encodeURIComponent(payload.conversationId)}`;
  return {
    // Strip CR/LF so a crafted WhatsApp profile name can't inject headers.
    subject: `Conversation needs attention — ${displayName}`.replace(/[\r\n]+/g, " "),
    html: `
      <p>A conversation for <strong>${escapeHtml(payload.tenantName)}</strong> needs your attention. The AI assistant has paused for this customer.</p>
      <p><strong>Customer:</strong> ${escapeHtml(displayName)}</p>
      <p><strong>WhatsApp:</strong> ${escapeHtml(payload.contactWaId)}</p>
      ${payload.reason ? `<p><strong>Reason:</strong> ${escapeHtml(payload.reason)}</p>` : ""}
      <a href="${escapeHtml(link)}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">
        View conversation
      </a>
    `,
  };
};

export const sendEscalationEmail = async (payload: EscalationPayload): Promise<void> => {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL } = env.notifications;
  if (!RESEND_API_KEY || !payload.notificationEmail) return;

  const { subject, html } = buildEscalationEmail(payload, NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: payload.notificationEmail, subject, html }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error(`[notifications] email send failed with status ${res.status}`);
  } catch (err) {
    console.error("[notifications] email send failed:", err instanceof Error ? err.message : "unknown");
  }
};
