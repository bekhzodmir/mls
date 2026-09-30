import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site/site-config";
import { locales } from "@/i18n/config";

/**
 * Crawl the public site; keep crawlers out of the private workspace and the
 * API. Workspace paths are listed per locale instead of a wildcard pattern,
 * so crawlers without wildcard support honour them too.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...locales.map((locale) => `/${locale}/app`)],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
