import { normalizeUzPhone } from "@/lib/domain/phone";

/**
 * Live state of a +998 phone field (§20.7 "Phone Input", §34.1). The person
 * may type any common spelling — "90 123 45 67", "+998 (90) 123-45-67",
 * "8 90 123 45 67"; `normalizeUzPhone` decides what is a complete number.
 *
 * - `empty` — nothing typed yet;
 * - `incomplete` — digits are still missing, so it is too early for an error;
 * - `invalid` — more digits cannot fix it (too long, starts with 0);
 * - `valid` — normalized to E.164.
 */
export type PhoneInputState =
  | { state: "empty" }
  | { state: "incomplete" }
  | { state: "invalid" }
  | { state: "valid"; e164: string };

export function phoneInputState(raw: string): PhoneInputState {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { state: "empty" };

  const e164 = normalizeUzPhone(raw);
  if (e164) return { state: "valid", e164 };

  const withCountry = digits.startsWith("998");
  const national = withCountry ? digits.slice(3) : digits;
  const tooShort = withCountry ? digits.length < 12 : digits.length < 9;
  // A national number never starts with 0, so more digits cannot help.
  if (tooShort && !national.startsWith("0")) return { state: "incomplete" };
  return { state: "invalid" };
}

export type PhoneProblem = "required" | "incomplete" | "invalid";

/** The problem that blocks submitting a required phone, or null when it is valid. */
export function phoneProblem(raw: string): PhoneProblem | null {
  const { state } = phoneInputState(raw);
  if (state === "valid") return null;
  if (state === "empty") return "required";
  return state;
}

export type PhoneMessage =
  | { tone: "hint"; key: "hint" | "incomplete" }
  | { tone: "error"; key: PhoneProblem }
  | { tone: "valid"; e164: string };

/**
 * What to say under the field. Missing digits are a hint while the person is
 * still typing and become an error after leaving the field (`touched`) or
 * trying to continue (`submitted`); an empty field is an error only after a
 * submit attempt (and never for an optional field), so tabbing through never
 * scolds; an impossible number is an error at once.
 */
export function phoneMessage(
  raw: string,
  { touched, submitted, required = true }: { touched: boolean; submitted: boolean; required?: boolean },
): PhoneMessage {
  const status = phoneInputState(raw);
  switch (status.state) {
    case "valid":
      return { tone: "valid", e164: status.e164 };
    case "invalid":
      return { tone: "error", key: "invalid" };
    case "incomplete":
      return touched || submitted ? { tone: "error", key: "incomplete" } : { tone: "hint", key: "incomplete" };
    case "empty":
      return submitted && required ? { tone: "error", key: "required" } : { tone: "hint", key: "hint" };
  }
}
