import type { Metadata } from "next";
import { ChevronDown, Phone } from "lucide-react";
import { TelegramButton } from "@/components/site/cta";
import { faqEntries } from "@/components/site/faq-content";
import { JsonLd } from "@/components/site/json-ld";
import { sitePageMetadata } from "@/components/site/metadata";
import { OpenDetailsFromHash } from "@/components/site/open-details-from-hash";
import { Container, CtaBand, PageIntro } from "@/components/site/primitives";
import { faqPageJsonLd } from "@/components/site/structured-data";
import { ButtonAnchor } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import siteFaq from "@/i18n/messages/site-faq";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return sitePageMetadata(locale, "faq", siteFaq[locale].meta);
}

/**
 * FAQ as a native `<details>` accordion (works without JavaScript) plus
 * FAQPage structured data built from the very same answers.
 */
export default async function FaqPage() {
  const locale = await getLocale();
  const t = siteFaq[locale];
  const entries = faqEntries(locale);

  return (
    <>
      <PageIntro eyebrow={t.intro.eyebrow} title={t.intro.title} lead={t.intro.lead} />

      <section aria-label={t.intro.title} className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-3">
            {entries.map((entry) => (
              <details
                key={entry.id}
                id={entry.id}
                className="group scroll-mt-24 rounded-lg border border-border bg-surface shadow-card"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 text-body font-semibold text-fg hover:bg-surface-muted/60 [&::-webkit-details-marker]:hidden">
                  <span>{entry.question}</span>
                  <ChevronDown
                    aria-hidden
                    className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-3 px-5 pb-5 text-body text-pretty text-fg-muted">
                  {entry.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand id="faq-more-title" title={t.more.title} text={format(t.more.text, publicContacts.supportHours)}>
        <TelegramButton locale={locale} />
        <ButtonAnchor href={`tel:${publicContacts.phoneE164}`} variant="secondary" size="lg">
          <Phone aria-hidden className="size-4.5" />
          <span className="tabular whitespace-nowrap">{publicContacts.phoneDisplay}</span>
        </ButtonAnchor>
      </CtaBand>

      <OpenDetailsFromHash />
      <JsonLd data={faqPageJsonLd(locale, entries)} />
    </>
  );
}
