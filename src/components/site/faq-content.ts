import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import siteFaq from "@/i18n/messages/site-faq";
import { defaultFreshnessConfig } from "@/lib/domain/freshness";
import { publicContacts } from "@/lib/site";

export type FaqId = keyof (typeof siteFaq)["ru"]["items"];

/** Display order: what Binor is → how it works → data and money → practicalities. */
export const faqOrder: readonly FaqId[] = [
  "what",
  "who",
  "matching",
  "radar",
  "duplicates",
  "visibility",
  "commission",
  "languages",
  "pricing",
  "privacy",
];

export interface FaqEntry {
  id: FaqId;
  question: string;
  /** Plain-text paragraphs, rendered on the page and reused verbatim in FAQPage JSON-LD. */
  answer: string[];
}

/**
 * Resolved FAQ for a locale. Contacts, hours, freshness thresholds and their
 * labels are filled from their single sources so the answers cannot drift
 * from the product or from `publicContacts`.
 */
export function faqEntries(locale: Locale): FaqEntry[] {
  const t = siteFaq[locale];
  const freshness = domain[locale].freshness;
  const upTo = (n: number) => format(t.upTo, { n, days: plural(locale, n, t.days) });
  const values = {
    bot: publicContacts.telegramBot,
    phone: publicContacts.phoneDisplay,
    from: publicContacts.supportHours.from,
    to: publicContacts.supportHours.to,
    fresh: upTo(defaultFreshnessConfig.freshMaxDays),
    normal: upTo(defaultFreshnessConfig.normalMaxDays),
    aging: upTo(defaultFreshnessConfig.agingMaxDays),
    freshLabel: freshness.fresh,
    normalLabel: freshness.normal,
    agingLabel: freshness.aging,
    needsLabel: freshness.needs_confirmation,
  };

  return faqOrder.map((id) => ({
    id,
    question: t.items[id].q,
    answer: t.items[id].a.map((paragraph) => format(paragraph, values)),
  }));
}
