import type { Metadata } from "next";
import {
  BellRing,
  Eye,
  Handshake,
  ListPlus,
  MessageCircleQuestion,
  Radar,
  Scale,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { TelegramButton } from "@/components/site/cta";
import { sitePageMetadata } from "@/components/site/metadata";
import { Container, CtaBand, IconTile, PageIntro, Section } from "@/components/site/primitives";
import { sitePath } from "@/components/site/site-config";
import { ButtonLink } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import siteHow from "@/i18n/messages/site-how";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return sitePageMetadata(locale, "howItWorks", siteHow[locale].meta);
}

const stepIcons: Record<keyof (typeof siteHow)["ru"]["steps"], LucideIcon> = {
  register: Send,
  add: ListPlus,
  match: Sparkles,
  notify: BellRing,
  deal: Handshake,
};

/** The public five-step path (§8.1), each with what other realtors can see at that point. */
export default async function HowItWorksPage() {
  const locale = await getLocale();
  const t = siteHow[locale];
  const steps = (Object.keys(stepIcons) as (keyof typeof stepIcons)[]).map((key) => ({
    key,
    icon: stepIcons[key],
    ...t.steps[key],
  }));
  const principles: { key: string; icon: LucideIcon; title: string; text: string }[] = [
    { key: "reasons", icon: Sparkles, ...t.principles.reasons },
    { key: "split", icon: Scale, ...t.principles.split },
    { key: "radar", icon: Radar, ...t.principles.radar },
  ];

  return (
    <>
      <PageIntro eyebrow={t.intro.eyebrow} title={t.intro.title} lead={t.intro.lead}>
        <TelegramButton locale={locale} />
      </PageIntro>

      <section aria-label={t.stepsLabel} className="py-14 sm:py-20">
        <Container>
          <div className="relative mx-auto max-w-3xl">
            {/* Timeline rail behind the step numbers. */}
            <span aria-hidden className="absolute top-6 bottom-6 left-5.5 w-px bg-border sm:left-6.5" />
            <ol className="relative space-y-6">
              {steps.map(({ key, icon: Icon, title, text, visible }, index) => (
                <li key={key} className="relative flex gap-4 sm:gap-6">
                  <span
                    aria-hidden
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-body font-bold text-primary-fg ring-4 ring-bg sm:size-13"
                  >
                    {index + 1}
                  </span>
                  <article className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-5 shadow-card">
                    <p className="text-caption font-semibold tracking-wide text-fg-subtle uppercase">
                      {format(t.stepLabel, { n: index + 1 })}
                    </p>
                    <h2 className="mt-1 flex items-start gap-2 text-h2 text-fg">
                      <Icon aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
                      <span>{title}</span>
                    </h2>
                    <p className="mt-2 text-body text-pretty text-fg-muted">
                      {format(text, { bot: publicContacts.telegramBot })}
                    </p>
                    <div className="mt-4 flex gap-3 rounded-md border border-border bg-surface-muted p-3">
                      <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-soft-fg" />
                      <div>
                        <p className="text-small font-semibold text-fg">{t.visibleLabel}</p>
                        <p className="text-small text-fg-muted">{visible}</p>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <Section id="principles" muted title={t.principles.title}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {principles.map(({ key, icon: Icon, title, text }) => (
            <li key={key} className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-body font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-small text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand id="how-cta-title" title={t.cta.title} text={t.cta.text}>
        <TelegramButton locale={locale} />
        <ButtonLink href={sitePath(locale, "faq")} variant="secondary" size="lg">
          <MessageCircleQuestion aria-hidden className="size-4.5" />
          {t.cta.faqLink}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
