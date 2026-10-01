import type { Metadata } from "next";
import { AtSign, Clock, Languages, MapPin, Phone, Send, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NewTabNote, TelegramButton } from "@/components/site/cta";
import { sitePageMetadata } from "@/components/site/metadata";
import { Container, IconTile, PageIntro, Section } from "@/components/site/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import siteContacts from "@/i18n/messages/site-contacts";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const meta = siteContacts[locale].meta;
  return sitePageMetadata(locale, "contacts", {
    title: meta.title,
    description: format(meta.description, { bot: publicContacts.telegramBot, ...publicContacts.supportHours }),
  });
}

function ContactCard({
  icon: Icon,
  title,
  value,
  text,
  hours,
  action,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  text: string;
  hours?: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <IconTile>
          <Icon className="size-5" />
        </IconTile>
        <h3 className="text-body font-semibold text-fg">{title}</h3>
      </div>
      <p className="mt-4 text-h2 text-fg">{value}</p>
      <p className="mt-1 text-small text-fg-muted">{text}</p>
      {hours ? (
        <p className="mt-3">
          <Badge icon={Clock}>{hours}</Badge>
        </p>
      ) : null}
      <div className="mt-auto pt-5">{action}</div>
    </li>
  );
}

/**
 * Public contacts only (§42.3): Telegram bot (24/7), phone support with its
 * hours in Tashkent time, Instagram and the region. No address, legal entity
 * or e-mail is shown because none is publicly disclosed (§41 D13).
 */
export default async function ContactsPage() {
  const locale = await getLocale();
  const t = siteContacts[locale];
  const hours = publicContacts.supportHours;
  const details: { key: string; icon: LucideIcon; term: string; value: string }[] = [
    { key: "region", icon: MapPin, term: t.details.region, value: t.details.regionValue },
    { key: "languages", icon: Languages, term: t.details.languages, value: t.details.languagesValue },
    { key: "bot", icon: Send, term: t.details.bot, value: t.details.botValue },
    { key: "phone", icon: Phone, term: t.details.phone, value: format(t.details.phoneValue, hours) },
  ];

  return (
    <>
      <PageIntro eyebrow={t.intro.eyebrow} title={t.intro.title} lead={t.intro.lead} />

      <section aria-labelledby="channels-title" className="py-14 sm:py-20">
        <Container>
          <h2 id="channels-title" className="sr-only">
            {t.channelsLabel}
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ContactCard
              icon={Send}
              title={t.telegram.title}
              value={`@${publicContacts.telegramBot}`}
              text={t.telegram.text}
              hours={t.telegram.hours}
              action={<TelegramButton locale={locale} size="md" label={t.telegram.action} className="w-full" />}
            />
            <ContactCard
              icon={Phone}
              title={t.phone.title}
              value={<span className="tabular whitespace-nowrap">{publicContacts.phoneDisplay}</span>}
              text={t.phone.text}
              hours={format(t.phone.hours, hours)}
              action={
                <ButtonAnchor href={`tel:${publicContacts.phoneE164}`} variant="secondary" className="w-full">
                  <Phone aria-hidden className="size-4.5" />
                  {t.phone.action}
                </ButtonAnchor>
              }
            />
            <ContactCard
              icon={AtSign}
              title={t.instagram.title}
              value={`@${publicContacts.instagram}`}
              text={t.instagram.text}
              action={
                <ButtonAnchor
                  href={publicContacts.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  className="w-full"
                >
                  <AtSign aria-hidden className="size-4.5" />
                  {t.instagram.action}
                  <NewTabNote locale={locale} />
                </ButtonAnchor>
              }
            />
          </ul>
        </Container>
      </section>

      <Section id="details" muted title={t.details.title}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {details.map(({ key, icon: Icon, term, value }) => (
            // One wrapper with <dt>/<dd> as direct children keeps the term–value pairs valid;
            // the decorative icon sits inside the <dt>, positioned in the card's left gutter.
            <div key={key} className="relative min-h-21 rounded-lg border border-border bg-surface p-5 pl-20 shadow-card">
              <dt className="text-small text-fg-muted">
                <IconTile className="absolute top-5 left-5">
                  <Icon className="size-5" />
                </IconTile>
                {term}
              </dt>
              <dd className="mt-0.5 text-body font-semibold text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        <Notice kind="info" title={t.radarNote.title} className="mt-6">
          {t.radarNote.text}
        </Notice>
      </Section>
    </>
  );
}
