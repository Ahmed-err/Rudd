import "server-only";

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const TIMEOUT_MS = 8_000;
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

type WhatsAppSendResponse = {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
};

export class WhatsAppApiError extends Error {
  override readonly name = "WhatsAppApiError";
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | undefined,
  ) {
    super(message);
  }
}

// 131047: more than 24h since the customer last wrote; only templates can be sent.
export const isOutsideServiceWindowError = (err: unknown): boolean =>
  err instanceof WhatsAppApiError && err.code === 131047;

const graphFetch = async (url: string, accessToken: string, init: RequestInit = {}): Promise<Response> => {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new WhatsAppApiError(`WhatsApp request timed out after ${TIMEOUT_MS}ms`, 0, undefined);
    }
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    let code: number | undefined;
    try {
      code = (JSON.parse(text) as { error?: { code?: number } }).error?.code;
    } catch {}
    throw new WhatsAppApiError(`WhatsApp request failed: ${res.status} ${text.slice(0, 500)}`, res.status, code);
  }
  return res;
};

const postMessage = async (
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<WhatsAppSendResponse> => {
  const res = await graphFetch(`${BASE_URL}/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
  });
  return res.json() as Promise<WhatsAppSendResponse>;
};

type Credentials = { phoneNumberId: string; accessToken: string };

export const sendWhatsAppMessage = async ({
  to,
  body,
  phoneNumberId,
  accessToken,
}: Credentials & { to: string; body: string }): Promise<WhatsAppSendResponse> =>
  postMessage(phoneNumberId, accessToken, {
    to,
    type: "text",
    text: { preview_url: false, body },
  });

export type TemplateInput = {
  name: string;
  language: string;
  components?: unknown[] | undefined;
};

export const sendWhatsAppTemplate = async ({
  to,
  template,
  phoneNumberId,
  accessToken,
}: Credentials & { to: string; template: TemplateInput }): Promise<WhatsAppSendResponse> =>
  postMessage(phoneNumberId, accessToken, {
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(template.components?.length ? { components: template.components } : {}),
    },
  });

export const downloadWhatsAppMedia = async (
  mediaId: string,
  accessToken: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> => {
  const metaRes = await graphFetch(`${BASE_URL}/${encodeURIComponent(mediaId)}`, accessToken);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!meta.url) throw new Error("WhatsApp media has no download URL");
  if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) throw new Error("WhatsApp media too large");

  const fileRes = await graphFetch(meta.url, accessToken);
  return { bytes: await fileRes.arrayBuffer(), mimeType: meta.mime_type ?? "application/octet-stream" };
};

// Confirms the token can act on this phone number before we store it.
export const verifyPhoneNumberAccess = async ({ phoneNumberId, accessToken }: Credentials): Promise<void> => {
  await graphFetch(`${BASE_URL}/${encodeURIComponent(phoneNumberId)}?fields=id`, accessToken);
};
