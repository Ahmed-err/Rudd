import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Hashing first gives equal-length buffers, so the comparison never leaks the expected length.
export const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
