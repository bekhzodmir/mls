import { DISPLAY_TIME_ZONE, intlLocale, type Locale } from "./config";

/**
 * Locale-aware display helpers. Everything is rendered in Tashkent time
 * (Asia/Tashkent) regardless of where the server runs, so server and client
 * output match and hydration stays stable.
 *
 * Uzbek is formatted without the runtime's Uzbek locale data. Chromium, and
 * with it Android WebViews and the Telegram Mini App on most phones, ships
 * ICU without "uz" and silently falls back to root patterns ("2026 M09 30",
 * "$ 95,000", "a, b, and c"). That garbles the text and breaks hydration of
 * every client component that formats on both sides. The Uzbek names and
 * patterns below follow CLDR, so the result equals what a full-ICU runtime
 * (Node) prints. Russian data is present in every runtime and uses `Intl`.
 */

/* ---------------------------------------------------------------- numbers */

/**
 * "1 234 567,5". Russian and Uzbek share the CLDR number symbols (groups with
 * a no-break space from four digits, decimal comma), so both use ru-RU data.
 * Only fraction digits are configurable: percent, currency and unit styles
 * differ between the two languages and must not be formatted here.
 */
export function formatNumber(
  _locale: Locale,
  value: number,
  options?: Pick<Intl.NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits">,
): string {
  return new Intl.NumberFormat(intlLocale.ru, options).format(value);
}

const compactUnits: Record<Locale, readonly (readonly [number, string])[]> = {
  ru: [
    [1e12, "трлн"],
    [1e9, "млрд"],
    [1e6, "млн"],
    [1e3, "тыс."],
  ],
  uz: [
    [1e12, "trln"],
    [1e9, "mlrd"],
    [1e6, "mln"],
    [1e3, "ming"],
  ],
};

/** "85 тыс." / "85 ming", "1,2 млн" / "1,2 mln" (CLDR short compact, one decimal). */
export function formatCompactNumber(locale: Locale, value: number): string {
  const units = compactUnits[locale];
  const abs = Math.abs(value);
  for (let i = 0; i < units.length; i++) {
    const [size, word] = units[i];
    if (abs < size) continue;
    const scaled = Math.round((abs / size) * 10) / 10;
    // 999 950 rounds to 1 000 тыс. — show it as 1 млн instead.
    if (scaled >= 1000 && i > 0) {
      const [biggerSize, biggerWord] = units[i - 1];
      return `${formatNumber(locale, Math.sign(value) * Math.round((abs / biggerSize) * 10) / 10)} ${biggerWord}`;
    }
    return `${formatNumber(locale, Math.sign(value) * scaled)} ${word}`;
  }
  return formatNumber(locale, value, { maximumFractionDigits: 1 });
}

/* ------------------------------------------------------------------ dates */

const uzMonths = {
  long: [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentabr",
    "oktabr",
    "noyabr",
    "dekabr",
  ],
  short: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
} as const;

/** Sunday first, as `Date#getUTCDay` counts. */
const uzWeekdays = {
  long: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
  short: ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"],
} as const;

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function tashkentParts(iso: string) {
  const parts: Record<string, number> = {};
  for (const part of wallClock.formatToParts(new Date(iso))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, weekday };
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * CLDR Uzbek patterns: "5-yan, 2026", "5-yanvar", "dushanba, 5-yanvar",
 * "5-yan, 02:05", "02:05". Numeric months fall back to "05.01.2026".
 */
function formatUzbekDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  const p = tashkentParts(iso);
  const day = options.day === "2-digit" ? pad(p.day) : String(p.day);
  let text = "";
  if (options.month === "long" || options.month === "short" || options.month === "narrow") {
    const name = uzMonths[options.month === "long" ? "long" : "short"][p.month - 1];
    text = options.day ? `${day}-${name}` : name;
    if (options.year) text += `, ${p.year}`;
  } else if (options.day || options.month || options.year) {
    text = [options.day && pad(p.day), options.month && pad(p.month), options.year && String(p.year)]
      .filter(Boolean)
      .join(".");
  }
  if (options.weekday) {
    const name = uzWeekdays[options.weekday === "long" ? "long" : "short"][p.weekday];
    text = text ? `${name}, ${text}` : name;
  }
  if (options.hour || options.minute) {
    const time = options.minute ? `${pad(p.hour)}:${pad(p.minute)}` : pad(p.hour);
    text = text ? `${text}, ${time}` : time;
  }
  return text;
}

