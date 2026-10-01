import type { Locale } from "@/i18n/config";
import { authHref } from "@/lib/routes";

/**
 * URLs of the sign-in route group `src/app/[locale]/(auth)`. Other screens
 * (site header, workspace "Выйти"/"Войти", error pages) should link through
 * these helpers rather than spelling the paths out. The paths themselves are
 * defined once, in `authRoutes` of `@/lib/routes`.
 */
export function loginPath(locale: Locale): string {
  return authHref(locale, "login");
}

export function onboardingPath(locale: Locale): string {
  return authHref(locale, "onboarding");
}
