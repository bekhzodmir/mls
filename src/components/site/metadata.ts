import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n/config";
import site from "@/i18n/messages/site";
import { publicContacts } from "@/lib/site";
import { languageAlternates, sitePath, type SitePage } from "./site-config";

/** Open Graph locale codes (language_TERRITORY). */
export const ogLocale: Record<Locale, string> = { ru: "ru_RU", uz: "uz_UZ" };

/** Size of the generated `[locale]/opengraph-image`. */
export const ogImageSize = { width: 1200, height: 630 } as const;

/** Title template applied by the site layout to every page except home. */
export const siteTitleTemplate = `%s · ${publicContacts.brand}`;

/**
 * Metadata for one public page: unique title and description per locale,
 * a self-referencing canonical, hreflang alternates (ru, uz, x-default) and
 * Open Graph / Twitter cards (§42.2, recommendation 7).
 *
 * Open Graph is set per page, which replaces the parent's object wholesale,
 * so the localized share image is referenced explicitly here rather than
 * relying on file-based inheritance.
 */
export function sitePageMetadata(
  locale: Locale,
  page: SitePage,
  copy: { title: string; description: string },
): Metadata {
  const path = sitePath(locale, page);
  const isHome = page === "home";
  const fullTitle = isHome ? copy.title : siteTitleTemplate.replace("%s", copy.title);

  return {
    title: isHome ? { absolute: copy.title } : copy.title,
    description: copy.description,
    alternates: {
      canonical: path,
      languages: languageAlternates(page),
    },
    openGraph: {
      type: "website",
      siteName: publicContacts.brand,
      locale: ogLocale[locale],
      alternateLocale: locales.filter((other) => other !== locale).map((other) => ogLocale[other]),
      url: path,
      title: fullTitle,
      description: copy.description,
      images: [{ url: `/${locale}/opengraph-image`, ...ogImageSize, alt: site[locale].meta.ogAlt }],
    },
    // Title, description and image are filled in from Open Graph by Next.
    twitter: { card: "summary_large_image" },
  };
}
