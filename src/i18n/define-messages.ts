import type { Locale } from "./config";

/**
 * Declares a message namespace for both locales.
 *
 * The Russian object defines the shape; the Uzbek object must provide exactly
 * the same keys (`NoInfer` stops TypeScript from widening the shape to a union
 * of both), so a missing or extra Uzbek string is a compile error rather than
 * a blank label at runtime.
 *
 * Each feature owns its own namespace file under `src/i18n/messages/`, which
 * keeps translations next to a single owner and avoids one giant dictionary.
 */
export function defineMessages<T>(messages: {
  ru: T;
  uz: NoInfer<T>;
}): Record<Locale, T> {
  return messages;
}

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  // Own keys only: `in` would also match inherited names such as {constructor}.
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

/**
 * Picks the plural form for Russian (one / few / many) or Uzbek (one / other).
 * Forms are passed explicitly so every call site stays readable in both languages.
 */
export function plural(
  locale: Locale,
  count: number,
  forms: { one: string; few?: string; many: string },
): string {
  // CLDR Uzbek has "one" for exactly 1 and "other" otherwise. It is computed
  // directly: Chromium ships no Uzbek plural data and would answer "other".
  const rule = locale === "ru" ? new Intl.PluralRules("ru-RU").select(count) : count === 1 ? "one" : "other";
  if (rule === "one") return forms.one;
  // Russian fractions ("other": 1,5; 0,5) take the genitive singular, i.e. the few form: «1,5 дня».
  if (rule === "few" || (rule === "other" && locale === "ru")) return forms.few ?? forms.many;
  return forms.many;
}
