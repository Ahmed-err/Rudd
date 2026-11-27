import "server-only";

// Meta's wa_id is the E.164 number without "+", so contacts must be stored the same way
// or one person ends up as two contacts.
export const normalizePhone = (input: string): string | null => {
  let digits = input.trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
};
