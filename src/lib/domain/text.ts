import { districts } from "./geo";
import { normalizeUzPhone } from "./phone";
import {
  districtIds,
  type Currency,
  type DealType,
  type DistrictId,
  type ParsedField,
  type PropertyType,
} from "./types";

/**
 * Text machinery shared by the requirement parser, the Telegram post parser
 * and duplicate detection (§13.2, §14.4, §35.5, §39.4).
 *
 * Client requests and Telegram posts mix Russian, Uzbek Latin and Uzbek
 * Cyrillic with inconsistent apostrophes, dashes and spaces. Every scanner
 * runs on `foldText()` output, which is *length-preserving*: index i in the
 * folded text is index i in the original, so evidence is always sliced from
 * the original text verbatim (§39.4 "raw span/evidence").
 *
 * Scanners return hits with spans. Callers mask consumed spans so one piece
 * of text is never read as two facts ("3 комнаты" is not also a price,
 * "метро Чиланзар" is a landmark, not a district).
 *
 * Nothing here guesses: a currency is reported only when the text names it,
 * and an amount without one stays currency-less (§35.5).
 */

/* ------------------------------------------------------------ folding */

const FOLD_MAP: Record<string, string> = {
  "\u0451": "\u0435", // ё → е
  "\u0401": "\u0435", // Ё → е
  "\u2018": "'", // ‘ in o‘ / g‘
  "\u2019": "'", // ’ tutuq belgisi
  "\u02bb": "'", // ʻ
  "\u02bc": "'", // ʼ
  "`": "'",
  "\u00b4": "'", // ´
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2012": "-", // figure dash
  "\u2013": "-", // en dash in "2–3 комнаты"
  "\u2014": "-", // em dash
  "\u2015": "-", // horizontal bar
  "\u2212": "-", // minus sign
  "\u00a0": " ", // no-break space
  "\u2007": " ", // figure space
  "\u2009": " ", // thin space
  "\u200a": " ", // hair space
  "\u200b": " ", // zero-width space
  "\u202f": " ", // narrow no-break space (thousands separator)
};

/**
 * Lower-cases, maps ё→е, unifies apostrophes (‘ ’ ʻ ʼ ` → ') and dashes
 * (– — − → -) and exotic spaces (NBSP, thin space → " "). One UTF-16 unit
 * in, one unit out, so spans map 1:1 onto the original string.
 */
export function foldText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const mapped = FOLD_MAP[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const lower = char.toLowerCase();
    out += lower.length === 1 ? lower : char;
  }
  return out;
}

/** No letter or digit immediately before (a Unicode-aware `\b`). */
export const WORD_START = String.raw`(?<![\p{L}\p{N}])`;
/** No letter or digit immediately after. */
export const WORD_END = String.raw`(?![\p{L}\p{N}])`;
/**
 * Start of a free-standing number: not glued to a letter, digit, decimal
 * separator or fraction ("4/9"), and not a numbered part of a name such as
 * "Юнусабад-19" or "Ц-5".
 */
export const NUMBER_START = String.raw`(?<![\p{L}\p{N}.,/])(?<!\p{L}-)`;

/** Global + Unicode regex from a source string. */
export function pattern(source: string): RegExp {
  return new RegExp(source, "gu");
}

/** Non-capturing alternation: anyOf("a", "b") → "(?:a|b)". Keeps word lists readable. */
export function anyOf(...alternatives: string[]): string {
  return `(?:${alternatives.join("|")})`;
}

