/**
 * Uzbekistan phone handling (+998). Normalized E.164 is used for search and
 * dedup; the original spelling is kept separately by callers. Contacts are
 * masked when the viewer lacks the access level (§34.1, §18.2).
 */

const UZ_COUNTRY = "998";

/** Returns "+998XXXXXXXXX" or null when the input is not a plausible UZ number. */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national: string;
  if (digits.length === 12 && digits.startsWith(UZ_COUNTRY)) national = digits.slice(3);
  else if (digits.length === 9) national = digits;
  else if (digits.length === 10 && digits.startsWith("8")) national = digits.slice(1);
  else return null;
  // Two-digit operator/area code followed by seven digits; codes never start with 0.
  if (!/^[1-9]\d{8}$/.test(national)) return null;
  return `+${UZ_COUNTRY}${national}`;
}

/** "+998 90 174 54 55" */
export function formatUzPhone(e164: string): string {
  const normalized = normalizeUzPhone(e164);
  if (!normalized) return e164;
  const n = normalized.slice(4);
  return `+998 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/** "+998 90 *** ** 55" — keeps operator code and last two digits for recognition. */
export function maskUzPhone(e164: string): string {
  const normalized = normalizeUzPhone(e164);
  if (!normalized) return "••• •• ••";
  const n = normalized.slice(4);
  return `+998 ${n.slice(0, 2)} *** ** ${n.slice(7, 9)}`;
}

/** `tel:` href for click-to-call. */
export function telHref(e164: string): string {
  return `tel:${normalizeUzPhone(e164) ?? e164.replace(/[^\d+]/g, "")}`;
}
