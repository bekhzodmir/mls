import { DISPLAY_TIME_ZONE, intlLocale, type Locale } from "./config";

/**
 * Locale-aware display helpers. Everything is rendered in Tashkent time
 * (Asia/Tashkent) regardless of where the server runs, so server and client
 * output match and hydration stays stable.
 */

export function formatDate(
  locale: Locale,
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
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

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale[locale], options).format(value);
}

/** "3 дня назад" / "3 kun oldin" relative to a reference instant. */
export function formatRelative(locale: Locale, iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto" });
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  return rtf.format(months, "month");
}