export function formatDate(
  locale: Locale,
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (locale === "uz") return formatUzbekDate(iso, options);
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: DISPLAY_TIME_ZONE,
    ...options,
  }).format(new Date(iso));
}

export function formatDateTime(locale: Locale, iso: string): string {
  return formatDate(locale, iso, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(locale: Locale, iso: string): string {
  return formatDate(locale, iso, { hour: "2-digit", minute: "2-digit" });
}

/** Agenda headings: «среда, 30 сентября» / «chorshanba, 30-sentabr» (optionally with the year). */
export function formatDay(locale: Locale, iso: string, options: { year?: boolean } = {}): string {
  return formatDate(locale, iso, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(options.year ? { year: "numeric" } : {}),
  });
}

type RelativeUnit = "minute" | "hour" | "day" | "month";

const uzRelative: Record<RelativeUnit, { past: string; future: string; exact: Record<string, string> }> = {
  minute: { past: "{n} daqiqa oldin", future: "{n} daqiqadan keyin", exact: { "0": "shu daqiqada" } },
  hour: { past: "{n} soat oldin", future: "{n} soatdan keyin", exact: { "0": "shu soatda" } },
  day: { past: "{n} kun oldin", future: "{n} kundan keyin", exact: { "-1": "kecha", "0": "bugun", "1": "ertaga" } },
  month: {
    past: "{n} oy oldin",
    future: "{n} oydan keyin",
    exact: { "-1": "o‘tgan oy", "0": "shu oy", "1": "keyingi oy" },
  },
};

function relative(locale: Locale, value: number, unit: RelativeUnit): string {
  if (locale === "ru") return new Intl.RelativeTimeFormat(intlLocale.ru, { numeric: "auto" }).format(value, unit);
  const t = uzRelative[unit];
  const exact = t.exact[String(value === 0 ? 0 : value)];
  if (exact) return exact;
  return (value < 0 ? t.past : t.future).replace("{n}", formatNumber(locale, Math.abs(value)));
}

/** "3 дня назад" / "3 kun oldin" relative to a reference instant. */
export function formatRelative(locale: Locale, iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relative(locale, minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative(locale, hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative(locale, days, "day");
  const months = Math.round(days / 30);
  return relative(locale, months, "month");
}

/* ------------------------------------------------------------ lists, sort */

const uzListWord = { conjunction: "va", disjunction: "yoki" } as const;

/** «район, бюджет и комнаты» / «tuman, byudjet va xonalar»; `disjunction` joins with «или» / «yoki». */
export function formatList(
  locale: Locale,
  items: readonly string[],
  type: "conjunction" | "disjunction" = "conjunction",
): string {
  if (locale === "ru") return new Intl.ListFormat(intlLocale.ru, { type }).format(items);
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${uzListWord[type]} ${items[items.length - 1]}`;
}

let ruCollator: Intl.Collator | undefined;

/**
 * Uzbek alphabet order: the Latin letters, then Oʻ, Gʻ, Sh, Ch after Z (all
 * apostrophe look-alikes count as one). Mapped onto code points after "z".
 */
function uzSortKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/o['‘’ʻʼ`]/g, "{")
    .replace(/g['‘’ʻʼ`]/g, "|")
    .replace(/sh/g, "}")
    .replace(/ch/g, "~");
}

/** Sort comparator for names shown to the user; the same order on the server and in every browser. */
export function compareText(locale: Locale, a: string, b: string): number {
  if (locale === "ru") {
    ruCollator ??= new Intl.Collator(intlLocale.ru);
    return ruCollator.compare(a, b);
  }
  const ka = uzSortKey(a);
  const kb = uzSortKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