/** A whole word (or phrase) from the list, not part of a longer word. */
export function wordOf(...alternatives: string[]): string {
  return `${WORD_START}${anyOf(...alternatives)}${WORD_END}`;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scanAll(re: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let match = re.exec(text);
  while (match) {
    out.push(match);
    if (match[0] === "") re.lastIndex += 1;
    match = re.exec(text);
  }
  return out;
}

/* -------------------------------------------------------------- spans */

export interface Span {
  start: number;
  end: number;
}

/** Stand-in for consumed text: neither a letter, a digit nor whitespace. */
export const MASK_CHAR = "\u00a6";

export function spanOf(match: RegExpExecArray): Span {
  return { start: match.index, end: match.index + match[0].length };
}

/** Replaces each span with MASK_CHAR, keeping the length. */
export function maskSpans(text: string, spans: readonly Span[]): string {
  if (spans.length === 0) return text;
  const units = text.split("");
  for (const { start, end } of spans) {
    for (let i = start; i < end; i += 1) units[i] = MASK_CHAR;
  }
  return units.join("");
}

/** The consumed-free clause right before `start`, for label/bound look-behind. */
export function textBefore(text: string, start: number, length = 30): string {
  return text.slice(Math.max(0, start - length), start);
}

export function textAfter(text: string, end: number, length = 30): string {
  return text.slice(end, end + length);
}

/** Verbatim evidence: the original spans, trimmed, de-duplicated, joined by " | ". */
export function evidenceOf(original: string, spans: readonly Span[]): string | undefined {
  const parts: string[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const part = original.slice(span.start, span.end).trim();
    if (part && !parts.includes(part)) parts.push(part);
  }
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

/* ------------------------------------------------------ parsed fields */

export function knownField<T>(value: T, confidence: number, evidence?: string): ParsedField<T> {
  return evidence === undefined ? { value, confidence } : { value, confidence, evidence };
}

/** Unknown is a value (§34.1): no value, confidence 0, optional evidence of why. */
export function unknownField<T>(evidence?: string): ParsedField<T> {
  return evidence === undefined ? { confidence: 0 } : { confidence: 0, evidence };
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/* ------------------------------------------------------------ numbers */

/** "85 000", "1 200 000", "85.000", "1,5", "54,5", "70". */
export const NUMBER = String.raw`\d{1,3}(?:[ .,]\d{3})+(?!\d)|\d+(?:[.,]\d+)?(?!\d)`;

/** An exact decimal kept as digit strings, so money never passes through floats. */
export interface Decimal {
  int: string;
  frac: string;
}

/**
 * Space, dot or comma followed by exactly three digits is a thousands
 * separator ("85 000", "85.000"); otherwise a single dot/comma is decimal.
 */
export function parseDecimal(raw: string): Decimal | undefined {
  const text = raw.replace(/\s+/g, "");
  if (/^\d+$/.test(text)) return { int: stripZeros(text), frac: "" };
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(text)) return { int: stripZeros(text.replace(/[.,]/g, "")), frac: "" };
  const match = /^(\d+)[.,](\d+)$/.exec(text);
  if (!match) return undefined;
  return { int: stripZeros(match[1]), frac: match[2].replace(/0+$/, "") };
}

function stripZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

/** Multiplies by 10^power by moving the decimal point: 1,2 × 10⁹ = "1200000000". */
export function scaleDecimal(value: Decimal, power: number): Decimal {
  if (power === 0) return value;
  const frac = value.frac.padEnd(power, "0");
  return {
    int: stripZeros(value.int + frac.slice(0, power)),
    frac: frac.slice(power).replace(/0+$/, ""),
  };
}

export function decimalString(value: Decimal): string {
  return value.frac ? `${value.int}.${value.frac}` : value.int;
}

/** For comparisons and plausibility checks only — never for stored money. */
export function decimalValue(value: Decimal): number {
  return Number(decimalString(value));
}

export function parseNumber(raw: string): number | undefined {
  const decimal = parseDecimal(raw);
  return decimal ? decimalValue(decimal) : undefined;
}

/* -------------------------------------------------------------- money */

const MULTIPLIER = String.raw`тыс(?:яч\p{L}*)?\.?|млн\.?|миллион\p{L}*|млрд\.?|миллиард\p{L}*|mln\.?|million\p{L}*|mlrd\.?|milliard\p{L}*|ming|минг`;
const CURRENCY = String.raw`\$|usd|у\.\s?е\.?|уе|y\.\s?e\.?|долл(?:ар\p{L}*|\.)?|dollar\p{L}*|dollor\p{L}*|сум|сўм|so'm|som|sum|uzs`;
/** Uzbek case suffixes glued to an amount: "90 ming dollargacha", "500$gacha", "60 mingdan". */
const UZ_SUFFIX = String.raw`(?:gacha|dan|гача|дан)?`;

// `(?<!(?<!\d)\p{L}-)`: a letter-hyphen blocks "Юнусабад-19" and "Ц-5", but a
// multiplier glued to a digit does not, so "85к-90к $" stays a range.
const MONEY_RE = pattern(
  String.raw`(?<![\p{L}\p{N}.,/])(?<!(?<!\d)\p{L}-)(?:(\$|usd)\s?)?(${NUMBER})` +
    String.raw`(\s?(?:${MULTIPLIER})${UZ_SUFFIX}${WORD_END}|[kк]${UZ_SUFFIX}${WORD_END})?` +
    String.raw`(\s{0,2}(?:${CURRENCY})${UZ_SUFFIX}${WORD_END})?`,
);

/** A number followed by a money word: used to tell prices from phone numbers. */
export const MONEY_UNIT_AFTER_RE = new RegExp(String.raw`^\s{0,2}(?:${MULTIPLIER}|${CURRENCY})`, "u");

const BOUND_MAX_BEFORE_RE = new RegExp(
  String.raw`(?<!\p{L})(?:до|не\s+дороже|не\s+более|не\s+больше|не\s+выше|максимум|макс\.?|max|потолок)\s*[:\-]?\s*$`,
  "u",
);
/**
 * "бюджет 100 000$" reads as a ceiling, but the label does not close a range:
 * "бюджет 80-100 тыс $" keeps both bounds.
 */
const BUDGET_LABEL_BEFORE_RE = new RegExp(
  String.raw`(?<!\p{L})(?:в\s+пределах|бюджет\p{L}*|budjet\p{L}*)\s*[:\-]?\s*$`,
  "u",
);
const BOUND_MIN_BEFORE_RE = new RegExp(
  String.raw`(?<!\p{L})(?:от|не\s+менее|не\s+меньше|не\s+дешевле|минимум|мин\.?|min|kamida|камида)\s*[:\-]?\s*$`,
  "u",
);
const BOUND_MAX_AFTER_RE = new RegExp(
  String.raw`^\s*(?:gacha|гача|и\s+(?:ниже|меньше|дешевле)|максимум|max)${WORD_END}`,
  "u",
);
/** "100 000$+" is a floor; "65 000$ + комиссия" adds a cost and is not. */
const BOUND_MIN_AFTER_RE = new RegExp(
  String.raw`^(?:\+|\s*\+(?!\s*[\p{L}\p{N}])|\s*(?:и\s+(?:выше|больше|дороже|более)|dan|дан)${WORD_END})`,
  "u",
);
/** "100 ming dollardan oshmasin" — "not more than", despite the -dan suffix. */
const DAN_NOT_MORE_RE = new RegExp(
  String.raw`^\s*(?:(?:dan|дан)\s+)?(?:oshma\p{L}*|ko'p\s+emas|qimmat\s+emas|arzon\p{L}*)`,
  "u",
);
/** Units after a bare number mean it is not money: minutes, metres, years, floors… */
const NON_MONEY_UNIT_AFTER_RE = new RegExp(
  String.raw`^\s*-?\s*` +
    anyOf(
      String.raw`мин\p{L}*`,
      String.raw`daqiqa\p{L}*`,
      "км",
      "km",
      String.raw`метр\p{L}*`,
      String.raw`metr\p{L}*`,
      String.raw`м(?![\p{L}²2])`,
      String.raw`сот\p{L}*`,
      String.raw`sotix\p{L}*`,
      "%",
      String.raw`процент\p{L}*`,
      String.raw`foiz\p{L}*`,
      "лет",
      String.raw`год\p{L}*`,
      String.raw`г\.`,
      String.raw`г(?!\p{L})`,
      String.raw`yil\p{L}*`,
      String.raw`шт\p{L}*`,
      String.raw`раз\p{L}*`,
      String.raw`человек\p{L}*`,
      String.raw`kishi\p{L}*`,
      String.raw`odam\p{L}*`,
      String.raw`этаж\p{L}*`,
      String.raw`эт\.`,
      String.raw`qavat\p{L}*`,
      String.raw`комнат\p{L}*`,
      String.raw`xona\p{L}*`,
      String.raw`квартал\p{L}*`,
      String.raw`kvartal\p{L}*`,
      String.raw`mavze\p{L}*`,
      String.raw`дом\p{L}*`,
      `uy${WORD_END}`,
      `й${WORD_END}`,
      `chi${WORD_END}`,
    ),
  "u",
);
/** Construction/handover years: "сдача 2025", "построен в 2015". */
const YEAR_CONTEXT_BEFORE_RE = new RegExp(
  String.raw`(?:сдач\p{L}*|сдан\p{L}*|постро\p{L}*|год\p{L}*|quril\p{L}*|topshir\p{L}*|yil\p{L}*)\s*[:\-]?\s*(?:в\s+)?$`,
  "u",
);
/** Price per m² / per sotix. */
const PER_UNIT_AFTER_RE = new RegExp(
  String.raw`^\s*(?:/|за|per|har)\s*(?:1\s*)?(?:м²|м2|м${WORD_END}|м\.|кв\.?\s?м|кв\.|кв${WORD_END}|квадрат\p{L}*|m²|m2|m${WORD_END}|kv\.?\s?m|сот\p{L}*|sotix)`,
  "u",
);
const PER_UNIT_BEFORE_RE = new RegExp(
  String.raw`(?:1\s*)?(?:м²|м2|кв\.?\s?м\.?|m²|m2|kv\.?\s?m\.?|сотк\p{L}*|sotix)\s*(?:uchun)?\s*[:=\-]?\s*$`,
  "u",
);
/** Money words that are not the asking price. */
const AUXILIARY_BEFORE_RE =
  /(?:взнос|первоначальн|аванс|депозит|залог|задат|комисс|предоплат|коммунал|oldindan|zalog|zaklad|depozit|komissiya|boshlang'ich|kommunal)/u;

export interface MoneyHit extends Span {
  /** Major units after applying "тыс / млн / ming…", as an exact decimal. */
  amount: Decimal;
  /** Only when the text names it ($, у.е., сум, so‘m…). Never guessed. */
  currency?: Currency;
  /** "до / gacha / не дороже" → max; "от / -dan / не менее" → min. */
  bound?: "min" | "max";
  /** Part of "80–100 тыс", "от 80 до 100", "60 dan 80 gacha". */
  inRange: boolean;
  /** For range ends: the whole range, the honest raw text of either bound. */
  range?: Span;
  /** Price per m² or per sotix, not a total. */
  perUnit: boolean;
  /** Down payment, deposit, commission, utilities — not the price. */
  auxiliary: boolean;
  /** Carries an explicit money marker (currency or multiplier). */
  marked: boolean;
}

function multiplierPower(token: string): number {
  const word = token.trim();
  if (/^(?:млрд|миллиард|mlrd|milliard)/u.test(word)) return 9;
  if (/^(?:млн|миллион|mln|million)/u.test(word)) return 6;
  return 3;
}

function currencyOf(token: string): Currency {
  return /^(?:сум|сўм|so'm|som|sum|uzs)/u.test(token.trim()) ? "UZS" : "USD";
}

function suffixBound(token: string | undefined): "min" | "max" | undefined {
  if (!token) return undefined;
  if (/(?:gacha|гача)$/u.test(token)) return "max";
  if (/(?:dan|дан)$/u.test(token)) return "min";
  return undefined;
}

/** A hit plus what range merging needs: the number as written and its multiplier. */
interface RawMoney {
  hit: MoneyHit;
  base: Decimal;
  power: number;
  /** The ceiling comes only from a "бюджет / в пределах" label, which may start a range. */
  labelled: boolean;
}

/**
 * Finds money-like amounts. Bare numbers (no currency, no multiplier) are
 * kept only when they are big enough to be a price or carry a bound word, so
 * "Юнусабад-19" or "5 минут до метро" never become budgets.
 */
export function scanMoney(folded: string): MoneyHit[] {
  const raws: RawMoney[] = [];
  for (const match of scanAll(MONEY_RE, folded)) {
    const [, prefix, number, multiplier, suffixCurrency] = match;
    const base = parseDecimal(number);
    if (!base) continue;
    const span = spanOf(match);
    const before = textBefore(folded, span.start);
    const after = textAfter(folded, span.end);
    const power = multiplier ? multiplierPower(multiplier) : 0;
    const currencyToken = prefix ?? suffixCurrency;
    const currency = currencyToken ? currencyOf(currencyToken) : undefined;
    const marked = Boolean(multiplier || currencyToken);

    if (!marked && NON_MONEY_UNIT_AFTER_RE.test(after)) continue;
    const value = decimalValue(base);
    if (!marked && /^\d{4}$/.test(number) && value >= 1950 && value <= 2060) {
      if (YEAR_CONTEXT_BEFORE_RE.test(before)) continue;
    }

    let bound = suffixBound(suffixCurrency?.trim()) ?? suffixBound(multiplier?.trim());
    let labelled = false;
    if (bound === "min" && DAN_NOT_MORE_RE.test(after)) bound = "max";
    if (!bound) {
      if (BOUND_MAX_BEFORE_RE.test(before)) bound = "max";
      else if (BUDGET_LABEL_BEFORE_RE.test(before)) {
        bound = "max";
        labelled = true;
      } else if (BOUND_MIN_BEFORE_RE.test(before)) bound = "min";
      else if (DAN_NOT_MORE_RE.test(after) && /^\s*(?:dan|дан)/u.test(after)) bound = "max";
      else if (BOUND_MAX_AFTER_RE.test(after)) bound = "max";
      else if (BOUND_MIN_AFTER_RE.test(after)) bound = "min";
    }

    const clause = before.split(/[.;!?\n]/u).pop() ?? "";
    const hit: MoneyHit = {
      ...span,
      amount: scaleDecimal(base, power),
      inRange: false,
      perUnit: PER_UNIT_AFTER_RE.test(after) || PER_UNIT_BEFORE_RE.test(before),
      auxiliary: AUXILIARY_BEFORE_RE.test(clause),
      marked,
    };
    if (currency) hit.currency = currency;
    if (bound) hit.bound = bound;
    raws.push({ hit, base, power, labelled });
  }

  // Ranges: "80-100 тыс $", "от 80 до 100 тыс", "$60 000 – 70 000", "60 dan 80 gacha".
  for (let i = 0; i + 1 < raws.length; i += 1) {
    const a = raws[i];
    const b = raws[i + 1];
    const between = folded.slice(a.hit.end, b.hit.start);
    if (!/^\s*(?:-|до|dan|дан|to)\s*$/u.test(between) || (a.hit.bound === "max" && !a.labelled)) continue;
    // "от 80 до 100 тыс": the multiplier written once applies to both ends.
    if (a.power === 0 && b.power > 0) {
      const inherited = scaleDecimal(a.base, b.power);
      if (decimalValue(inherited) <= decimalValue(b.hit.amount)) {
        a.hit.amount = inherited;
        a.hit.marked = true;
      }
    }
    if (!a.hit.currency && b.hit.currency) a.hit.currency = b.hit.currency;
    if (!b.hit.currency && a.hit.currency) b.hit.currency = a.hit.currency;
    a.hit.bound = "min";
    b.hit.bound = "max";
    a.hit.inRange = true;
    b.hit.inRange = true;
    a.hit.range = { start: a.hit.start, end: b.hit.end };
    b.hit.range = a.hit.range;
  }

  return raws
    .map(({ hit }) => hit)
    .filter((hit) => {
      if (hit.marked || hit.currency || hit.inRange) return true;
      const value = decimalValue(hit.amount);
      return hit.bound ? value >= 100 : value >= 1000;
    });
}

/* ------------------------------------------------------------- phones */

export interface PhoneHit extends Span {
  /** "+998XXXXXXXXX" */
  e164: string;
}

/**
 * Operator and Tashkent landline codes accepted without an explicit +998.
 * Keeps 9-digit prices ("850000000 сум") from being read as phones.
 */
const BARE_PHONE_CODES = new Set([
  "20", "33", "50", "55", "70", "71", "77", "78", "88", "90", "91", "93", "94", "95", "97", "98", "99",
]);

const PHONE_RE = pattern(
  String.raw`(?<![\p{N}+])(\+\s?)?(998[\s-]?)?\(?(\d{2})\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)`,
);
/** "цена 950000000": nine bare digits after a price label are the price, not a phone. */
const PRICE_CUE_BEFORE_RE = /(?<!\p{L})(?:цен\p{L}*|стоимост\p{L}*|narx\p{L}*|нарх\p{L}*|price)\s*[:\-]?\s*$/u;

/** "+998 90 123 45 67", "(90) 123-45-67", "901234567", "tel 90 555 12 34". */
export function scanPhones(folded: string): PhoneHit[] {
  const hits: PhoneHit[] = [];
  for (const match of scanAll(PHONE_RE, folded)) {
    const span = spanOf(match);
    const hasCountryCode = Boolean(match[2]);
    if (!hasCountryCode && !BARE_PHONE_CODES.has(match[3])) continue;
    if (MONEY_UNIT_AFTER_RE.test(textAfter(folded, span.end, 12))) continue;
    if (!hasCountryCode && /^\d{9}$/.test(match[0]) && PRICE_CUE_BEFORE_RE.test(textBefore(folded, span.start, 20))) {
      continue;
    }
    const e164 = normalizeUzPhone(match[0]);
    if (e164) hits.push({ ...span, e164 });
  }
  return hits;
}

/* ---------------------------------------------------------- landmarks */

export interface LandmarkHit extends Span {
  /** Verbatim text kept as an extra, e.g. "метро Космонавтов", "у метро". */
  text: string;
  kind: "metro" | "complex" | "near";
}

const NAME_AFTER_RE = /\s*[«"„“]?(\p{Lu}[\p{L}'‘’ʻʼ-]*(?:[ \u00a0]+\p{Lu}[\p{L}\p{N}'‘’ʻʼ-]*){0,2})[»"“”]?/uy;
const QUOTED_NAME_AFTER_RE = /\s*[«"„“]([^»"“”\n]{2,40})[»"“”]/uy;
const LOWER_NAME_AFTER_RE = /\s*(\p{Ll}[\p{L}'‘’ʻʼ-]{3,})/uy;
const NAME_BEFORE_RE = /((?:\p{Lu}[\p{L}'‘’ʻʼ-]*[ \u00a0]+){1,3})$/u;
/** Generic words that are never a station or complex name. */
const NOT_A_NAME_RE = new RegExp(
  "^" +
    anyOf(
      ...["рядом", "недалеко", "близко", "пешком", "есть", "нету?", "около", "возле", "через", "bor"],
      ...["минут", "район", "квартир", "комнат", "дом", "этаж", "новостро", "вторичк", "ремонт", "станци"].map(
        (stem) => String.raw`${stem}\p{L}*`,
      ),
      ...["парк", "школ", "yaqin", "yon", "xonali", "kvartira", "ijara", "uy"].map((stem) => String.raw`${stem}\p{L}*`),
    ) +
    "$",
  "u",
);

/** "у метро", "рядом с метро", "5 минут пешком до метро", "станция метро", "м." */
const METRO_RE = pattern(
  WORD_START +
    String.raw`(?:${anyOf(
      String.raw`рядом\s+со?`,
      "рядом",
      "у",
      "возле",
      "около",
      String.raw`недалеко\s+от`,
      String.raw`близко\s+к`,
      "напротив",
      String.raw`\d{1,2}\s*мин\p{L}*\.?\s+(?:пешком\s+)?(?:до|от)`,
    )}\s+)?` +
    String.raw`(?:(?:станци\p{L}*|ст\.)\s*)?(метро${WORD_END}|м\.)`,
);
const UZ_NEAR_METRO_RE = pattern(
  String.raw`${WORD_START}metro(?:ga|ning|dan)?\s+(?:yaqin\p{L}*|yon\p{L}*|oldida)${WORD_END}`,
);
const UZ_STATION_RE = pattern(String.raw`${WORD_START}metro(?:si\p{L}*|\s+bekat\p{L}*)${WORD_END}`);
const COMPLEX_RE = pattern(
  String.raw`${WORD_START}(?:жк|ж\.к\.|jk|turar\s+joy\s+majmuas\p{L}*)${WORD_END}`,
);
const NEAR_NAMED_RE = pattern(
  String.raw`${WORD_START}(?:рядом\s+со?|возле|около|напротив|недалеко\s+от)${WORD_END}`,
);
const UZ_NEAR_AFTER_RE = pattern(
  String.raw`${WORD_START}(?:yonida|yaqinida|oldida|ro'parasida)${WORD_END}`,
);

function stickyName(re: RegExp, text: string, at: number): { name: string; end: number } | undefined {
  re.lastIndex = at;
  const match = re.exec(text);
  if (!match) return undefined;
  return { name: match[1], end: at + match[0].length };
}

/** Station/complex name right after a keyword; lowercase only if it is not a generic word. */
function nameAfter(original: string, folded: string, at: number, allowLowercase: boolean) {
  const found =
    stickyName(QUOTED_NAME_AFTER_RE, original, at) ??
    stickyName(NAME_AFTER_RE, original, at) ??
    (allowLowercase ? stickyName(LOWER_NAME_AFTER_RE, original, at) : undefined);
  if (!found) return undefined;
  const nameStart = found.end - found.name.length;
  if (folded.slice(nameStart, found.end).includes(MASK_CHAR)) return undefined;
  if (NOT_A_NAME_RE.test(foldText(found.name.trim()))) return undefined;
  return found;
}

/**
 * Metro stations, residential complexes and named landmarks, kept verbatim.
 * They are never mapped to a district: "метро Космонавтов" says nothing
 * certain about the district, and "метро Чиланзар" is a station, not an area.
 */
export function scanLandmarks(original: string, folded: string): LandmarkHit[] {
  const hits: LandmarkHit[] = [];
  let work = folded;
  const take = (hit: LandmarkHit) => {
    hits.push(hit);
    work = maskSpans(work, [hit]);
  };

  for (const match of scanAll(METRO_RE, work)) {
    const keyword = match[1];
    const keywordStart = match.index + match[0].length - keyword.length;
    const span = spanOf(match);
    // "78 м.", "54 кв.м.", "кв. м.": an area unit, not "м. <Station>".
    if (keyword === "м." && /(?:\d|кв\.?)\s*$/u.test(textBefore(work, keywordStart, 4))) continue;
    const name = nameAfter(original, work, span.end, keyword === "метро");
    if (name) {
      take({ start: span.start, end: name.end, text: original.slice(keywordStart, name.end).trim(), kind: "metro" });
    } else if (keyword === "метро") {
      take({ ...span, text: original.slice(span.start, span.end).trim(), kind: "metro" });
    }
  }

  for (const match of scanAll(UZ_STATION_RE, work)) {
    const span = spanOf(match);
    const before = NAME_BEFORE_RE.exec(original.slice(Math.max(0, span.start - 60), span.start));
    if (!before) continue;
    const start = span.start - before[1].length;
    const tail = /^\s+(?:yaqin\p{L}*|yon\p{L}*|oldida)/u.exec(work.slice(span.end));
    take({
      start,
      end: span.end + (tail ? tail[0].length : 0),
      text: original.slice(start, span.end).trim(),
      kind: "metro",
    });
  }

  for (const match of scanAll(UZ_NEAR_METRO_RE, work)) {
    const span = spanOf(match);
    take({ ...span, text: original.slice(span.start, span.end).trim(), kind: "metro" });
  }

  for (const match of scanAll(COMPLEX_RE, work)) {
    const span = spanOf(match);
    const name = nameAfter(original, work, span.end, true);
    if (name) take({ start: span.start, end: name.end, text: original.slice(span.start, name.end).trim(), kind: "complex" });
  }

  for (const match of scanAll(NEAR_NAMED_RE, work)) {
    const span = spanOf(match);
    const name = nameAfter(original, work, span.end, false);
    if (name) take({ start: span.start, end: name.end, text: original.slice(span.start, name.end).trim(), kind: "near" });
  }

  for (const match of scanAll(UZ_NEAR_AFTER_RE, work)) {
    const span = spanOf(match);
    const before = NAME_BEFORE_RE.exec(original.slice(Math.max(0, span.start - 60), span.start));
    if (!before) continue;
    const start = span.start - before[1].length;
    if (work.slice(start, span.start).includes(MASK_CHAR)) continue;
    take({ start, end: span.end, text: original.slice(start, span.end).trim(), kind: "near" });
  }

  return hits.sort((a, b) => a.start - b.start);
}

/* ---------------------------------------------------------- districts */

export interface DistrictHit extends Span {
  id: DistrictId;
}

/**
 * Case endings seen in speech and posts: "в Юнусабаде", "на Чиланзаре",
 * "Мирзо-Улугбекском", "Сергелийский", "Yunusoboddan", "Chilonzorda",
 * "Chilonzordagi", Uzbek Cyrillic "Юнусободда".
 */
const DISTRICT_SUFFIX = String.raw`(?:й?ск\p{L}{0,4}|инск\p{L}{0,4}|ом|ой|ем|а|у|е|ы|я|ю|da|dan|dagi|ga|ka|qa|ni|ning|gacha|lik|liklar|да|дан|даги|га|ни|нинг|гача)?`;

function variantPatterns(variant: string): string[] {
  const folded = foldText(variant);
  const forms = [folded];
  // "Учтепа" → "в Учтепе", "Яккасарай" → "в Яккасарае": drop the final vowel/й before endings.
  if (/[ай]$/u.test(folded) && /[\u0400-\u04ff]$/u.test(folded)) forms.push(folded.slice(0, -1));
  return forms.map((form) => form.split(/[\s-]+/u).map(escapeRegExp).join(String.raw`[\s-]+`));
}

const DISTRICT_RES: [DistrictId, RegExp][] = districtIds.map((id) => {
  const alternatives = unique(districts[id].variants.flatMap(variantPatterns)).sort((a, b) => b.length - a.length);
  return [id, pattern(String.raw`${WORD_START}(?:${alternatives.join("|")})${DISTRICT_SUFFIX}${WORD_END}`)];
});

const AFTER_METRO_RE = /(?:метро|м\.|ст\.\s?м\.|станци\p{L}*|metro)\s*[«"]?$/u;

/** District mentions via the geo.ts spelling variants, in order of appearance. */
export function scanDistricts(folded: string): DistrictHit[] {
  const hits: DistrictHit[] = [];
  for (const [id, re] of DISTRICT_RES) {
    for (const match of scanAll(re, folded)) {
      if (AFTER_METRO_RE.test(textBefore(folded, match.index, 16))) continue;
      hits.push({ ...spanOf(match), id });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: DistrictHit[] = [];
  for (const hit of hits) {
    const last = out[out.length - 1];
    if (!last || hit.start >= last.end) out.push(hit);
  }
  return out;
}

/* -------------------------------------------------------------- rooms */

export interface RoomsHit extends Span {
  min?: number;
  max?: number;
  /** "однушка / двушка / трёшка" name an apartment as well as a room count. */
  apartment?: true;
}

const ROOM_UNIT = String.raw`(?:комнатн\p{L}*|комнат\p{L}*|комн(?:\.|${WORD_END})|ком\.|xonali\p{L}*|xonalik\p{L}*|хонали\p{L}*|xona(?:si\p{L}*)?${WORD_END}|[кk](?=\s*(?:кв|kv)))`;
/** "3-х", "3х", "2-ух", "5-ти" between the number and the unit. */
const ROOM_INFIX = String.raw`(?:\s*-?\s*(?:х|ех|ух|ти|и)${WORD_END})?\s*-?\s*`;
const MAX_ROOMS = 10;

const ROOMS_RANGE_RE = pattern(
  String.raw`${NUMBER_START}(\d{1,2})\s*(?:-|или|и|yoki|va|до|,)\s*(\d{1,2})${ROOM_INFIX}${ROOM_UNIT}`,
);
const ROOMS_PLUS_RE = pattern(
  String.raw`${NUMBER_START}(\d{1,2})\s*(?:\+|и\s+более|и\s+больше|va\s+undan\s+ko'p)${ROOM_INFIX}${ROOM_UNIT}`,
);
const ROOMS_SINGLE_RE = pattern(String.raw`${NUMBER_START}(\d{1,2})${ROOM_INFIX}${ROOM_UNIT}`);
const ROOMS_LABEL_RE = pattern(String.raw`${WORD_START}(?:комнат\p{L}*|xonalar\s+soni)\s*:\s*(\d{1,2})(?!\d)`);
const ROOM_WORDS: { re: RegExp; values: Record<string, number>; apartment: boolean }[] = [
  {
    re: pattern(String.raw`${WORD_START}(одно|двух|трех|четырех|пяти)\s*-?\s*комнатн\p{L}*`),
    values: { одно: 1, двух: 2, трех: 3, четырех: 4, пяти: 5 },
    apartment: false,
  },
  {
    re: pattern(String.raw`${WORD_START}(однушк|двушк|трешк|четырешк)\p{L}*`),
    values: { однушк: 1, двушк: 2, трешк: 3, четырешк: 4 },
    apartment: true,
  },
  {
    re: pattern(
      String.raw`${WORD_START}(bir|ikki|uch|to'rt|tort|besh|бир|икки|уч|тўрт|беш)\s*-?\s*(?:xonali|хонали)\p{L}*`,
    ),
    values: { bir: 1, ikki: 2, uch: 3, "to'rt": 4, tort: 4, besh: 5, бир: 1, икки: 2, уч: 3, тўрт: 4, беш: 5 },
    apartment: false,
  },
];

const ROOMS_MIN_BEFORE_RE = /(?<!\p{L})(?:от|не\s+менее|не\s+меньше|минимум|kamida)\s*$/u;
const ROOMS_MIN_AFTER_RE = /^\s*(?:\+|и\s+(?:более|больше)|va\s+undan\s+ko'p|dan\s+ko'p)/u;
/** "1к кв", "3-комн. кв." — the abbreviation right after names an apartment. */
const APARTMENT_ABBREVIATION_AFTER_RE = /^\s*(?:кв|kv)(?:\.|(?![\p{L}\p{N}]))/u;
const ROOMS_MAX_BEFORE_RE = /(?<!\p{L})(?:до|не\s+более|не\s+больше|максимум)\s*$/u;

function validRooms(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_ROOMS;
}

/**
 * "2–3 комнаты", "2-3 xonali", "3-комн.", "3-х комнатная", "3к кв", "3+ комнаты",
 * "от 2 комнат", "двушка", "трёхкомнатная", "uch xonali", "Комнат: 3".
 * Returns hits in text order; exact counts have min === max.
 */
export function scanRooms(folded: string): RoomsHit[] {
  const hits: RoomsHit[] = [];
  let work = folded;
  const take = (hit: RoomsHit) => {
    if (APARTMENT_ABBREVIATION_AFTER_RE.test(textAfter(work, hit.end, 12))) hit.apartment = true;
    hits.push(hit);
    work = maskSpans(work, [hit]);
  };

  for (const match of scanAll(ROOMS_RANGE_RE, work)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (!validRooms(a) || !validRooms(b) || a >= b || b - a > 3) continue;
    take({ ...spanOf(match), min: a, max: b });
  }
  for (const match of scanAll(ROOMS_PLUS_RE, work)) {
    const n = Number(match[1]);
    if (validRooms(n)) take({ ...spanOf(match), min: n });
  }
  for (const match of scanAll(ROOMS_SINGLE_RE, work)) {
    const n = Number(match[1]);
    if (!validRooms(n)) continue;
    const span = spanOf(match);
    const before = textBefore(work, span.start, 16);
    if (ROOMS_MIN_BEFORE_RE.test(before) || ROOMS_MIN_AFTER_RE.test(textAfter(work, span.end, 20))) {
      take({ ...span, min: n });
    } else if (ROOMS_MAX_BEFORE_RE.test(before)) {
      take({ ...span, max: n });
    } else {
      take({ ...span, min: n, max: n });
    }
  }
  for (const { re, values, apartment } of ROOM_WORDS) {
    for (const match of scanAll(re, work)) {
      const n = values[match[1]];
      if (n === undefined) continue;
      const hit: RoomsHit = { ...spanOf(match), min: n, max: n };
      if (apartment) hit.apartment = true;
      take(hit);
    }
  }
  for (const match of scanAll(ROOMS_LABEL_RE, work)) {
    const n = Number(match[1]);
    if (validRooms(n)) take({ ...spanOf(match), min: n, max: n });
  }
  return hits.sort((a, b) => a.start - b.start);
}

/* --------------------------------------------------------------- area */

export type AreaLabel = "total" | "kitchen" | "living" | "land";

export interface AreaHit extends Span {
  min?: number;
  max?: number;
  label?: AreaLabel;
}

const AREA_NUMBER = String.raw`\d{1,4}(?:[.,]\d{1,2})?`;
const AREA_UNIT = String.raw`(?:м²|м2|м\.?\s?кв\.?|кв\.?\s?м\.?|кв\.?\s?метр\p{L}*|квадрат\p{L}*|квм|m²|m2|m\.?\s?kv\.?|kv\.?\s?m\.?|kvm|kvadrat\p{L}*|sq\.?\s?m)${WORD_END}`;

const AREA_TRIPLE_RE = pattern(
  String.raw`${NUMBER_START}(${AREA_NUMBER})\s*/\s*(${AREA_NUMBER})\s*/\s*(${AREA_NUMBER})\s*${AREA_UNIT}`,
);
const AREA_RANGE_RE = pattern(
  String.raw`${NUMBER_START}(${AREA_NUMBER})\s*(?:-|до)\s*(${AREA_NUMBER})\s*${AREA_UNIT}`,
);
const AREA_SINGLE_RE = pattern(String.raw`${NUMBER_START}(${AREA_NUMBER})\s*(\+\s*)?${AREA_UNIT}`);
/** "Площадь: 78", "общая 78", "S=78", "umumiy maydoni 80" — not followed by another unit. */
const AREA_LABELLED_RE = pattern(
  WORD_START +
    anyOf(
      String.raw`общ\p{L}*\s+площад\p{L}*`,
      String.raw`общ(?:ая|\.)`,
      String.raw`площад\p{L}*`,
      String.raw`umumiy\s+maydon\p{L}*`,
      String.raw`maydon\p{L}*`,
      String.raw`s\s*=`,
    ) +
    String.raw`\s*[:=\-]?\s*(${AREA_NUMBER})(?![\d/]|[.,]\d)` +
    String.raw`(?!\s*(?:сот|sotix|%|x|х|мин|daqiqa|км|km|метр|metr|м${WORD_END}|m${WORD_END}))`,
);

const AREA_MIN_BEFORE_RE = /(?<!\p{L})(?:от|не\s+менее|не\s+меньше|минимум|kamida)\s*$/u;
const AREA_MAX_BEFORE_RE = /(?<!\p{L})(?:до|не\s+более|не\s+больше|максимум)\s*$/u;
const AREA_MAX_AFTER_RE = /^\s*(?:gacha|гача)/u;
const AREA_MIN_AFTER_RE = /^\s*(?:(?:dan|дан)\s+(?:katta|ko'p|kam\s+emas)|и\s+(?:более|больше))/u;

function areaLabel(folded: string, start: number): AreaLabel | undefined {
  const clause = textBefore(folded, start, 24).split(/[,;\n(|]|\d/u).pop() ?? "";
  if (/кухн|kuxn|oshxona|ошхона/u.test(clause)) return "kitchen";
  if (/жил|yashash/u.test(clause)) return "living";
  if (/участ|сот|sotix|yer\s|hovli\s+maydon|земл/u.test(clause)) return "land";
  if (/общ|umumiy|площад|maydon|s\s*=/u.test(clause)) return "total";
  return undefined;
}

function validArea(value: number | undefined): value is number {
  return value !== undefined && value >= 5 && value <= 10_000;
}

/** "78 м²", "60–80 м²", "от 50 кв.м", "70 m2", "78/45/12 м²", "Площадь: 78". */
export function scanAreas(folded: string): AreaHit[] {
  const hits: AreaHit[] = [];
  let work = folded;
  const take = (hit: AreaHit) => {
    hits.push(hit);
    work = maskSpans(work, [hit]);
  };
  const withLabel = (hit: AreaHit, label = areaLabel(work, hit.start)): AreaHit =>
    label ? { ...hit, label } : hit;

  for (const match of scanAll(AREA_TRIPLE_RE, work)) {
    const total = parseNumber(match[1]);
    if (validArea(total)) take({ ...spanOf(match), min: total, max: total, label: "total" });
  }
  for (const match of scanAll(AREA_RANGE_RE, work)) {
    const a = parseNumber(match[1]);
    const b = parseNumber(match[2]);
    if (!validArea(a) || !validArea(b) || a >= b) continue;
    take(withLabel({ ...spanOf(match), min: a, max: b }));
  }
  for (const match of scanAll(AREA_SINGLE_RE, work)) {
    const value = parseNumber(match[1]);
    if (!validArea(value)) continue;
    const span = spanOf(match);
    const before = textBefore(work, span.start, 16);
    const after = textAfter(work, span.end, 20);
    if (match[2] || AREA_MIN_BEFORE_RE.test(before) || AREA_MIN_AFTER_RE.test(after)) {
      take(withLabel({ ...span, min: value }));
    } else if (AREA_MAX_BEFORE_RE.test(before) || AREA_MAX_AFTER_RE.test(after)) {
      take(withLabel({ ...span, max: value }));
    } else {
      take(withLabel({ ...span, min: value, max: value }));
    }
  }
  for (const match of scanAll(AREA_LABELLED_RE, work)) {
    const value = parseNumber(match[1]);
    if (validArea(value)) take({ ...spanOf(match), min: value, max: value, label: "total" });
  }
  return hits.sort((a, b) => a.start - b.start);
}

/* ----------------------------------------------------------- deal type */

export interface Cue<T> extends Span {
  value: T;
  /** Explicit word ("продаётся", "ijaraga") vs indirect hint ("в месяц", "ипотека"). */
  strong: boolean;
}

const DEAL_CUES: { re: RegExp; value: DealType; strong: boolean }[] = [
  {
    re: pattern(
      wordOf(
        ...["прода", "покупк", "покупа", "приобре", "sotil", "sotuv", "сотил", "сотув"].map((stem) => String.raw`${stem}\p{L}*`),
        ...["куплю", "купить", "купим", "sotaman", "sotamiz", "сотаман"],
        String.raw`sotib\s+ol\p{L}*`,
        String.raw`сотиб\s+ол\p{L}*`,
      ),
    ),
    value: "sale",
    strong: true,
  },
  {
    // Not "сдан / сдача": "дом сдан в 2023" is a completed building, not a rental.
    re: pattern(
      wordOf(
        ...["сдается", "сдаются", "сдаю", "сдам", "сдаем", "сдать", "сниму", "снимем", "снять", "снимаю"],
        ...["аренд", "посуточн", "квартирант", "ijara", "ижара", "kvartirant"].map((stem) => String.raw`${stem}\p{L}*`),
      ),
    ),
    value: "rent",
    strong: true,
  },
  {
    re: pattern(String.raw`(?:${WORD_START}в\s+месяц|/\s?мес\p{L}*|${WORD_START}в\s+мес\.|${WORD_START}oyiga|${WORD_START}ойига)${WORD_END}`),
    value: "rent",
    strong: false,
  },
  {
    re: pattern(String.raw`${WORD_START}(?:ипотек\p{L}*|ипотечн\p{L}*|ipoteka\p{L}*|рассрочк\p{L}*)${WORD_END}`),
    value: "sale",
    strong: false,
  },
];

export function scanDealTypeCues(folded: string): Cue<DealType>[] {
  return DEAL_CUES.flatMap(({ re, value, strong }) =>
    scanAll(re, folded).map((match) => ({ ...spanOf(match), value, strong })),
  ).sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------- property type */

export interface PropertyTypeCue extends Cue<PropertyType> {
  /** Confidence the cue alone gives; weak cues are hints (e.g. "новостройка" → apartment). */
  weight: number;
}

const PROPERTY_CUES: { re: RegExp; value: PropertyType; strong: boolean; weight: number }[] = [
  {
    re: pattern(
      String.raw`${WORD_START}(?:квартир\p{L}*|kvartira\p{L}*|xonadon\p{L}*|хонадон\p{L}*|апартамент\p{L}*|студи[яюи]|однушк\p{L}*|двушк\p{L}*|трешк\p{L}*|четырешк\p{L}*)${WORD_END}`,
    ),
    value: "apartment",
    strong: true,
    weight: 0.9,
  },
  {
    re: pattern(
      wordOf(
        String.raw`частн\p{L}*\s+дом\p{L}*`,
        String.raw`дом\p{L}*\s+с\s+участк\p{L}*`,
        String.raw`коттедж\p{L}*`,
        String.raw`таунхаус\p{L}*`,
        "townhouse",
        "дач[аиуе]",
        // "yopiq hovli" is a closed courtyard, not a house.
        String.raw`(?<!yopiq\s)(?:hovli|xovli)\p{L}*`,
        String.raw`ховли\p{L}*`,
      ),
    ),
    value: "house",
    strong: true,
    weight: 0.9,
  },
  {
    // "Продаётся дом", "Сдаю 2-этажный дом": the house is the object of the deal verb.
    re: pattern(
      String.raw`(?<=(?:прода\p{L}*|сда\p{L}*|куплю|сниму|sotil\p{L}*)\s+(?:[\p{L}\p{N}-]+\s+)?)дом[ау]?${WORD_END}`,
    ),
    value: "house",
    strong: true,
    weight: 0.85,
  },
  {
    // "квартира или дом", "дом или квартира": offered as an alternative type.
    re: pattern(
      String.raw`(?<=(?:квартир\p{L}*|kvartira\p{L}*)\s+(?:или|yoki)\s+)дом[ау]?${WORD_END}|${WORD_START}дом[ау]?(?=\s+(?:или|yoki)\s+(?:квартир|kvartira))`,
    ),
    value: "house",
    strong: true,
    weight: 0.85,
  },
  {
    // "дом … 6 соток": a house with its plot.
    re: pattern(
      String.raw`${WORD_START}дом[ау]?${WORD_END}(?=[^.!?\n]{0,60}${WORD_START}(?:сот(?:ок|ки|ка)|sotix\p{L}*))`,
    ),
    value: "house",
    strong: true,
    weight: 0.85,
  },
  {
    // "рядом магазин" is an amenity; only "под магазин" names a commercial use.
    re: pattern(
      wordOf(
        ...["коммерческ", "нежил", "офис", "ofis", "склад", "sklad", "tijorat", "тижорат"].map((stem) => String.raw`${stem}\p{L}*`),
        String.raw`под\s+(?:магазин|кафе|бизнес|салон|офис)\p{L}*`,
        String.raw`помещени\p{L}*\s+под`,
      ),
    ),
    value: "commercial",
    strong: true,
    weight: 0.9,
  },
  {
    re: pattern(
      String.raw`${WORD_START}(?:земельн\p{L}*|участ(?:ок|ка|ке)(?!\s+с\s+дом)|yer\s+(?:uchastka\p{L}*|maydoni)|uchastka\p{L}*)${WORD_END}`,
    ),
    value: "land",
    strong: true,
    weight: 0.85,
  },
  {
    re: pattern(
      String.raw`${WORD_START}(?:комнат[ау]|койко-?мест\p{L}*|подселени\p{L}*|xona\s+(?:ijaraga|beriladi))${WORD_END}`,
    ),
    value: "room",
    strong: true,
    weight: 0.85,
  },
  {
    re: pattern(String.raw`${WORD_START}(?:новостро\p{L}*|вторичк\p{L}*|yangi\s+bino\p{L}*|ikkilamchi\p{L}*)${WORD_END}`),
    value: "apartment",
    strong: false,
    weight: 0.7,
  },
  {
    re: pattern(String.raw`${WORD_START}(?:сот(?:ок|ки|ка)|sotix\p{L}*)${WORD_END}`),
    value: "land",
    strong: false,
    weight: 0.5,
  },
  {
    // A bare "дом" often means the building ("кирпичный дом", "дом сдан").
    re: pattern(
      String.raw`(?<!(?:нов\p{L}{1,3}|кирпичн\p{L}{1,3}|панельн\p{L}{1,3}|монолитн\p{L}{1,3}|в|этом|жил\p{L}{1,3})\s)${WORD_START}(?:дом|дома|доме)${WORD_END}(?!\s+(?:сдан|сдач))`,
    ),
    value: "house",
    strong: false,
    weight: 0.55,
  },
];

export function scanPropertyTypeCues(folded: string): PropertyTypeCue[] {
  return PROPERTY_CUES.flatMap(({ re, value, strong, weight }) =>
    scanAll(re, folded).map((match) => ({ ...spanOf(match), value, strong, weight })),
  ).sort((a, b) => a.start - b.start);
}
