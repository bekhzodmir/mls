import type { Currency, Money } from "./types";
import { intlLocale, type Locale } from "@/i18n/config";

/**
 * Exact money arithmetic on integer minor units (§34.1). Both USD and UZS use
 * two minor digits (cents / tiyin). Conversions between currencies require an
 * explicit rate and are always surfaced to the user as "converted".
 */

export const MINOR_DIGITS = 2;
const MINOR_FACTOR = 10 ** MINOR_DIGITS;

/** Builds Money from a major-unit amount given as a number or decimal string. */
export function money(amount: number | string, currency: Currency, raw?: string): Money {
  const amountMinor = toMinor(amount);
  return raw === undefined ? { amountMinor, currency } : { amountMinor, currency, raw };
}

/**
 * Converts a major-unit amount to minor units without float drift by working
 * on the decimal string ("1234.5" -> 123450).
 */
export function toMinor(amount: number | string): number {
  const text = typeof amount === "number" ? numberToPlainString(amount) : amount.trim();
  const match = /^(-)?(\d+)(?:[.,](\d+))?$/.exec(text);
  if (!match) throw new RangeError(`Not a decimal amount: "${amount}"`);
  const [, sign, whole, fraction = ""] = match;
  const cents = (fraction + "0".repeat(MINOR_DIGITS)).slice(0, MINOR_DIGITS);
  const roundUp = fraction.length > MINOR_DIGITS && Number(fraction[MINOR_DIGITS]) >= 5;
  const value = Number(whole) * MINOR_FACTOR + Number(cents) + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(value)) throw new RangeError(`Amount out of range: "${amount}"`);
  return sign ? -value : value;
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite amount: ${value}`);
  // toFixed avoids exponent notation for large/small values; 6 digits is ample for rounding.
  return value.toFixed(6).replace(/\.?0+$/, "");
}

/** Major units as a number — for display and ratios only, never for storage. */
export function toMajor(value: Money): number {
  return value.amountMinor / MINOR_FACTOR;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amountMinor === b.amountMinor ? 0 : a.amountMinor < b.amountMinor ? -1 : 1;
}

/** Percentage of an amount, rounded half-up to the nearest minor unit. */
export function percentOf(value: Money, percent: number): Money {
  const scaled = (value.amountMinor * Math.round(percent * 100)) / 10_000;
  return { amountMinor: Math.round(scaled), currency: value.currency };
}

/**
 * Exchange rates expressed as "UZS per 1 USD". Rates are configuration, not
 * facts: the demo default must be replaced by a rates provider before any
 * production use, and every converted comparison is flagged in the UI.
 */
export interface FxRates {
  uzsPerUsd: number;
  asOf: string;
}

export function convertMoney(value: Money, to: Currency, rates: FxRates): Money {
  if (value.currency === to) return value;
  const factor = value.currency === "USD" ? rates.uzsPerUsd : 1 / rates.uzsPerUsd;
  return { amountMinor: Math.round(value.amountMinor * factor), currency: to };
}

const currencySuffix: Record<Locale, Record<Currency, string>> = {
  ru: { USD: "$", UZS: "сум" },
  uz: { USD: "$", UZS: "so‘m" },
};

/**
 * "$85 000" / "4 500 000 сум" / "4 500 000 so‘m". Fractions are shown only when
 * present. `compact` gives "$85 тыс." / "$85 ming" style short forms for chips.
 */
export function formatMoney(
  locale: Locale,
  value: Money,
  options: { compact?: boolean; signed?: boolean } = {},
): string {
  const major = Math.abs(toMajor(value));
  const hasFraction = value.amountMinor % MINOR_FACTOR !== 0;
  const number = new Intl.NumberFormat(intlLocale[locale], {
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.compact ? 1 : hasFraction ? MINOR_DIGITS : 0,
    minimumFractionDigits: 0,
  }).format(major);
  const sign = value.amountMinor < 0 ? "−" : options.signed && value.amountMinor > 0 ? "+" : "";
  const suffix = currencySuffix[locale][value.currency];
  return value.currency === "USD" ? `${sign}$${number}` : `${sign}${number} ${suffix}`;
}

/**
 * "$70 000 – $95 000", "до $95 000", "от $70 000". The one-sided phrasings are
 * templates with an `{amount}` placeholder, because the word order differs:
 * «до $95 000» in Russian, «$95 000 gacha» in Uzbek.
 */
export function formatMoneyRange(
  locale: Locale,
  range: { min?: Money; max?: Money },
  templates: { from: string; to: string },
): string | undefined {
  const { min, max } = range;
  if (min && max) return `${formatMoney(locale, min)} – ${formatMoney(locale, max)}`;
  if (max) return templates.to.replace("{amount}", formatMoney(locale, max));
  if (min) return templates.from.replace("{amount}", formatMoney(locale, min));
  return undefined;
}
