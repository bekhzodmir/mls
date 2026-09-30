/**
 * Locale configuration shared by server code, the proxy and client components.
 *
 * Binor ships with Russian and Uzbek (Latin script) at full parity (§36.1 of the
 * master document). Every locale gets its own URL prefix so the public site can
 * expose unique metadata, hreflang and a sitemap (§42.2, recommendation 7).
 */
export const locales = ["ru", "uz"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Cookie that remembers an explicit language choice made in the switcher. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function hasLocale(value: string | undefined | null): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** BCP 47 tags for `Intl` formatting and the `<html lang>` attribute. */
export const intlLocale: Record<Locale, string> = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
};

export const htmlLang: Record<Locale, string> = {
  ru: "ru",
  uz: "uz-Latn",
};

/** Self-names shown in the language switcher. */
export const localeLabels: Record<Locale, { short: string; long: string }> = {
  ru: { short: "RU", long: "Русский" },
  uz: { short: "UZ", long: "O‘zbekcha" },
};

/** All product time is displayed in Tashkent time; storage stays UTC (§34.1). */
export const DISPLAY_TIME_ZONE = "Asia/Tashkent";
