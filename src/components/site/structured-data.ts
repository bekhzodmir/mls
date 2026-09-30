import { htmlLang, type Locale } from "@/i18n/config";
import site from "@/i18n/messages/site";
import { publicContacts } from "@/lib/site";
import { absoluteUrl, sitePath } from "./site-config";

/**
 * schema.org payloads for the public site. Only the public contacts from §42.3
 * are described: no legal name, address, founder or rating, because none is
 * publicly disclosed (§41 D13) and inventing them would mislead.
 */

type JsonLdObject = Record<string, unknown>;

const organizationId = `${absoluteUrl("/")}#organization`;

/** Tashkent is UTC+5 all year (no DST), so the offset is fixed. */
const TASHKENT_OFFSET = "+05:00";

export function organizationJsonLd(locale: Locale): JsonLdObject {
  const t = site[locale];
  const languages = ["ru", "uz"];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: publicContacts.brand,
        url: absoluteUrl("/"),
        description: t.meta.defaultDescription,
        sameAs: [publicContacts.telegramBotUrl, publicContacts.instagramUrl],
        areaServed: [
          { "@type": "City", name: t.structuredData.city },
          { "@type": "AdministrativeArea", name: t.structuredData.region },
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: publicContacts.phoneE164,
            availableLanguage: languages,
            areaServed: "UZ",
            // Days are not published (§42.3), so only the daily window is stated.
            hoursAvailable: {
              "@type": "OpeningHoursSpecification",
              opens: `${publicContacts.supportHours.from}:00${TASHKENT_OFFSET}`,
              closes: `${publicContacts.supportHours.to}:00${TASHKENT_OFFSET}`,
            },
          },
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            url: publicContacts.telegramBotUrl,
            availableLanguage: languages,
            areaServed: "UZ",
            // The bot is publicly stated as available 24/7.
            hoursAvailable: {
              "@type": "OpeningHoursSpecification",
              opens: "00:00:00",
              closes: "23:59:59",
            },
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl(sitePath(locale, "home"))}#website`,
        name: publicContacts.brand,
        url: absoluteUrl(sitePath(locale, "home")),
        inLanguage: htmlLang[locale],
        publisher: { "@id": organizationId },
      },
    ],
  };
}

/** FAQPage for /faq; answers are the plain paragraphs rendered on the page. */
export function faqPageJsonLd(
  locale: Locale,
  entries: { question: string; answer: string[] }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl(sitePath(locale, "faq")),
    inLanguage: htmlLang[locale],
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer.join("\n\n") },
    })),
  };
}

/**
 * JSON for an inline `<script type="application/ld+json">`. `<` is escaped so
 * no string can close the script element (Next.js JSON-LD guide).
 */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
