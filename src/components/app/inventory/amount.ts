/**
 * A positive decimal amount in major units as people type it: "70000",
 * "70 000", "70000.50", "70000,5". Spaces are thousands separators; at most
 * two decimals (cents / tiyin). Anything else is rejected, never guessed.
 *
 * Kept dependency-free so client forms can import it cheaply.
 */
export function parseAmount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const compact = value.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(compact)) return undefined;
  const amount = Number(compact);
  return amount > 0 && Number.isFinite(amount) ? amount : undefined;
}
