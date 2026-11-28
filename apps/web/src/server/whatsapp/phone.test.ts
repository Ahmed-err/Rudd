import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["+20 100 123 4567", "201001234567"],
    ["0020-100-123-4567", "201001234567"],
    ["(971) 50 123 4567", "971501234567"],
    ["201001234567", "201001234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+0123456789", "abc12345678", "1234567890123456"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
