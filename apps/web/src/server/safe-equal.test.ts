import { describe, expect, it } from "vitest";
import { safeEqual } from "./safe-equal";

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });
  it("rejects different strings of equal length", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });
  it("rejects different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});
