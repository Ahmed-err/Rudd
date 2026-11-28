import "server-only";
import type { WaInboundMessage } from "./schema";

export type InboundContent =
  | { kind: "text"; body: string }
  | { kind: "audio"; mediaId: string; body: string };

const AUDIO_PLACEHOLDER = "[The customer sent a voice message that could not be transcribed]";

// Returns null for messages that need no reply (reactions, system notices, unknown types).
export const extractInboundContent = (msg: WaInboundMessage): InboundContent | null => {
  switch (msg.type) {
    case "text":
      return msg.text?.body.trim() ? { kind: "text", body: msg.text.body } : null;
    case "interactive": {
      const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
      return reply ? { kind: "text", body: reply.title } : null;
    }
    case "button":
      return msg.button ? { kind: "text", body: msg.button.text } : null;
    case "audio":
      return msg.audio ? { kind: "audio", mediaId: msg.audio.id, body: AUDIO_PLACEHOLDER } : null;
    case "location": {
      if (!msg.location) return null;
      const { latitude, longitude, name, address } = msg.location;
      const label = [name, address].filter(Boolean).join(", ");
      return { kind: "text", body: `[Shared location${label ? `: ${label}` : ""} (${latitude}, ${longitude})]` };
    }
    case "image":
    case "video":
    case "document": {
      const media = msg.type === "image" ? msg.image : msg.type === "video" ? msg.video : msg.document;
      const caption = media?.caption?.trim();
      const note = `[The customer sent a ${msg.type}, which you cannot view]`;
      return { kind: "text", body: caption ? `${caption}\n${note}` : note };
    }
    case "sticker":
      return { kind: "text", body: "[The customer sent a sticker]" };
    default:
      return null;
  }
};
