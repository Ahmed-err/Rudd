import { describe, expect, it } from "vitest";
import { extractInboundContent } from "./inbound";
import type { WaInboundMessage } from "./schema";

const base = { from: "201000000000", id: "wamid.1", timestamp: "1700000000" };

describe("extractInboundContent", () => {
  it("passes text through", () => {
    expect(extractInboundContent({ ...base, type: "text", text: { body: "hi" } })).toEqual({ kind: "text", body: "hi" });
  });

  it("ignores empty text", () => {
    expect(extractInboundContent({ ...base, type: "text", text: { body: "  " } })).toBeNull();
  });

  it("uses the title of interactive replies", () => {
    const msg: WaInboundMessage = {
      ...base,
      type: "interactive",
      interactive: { type: "button_reply", button_reply: { id: "b1", title: "Book now" } },
    };
    expect(extractInboundContent(msg)).toEqual({ kind: "text", body: "Book now" });
  });

  it("marks audio for transcription", () => {
    const result = extractInboundContent({ ...base, type: "audio", audio: { id: "media-1" } });
    expect(result).toMatchObject({ kind: "audio", mediaId: "media-1" });
  });

  it("describes images and keeps the caption", () => {
    const result = extractInboundContent({ ...base, type: "image", image: { id: "m", caption: "this one" } });
    expect(result?.body).toContain("this one");
    expect(result?.body).toContain("image");
  });

  it("ignores reactions and unknown types", () => {
    expect(extractInboundContent({ ...base, type: "reaction" })).toBeNull();
    expect(extractInboundContent({ ...base, type: "unsupported" })).toBeNull();
  });
});
