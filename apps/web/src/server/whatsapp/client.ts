import "server-only";

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type SendTextInput = {
  to: string;
  body: string;
  phoneNumberId: string;
  accessToken: string;
};

type WhatsAppSendResponse = {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
};

export const sendWhatsAppMessage = async ({
  to,
  body,
  phoneNumberId,
  accessToken,
}: SendTextInput): Promise<WhatsAppSendResponse> => {
  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<WhatsAppSendResponse>;
};
