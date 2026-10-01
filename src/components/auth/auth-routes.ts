import type { Locale } from "@/i18n/config";

/**
 * URLs of the sign-in route group `src/app/[locale]/(auth)`. Other screens
 * (site header, workspace "Выйти"/"Войти", error pages) should link through
 * these helpers rather than spelling the paths out.
 */
export function loginPath(locale: Locale): string {
  return `/${locale}/login`;
}

export function onboardingPath(locale: Locale): string {
  return `/${locale}/onboarding`;
}
