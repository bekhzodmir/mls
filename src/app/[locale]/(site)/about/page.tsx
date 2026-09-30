import type { Metadata } from "next";
import { Bot, Building2, Globe, Handshake, Smartphone, Target, UserRound, type LucideIcon } from "lucide-react";
import { TelegramButton } from "@/components/site/cta";
import { sitePageMetadata } from "@/components/site/metadata";
import { CtaBand, IconTile, PageIntro, Section } from "@/components/site/primitives";
import { sitePath } from "@/components/site/site-config";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import site from "@/i18n/messages/site";
import siteAbout from "@/i18n/messages/site-about";
import siteHome from "@/i18n/messages/site-home";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return sitePageMetadata(locale, "about", siteAbout[locale].meta);
}

/** Mission (§3.1), vision (§3.3), problem (§4.1–4.2), goals (§3.2), values (§3.4), audiences (§5), channels (§6). */
export default async function AboutPage() {
  const locale = await getLocale();
  const t = siteAbout[locale];
  const values = Object.entries(t.values.rows);
  const audience: { key: string; icon: LucideIcon; title: string; text: string }[] = [
    { key: "individual", icon: UserRound, ...t.audience.individual },
    { key: "agency", icon: Building2, ...t.audience.agency },
    { key: "partner", icon: Handshake, ...t.audience.partner },
  ];
  const vars = { bot: publicContacts.telegramBot, domain: publicContacts.domain };
  const channels: { key: string; icon: LucideIcon; title: string; text: string }[] = [
    { key: "bot", icon: Bot, title: t.channels.bot.title, text: format(t.channels.bot.text, vars) },
    { key: "miniApp", icon: Smartphone, ...t.channels.miniApp },
    { key: "site", icon: Globe, title: format(t.channels.site.title, vars), text: t.channels.site.text },
  ];
  const finalCta = siteHome[locale].finalCta;

  return (
    <>
      <PageIntro eyebrow={t.intro.eyebrow} title={t.intro.title} lead={t.intro.lead} />

      <Section id="mission" title={t.mission.title}>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <p className="border-l-4 border-primary pl-5 text-h2 font-medium text-pretty text-fg">{t.mission.text}</p>
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <h3 className="text-body font-semibold text-fg">{t.mission.visionTitle}</h3>
            <p className="mt-2 text-small text-fg-muted">{t.mission.vision}</p>
          </div>
        </div>
      </Section>

      <Section id="problem" muted title={t.problem.title} lead={t.problem.lead}>
        <h3 className="text-body font-semibold text-fg">{t.problem.listTitle}</h3>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {t.problem.items.map((item, index) => (
            <li key={item} className="flex gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-bold text-primary-soft-fg"
              >
                {index + 1}
              </span>
              <span className="text-small text-fg">{item}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="goals" title={t.goals.title}>
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {t.goals.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-body text-fg">
              <Target aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="values" muted title={t.values.title}>
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full text-left text-small">
            <caption className="sr-only">{t.values.caption}</caption>
            <thead className="bg-surface-muted">
              <tr>
                <th scope="col" className="w-1/3 px-4 py-3 font-semibold text-fg sm:w-1/4">
                  {t.values.valueColumn}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-fg">
                  {t.values.productColumn}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {values.map(([key, row]) => (
                <tr key={key}>
                  <th scope="row" className="px-4 py-3 align-top font-semibold text-fg">
                    {row.name}
                  </th>
                  <td className="px-4 py-3 align-top text-fg-muted">{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="audience" title={t.audience.title}>
        <ul className="grid gap-4 md:grid-cols-3">
          {audience.map(({ key, icon: Icon, title, text }) => (
            <li key={key} className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-body font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-small text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
        <Notice kind="info" className="mt-6">
          {t.audience.b2c}
        </Notice>
      </Section>

      <Section id="channels" muted title={t.channels.title}>
        <ul className="grid gap-4 md:grid-cols-3">
          {channels.map(({ key, icon: Icon, title, text }) => (
            <li key={key} className="flex gap-4 rounded-lg border border-border bg-surface p-5 shadow-card">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <div>
                <h3 className="text-body font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-small text-fg-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        id="about-cta-title"
        title={finalCta.title}
        text={format(finalCta.text, { bot: publicContacts.telegramBot })}
      >
        <TelegramButton locale={locale} />
        <ButtonLink href={sitePath(locale, "contacts")} variant="secondary" size="lg">
          {site[locale].nav.contacts}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
