import { locales, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

/**
 * Public site map (§9.5, §42.1) plus the FAQ recommended in §42.2. Every page
 * exists in each locale under its own URL prefix, so search engines get
 * unique URLs, hreflang pairs and a sitemap (§42.2, recommendation 7).
 *
 * Pure data and string helpers: safe to import from client components, route
 * handlers and tests.
 */
export const sitePages = ["home", "howItWorks", "about", "contacts", "faq"] as const;

export type SitePage = (typeof sitePages)[number];

const pagePaths: Record<SitePage, string> = {
  home: "",
  howItWorks: "/how-it-works",
  about: "/about",
  contacts: "/contacts",
  faq: "/faq",
};

/** "/ru", "/uz/how-it-works" … */
export function sitePath(locale: Locale, page: SitePage): string {
  return `/${locale}${pagePaths[page]}`;
}

/**
 * The locale-less path ("/", "/about"). The proxy redirects it to the
 * visitor's language, which is exactly what hreflang `x-default` describes.
 */
export function neutralPath(page: SitePage): string {
  return pagePaths[page] || "/";
}

/** Absolute URL on the canonical origin (`siteUrl`), for sitemaps and JSON-LD. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

/** hreflang map for one page: every locale plus `x-default`, as root-relative paths. */
export function languageAlternates(page: SitePage): Record<Locale | "x-default", string> {
  const entries = locales.map((locale) => [locale, sitePath(locale, page)] as const);
  return { ...(Object.fromEntries(entries) as Record<Locale, string>), "x-default": neutralPath(page) };
}

/** True when `pathname` is the given page in the given locale (trailing slash tolerated). */
export function isCurrentPage(pathname: string, locale: Locale, page: SitePage): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return normalized === sitePath(locale, page);
}
