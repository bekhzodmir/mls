import type { MetadataRoute } from "next";
import { absoluteUrl, languageAlternates, sitePages, sitePath } from "@/components/site/site-config";
import { locales } from "@/i18n/config";

/**
 * Every public page in every locale, each with its hreflang alternates
 * (ru, uz, x-default) — §42.2, recommendation 7. The workspace (/{locale}/app)
 * is private and deliberately absent.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitePages.flatMap((page) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(page)).map(([hreflang, path]) => [hreflang, absoluteUrl(path)]),
    );
    return locales.map((locale) => ({
      url: absoluteUrl(sitePath(locale, page)),
      changeFrequency: "monthly" as const,
      priority: page === "home" ? 1 : 0.7,
      alternates: { languages },
    }));
  });
}
