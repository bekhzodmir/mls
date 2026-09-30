import Link from "next/link";
import {
  Building,
  Building2,
  Eye,
  EyeOff,
  Filter,
  Handshake,
  Info,
  Languages,
  Link2,
  Lock,
  MapPin,
  Quote,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserSearch,
  Users,
  type LucideIcon,
} from "lucide-react";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import matching from "@/i18n/messages/matching";
import siteHome from "@/i18n/messages/site-home";
import { formatMoney, money } from "@/lib/domain/money";
import { DemoButton, DemoNote, TelegramButton } from "./cta";
import { exampleReasons, HeroDiagram, MatchExample, RadarPostExample, SplitPresets } from "./illustrations";
import { Container, Glow, IconTile, Section, textLinkClass } from "./primitives";
import { sitePath } from "./site-config";

/**
 * Sections of the home page (§9.5): hero with the short formula (§2.2),
 * matching explained by reasons (§12.4), Telegram Radar with its canonical
 * claim and limits (§7.2), co-broking between realtors (§7.4, §41 D2/D10),
 * staged disclosure (§16.3, §18.2) and the professional audience (§5).
 */

export function HomeHero({ locale }: { locale: Locale }) {
  const t = siteHome[locale].hero;
  const facts: { icon: LucideIcon; text: string }[] = [
    { icon: Send, text: t.facts.channel },
    { icon: Languages, text: t.facts.languages },
    { icon: MapPin, text: t.facts.region },
    { icon: Building, text: t.facts.deals },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-border">
      <Glow />
      <Container className="grid grid-cols-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-24">
        <div>
          <Badge tone="brand" icon={Users}>
            {t.eyebrow}
          </Badge>
          <h1 id="hero-title" className="mt-5 text-display text-balance text-fg sm:text-[2.75rem] lg:text-[3.25rem]">
            <span className="block">{t.line1}</span>{" "}
            <span className="block">{t.line2}</span>{" "}
            <span className="block text-primary">{t.line3}</span>
          </h1>
          <p className="mt-5 max-w-xl text-body text-pretty text-fg-muted sm:text-lg">{t.lead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TelegramButton locale={locale} />
            <DemoButton locale={locale} />
          </div>
          <DemoNote locale={locale} className="mt-3" />
          <ul
            aria-label={t.factsLabel}
            className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 text-small text-fg-muted sm:flex sm:flex-wrap sm:gap-x-6"
          >
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon aria-hidden className="size-4 shrink-0 text-primary-soft-fg" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <HeroDiagram locale={locale} />
      </Container>
    </section>
  );
}

export function MatchingSection({ locale }: { locale: Locale }) {
  const t = siteHome[locale].matching;
  const steps: { key: string; icon: LucideIcon; title: string; text: string }[] = [
    { key: "object", icon: Building2, ...t.steps.object },
    { key: "request", icon: UserSearch, ...t.steps.request },
    { key: "match", icon: Sparkles, ...t.steps.match },
  ];
  // Sentences in the product's own style (§12.4); the price one comes from its formatter.
  const phrasings = [
    summarizeMatch(locale, exampleReasons(siteHome[locale].example.parking)),
    format(matching[locale].reason.price_over, { amount: formatMoney(locale, money(8_000, "USD")) }),
  ];

  return (
    <Section id="matching" eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          <ol className="space-y-3">
            {steps.map(({ key, icon: Icon, title, text }) => (
              <li key={key} className="flex gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <div>
                  <h3 className="text-body font-semibold text-fg">{title}</h3>
                  <p className="mt-1 text-small text-fg-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <h3 className="text-body font-semibold text-fg">{t.explainTitle}</h3>
            <p className="mt-1 text-small text-fg-muted">{t.explainText}</p>
            <ul className="mt-3 space-y-2">
              {phrasings.map((text) => (
                <li key={text} className="flex items-start gap-2 text-small font-medium text-fg">
                  <Quote aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-start gap-2 text-small text-fg-muted">
            <Filter aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t.hardFilters}</span>
          </p>
        </div>

        <MatchExample locale={locale} />
      </div>
    </Section>
  );
}

export function RadarSection({ locale }: { locale: Locale }) {
  const t = siteHome[locale].radar;
  const points: { key: string; icon: LucideIcon; text: string }[] = [
    { key: "source", icon: Link2, text: t.points.source },
    { key: "search", icon: Search, text: t.points.search },
  ];

  return (
    <Section
      id="radar"
      muted
      eyebrow={
        <span className="inline-flex items-center gap-2">
          {t.eyebrow}
          <Badge tone="brand" icon={Sparkles}>
            {t.badge}
          </Badge>
        </span>
      }
      title={t.title}
      lead={t.lead}
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div className="space-y-6">
          <ul className="space-y-4">
            {points.map(({ key, icon: Icon, text }) => (
              <li key={key} className="flex items-start gap-3 text-body text-fg">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <span className="pt-2.5">{text}</span>
              </li>
            ))}
          </ul>
          <Notice kind="info" title={t.limitsTitle}>
            {t.limits}
          </Notice>
        </div>
        <RadarPostExample locale={locale} />
      </div>
    </Section>
  );
}

export function CobrokingSection({ locale }: { locale: Locale }) {
  const t = siteHome[locale].cobroking;
  const steps = [t.steps.propose, t.steps.respond, t.steps.reveal];

  return (
    <Section id="cooperation" eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <SplitPresets locale={locale} label={t.splitsLabel} />
      <p className="mt-4 flex max-w-3xl items-start gap-2 text-small text-fg-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{t.sidesNote}</span>
      </p>

      <ol aria-label={t.stepsLabel} className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-small font-bold text-primary-fg"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-body font-semibold text-fg">{step.title}</h3>
              <p className="mt-1 text-small text-fg-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Notice kind="info" className="mt-6">
        {t.notFee}
      </Notice>
    </Section>
  );
}

export function TrustSection({ locale }: { locale: Locale }) {
  const t = siteHome[locale].trust;
  const stages: { key: string; icon: LucideIcon; title: string; visible: string; hidden: string }[] = [
    { key: "match", icon: Sparkles, ...t.stages.match },
    { key: "agreed", icon: Handshake, ...t.stages.agreed },
    { key: "deal", icon: Lock, ...t.stages.deal },
  ];

  return (
    <Section id="trust" muted eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <ol className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {stages.map(({ key, icon: Icon, title, visible, hidden }) => (
          <li key={key} className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <h3 className="text-body font-semibold text-fg">{title}</h3>
            </div>
            <dl className="mt-4 space-y-3 text-small">
              <div>
                <dt className="flex items-center gap-1.5 font-semibold text-fg">
                  <Eye aria-hidden className="size-4 text-success-fg" />
                  {t.visible}
                </dt>
                <dd className="mt-1 text-fg-muted">{visible}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 font-semibold text-fg">
                  <EyeOff aria-hidden className="size-4 text-fg-subtle" />
                  {t.hidden}
                </dt>
                <dd className="mt-1 text-fg-muted">{hidden}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        <p className="flex max-w-3xl items-start gap-2 text-small text-fg-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t.control}</span>
        </p>
        <Link href={`${sitePath(locale, "faq")}#visibility`} className={`${textLinkClass} inline-flex min-h-11 items-center text-small`}>
          {t.faqLink}
        </Link>
      </div>
    </Section>
  );
}

export function AudienceSection({ locale }: { locale: Locale }) {
  const t = siteHome[locale].audience;
  const groups: { key: string; icon: LucideIcon; title: string; text: string }[] = [
    { key: "individual", icon: UserRound, ...t.individual },
    { key: "agency", icon: Building2, ...t.agency },
    { key: "partner", icon: Handshake, ...t.partner },
  ];

  return (
    <Section id="audience" eyebrow={t.eyebrow} title={t.title}>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {groups.map(({ key, icon: Icon, title, text }) => (
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
        {t.b2c}
      </Notice>
    </Section>
  );
}
