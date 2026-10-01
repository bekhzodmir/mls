import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  CircleHelp,
  Globe,
  LogOut,
  MessageCircleQuestion,
  ShieldQuestion,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { sidebarGroups } from "@/components/app/nav-config";
import { PageHeader } from "@/components/app/page-header";
import { VerificationBadge } from "@/components/domain/badges";
import { LocaleSwitch } from "@/components/locale-switch";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import { localeLabels, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import more from "@/i18n/messages/more";
import shell from "@/i18n/messages/shell";
import { getLocale } from "@/i18n/server";
import { getViewer } from "@/lib/data/repository";
import { formatUzPhone } from "@/lib/domain/phone";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import type { ProfessionalStatus, VerificationItem, VerificationSubject } from "@/lib/domain/types";
import { appPath, authHref } from "@/lib/routes";
import { publicContacts } from "@/lib/site";
import { NotificationPreferences } from "./notification-preferences";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: more[locale].meta.title };
}

/** The legal status is its own fact (§38.2): a certified realtor ≠ a real-estate agent. */
const statusStyle: Record<ProfessionalStatus, { tone: Tone; icon: LucideIcon }> = {
  certified_realtor: { tone: "success", icon: BadgeCheck },
  real_estate_agent: { tone: "info", icon: BadgeCheck },
  unconfirmed: { tone: "warning", icon: UserRoundX },
};

/**
 * One verified fact per row (§16.4, §38.2): the badge names the subject and
 * outcome; method, source and dates are spelled out next to it. A fact that
 * was never provided is shown as "no data", not skipped and not implied.
 */
function FactRow({
  locale,
  subject,
  item,
}: {
  locale: Locale;
  subject: VerificationSubject;
  item: VerificationItem | undefined;
}) {
  const t = more[locale].verification;
  const d = domain[locale];
  if (!item) {
    return (
      <li className="space-y-1 px-4 py-3">
        <Badge icon={ShieldQuestion}>{format(t.missing, { subject: d.verificationSubject[subject] })}</Badge>
        <p className="text-caption text-fg-muted">{t.missingHint}</p>
      </li>
    );
  }
  return (
    <li className="space-y-1 px-4 py-3">
      <VerificationBadge locale={locale} item={item} />
      <div className="space-y-0.5 text-caption text-fg-muted">
        <p>{format(t.method, { method: d.verificationMethod[item.method] })}</p>
        <p>{format(t.source, { source: item.source })}</p>
        <p>{item.checkedAt ? format(t.checkedAt, { date: formatDate(locale, item.checkedAt) }) : t.notChecked}</p>
        {item.expiresAt ? <p>{format(t.expiresAt, { date: formatDate(locale, item.expiresAt) })}</p> : null}
        {item.note ? <p>{item.note}</p> : null}
      </div>
    </li>
  );
}

/** Section groups for the "All sections" grid; Today is the home tab and is left out. */
const sectionGroups = sidebarGroups
  .map((group) => ({
    ...group,
    items: group.items.flatMap((item) => (item.key === "today" ? [] : [{ ...item, key: item.key }])),
  }))
  .filter((group) => group.items.length > 0);

/** "Ещё" (§9.1, §21.4 screens 100–102): profile, verified facts, sections, language, notifications. */
export default async function MorePage() {
  const locale = await getLocale();
  const t = more[locale];
  const d = domain[locale];
  const nav = shell[locale].sidebar;
  const groupTitles = shell[locale].sidebarGroups;
  const { agent, organization } = await getViewer();
  const professionalStatus = displayedProfessionalStatus(agent);
  const status = statusStyle[professionalStatus];
  const agentFact = (subject: VerificationSubject) => agent.verifications.find((item) => item.subject === subject);

  return (
    <div className="space-y-6">
      <PageHeader locale={locale} title={t.title} className="mb-0" />

      <section aria-labelledby="more-profile">
        <h2 id="more-profile" className="sr-only">
          {t.profile.title}
        </h2>
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={agent.name} className="size-14 text-body" />
            <div className="min-w-0 space-y-1">
              <p className="text-h2 text-fg">{agent.name}</p>
              <p>
                <span className="sr-only">{t.profile.status}: </span>
                <Badge tone={status.tone} icon={status.icon}>
                  {d.professionalStatus[professionalStatus]}
                </Badge>
              </p>
            </div>
          </div>
          <dl className="divide-y divide-border border-t border-border">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.profile.role}</dt>
              <dd className="text-right text-small font-medium text-fg">{d.role[agent.role]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.profile.organization}</dt>
              <dd className="text-right text-small font-medium text-fg">
                {organization ? organization.name : t.profile.noOrganization}
                {organization?.branchName ? (
                  <span className="block text-caption font-normal text-fg-muted">
                    {format(t.profile.branch, { name: organization.branchName })}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.profile.phone}</dt>
              <dd className="tabular text-right text-small font-medium text-fg">{formatUzPhone(agent.phone)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.profile.telegram}</dt>
              <dd className="text-right text-small font-medium text-fg">
                {agent.telegramUsername ? `@${agent.telegramUsername}` : t.profile.unknown}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section aria-labelledby="more-facts" className="space-y-3">
        <SectionHeader id="more-facts" title={t.verification.title} />
        <p className="text-small text-fg-muted">{t.verification.text}</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <h3 className="px-4 pt-4 text-small font-semibold text-fg-muted">
              {t.verification.agent} · {agent.name}
            </h3>
            <ul className="divide-y divide-border">
              <FactRow locale={locale} subject="agent_identity" item={agentFact("agent_identity")} />
              <FactRow locale={locale} subject="agent_certificate" item={agentFact("agent_certificate")} />
            </ul>
          </Card>
          {organization ? (
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-4 text-small font-semibold text-fg-muted">
                {t.verification.organization} · {organization.name}
              </h3>
              <ul className="divide-y divide-border">
                <FactRow locale={locale} subject="org_registry" item={organization.registry} />
                <FactRow locale={locale} subject="insurance" item={organization.insurance} />
              </ul>
            </Card>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="more-sections" className="space-y-4">
        <SectionHeader id="more-sections" title={t.sections.title} />
        {sectionGroups.map((group) => {
          const headingId = `more-sections-${group.key}`;
          return (
            <div key={group.key} className="space-y-2">
              <h3 id={headingId} className="text-small font-semibold text-fg-muted">
                {groupTitles[group.key]}
              </h3>
              <ul aria-labelledby={headingId} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ key, href, icon: Icon }) => (
                  <li key={key}>
                    <Link
                      href={appPath(locale, href)}
                      className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-fg transition-colors hover:border-primary hover:bg-primary-soft/40"
                    >
                      <Icon aria-hidden className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-small font-medium">{nav[key]}</span>
                        <span className="block text-caption text-fg-muted">{t.sections.hints[key]}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="more-language" className="space-y-3">
        <SectionHeader id="more-language" title={t.language.title} />
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-small font-semibold text-fg">
              <Globe aria-hidden className="size-4 text-fg-muted" />
              {localeLabels[locale].long}
            </p>
            <p className="text-caption text-fg-muted">{t.language.text}</p>
          </div>
          <LocaleSwitch locale={locale} label={t.language.title} />
        </Card>
      </section>

      <section id="notification-settings" aria-labelledby="more-notifications" className="scroll-mt-20 space-y-3">
        <SectionHeader id="more-notifications" title={t.notifications.title} />
        <NotificationPreferences locale={locale} />
      </section>

      <section aria-labelledby="more-account" className="space-y-3">
        <SectionHeader id="more-account" title={t.account.title} />
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="min-w-0 flex-1 text-caption text-fg-muted">{t.account.text}</p>
          <ButtonLink href={authHref(locale, "login")} variant="secondary">
            <LogOut aria-hidden className="size-4" />
            {t.account.switch}
          </ButtonLink>
        </Card>
      </section>

      <section aria-labelledby="more-help" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 id="more-help" className="sr-only">
          {t.support.title}
        </h2>
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-fg">
            <CircleHelp aria-hidden className="size-4 text-fg-muted" />
            {t.site.title}
          </p>
          <p className="text-caption text-fg-muted">{t.site.text}</p>
          <ButtonLink href={`/${locale}`} variant="secondary">
            {t.site.link}
          </ButtonLink>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-fg">
            <MessageCircleQuestion aria-hidden className="size-4 text-fg-muted" />
            {t.support.title}
          </p>
          <p className="text-caption text-fg-muted">{format(t.support.text, { bot: publicContacts.telegramBot })}</p>
          <ButtonAnchor href={publicContacts.telegramBotUrl} target="_blank" rel="noopener noreferrer" variant="secondary">
            @{publicContacts.telegramBot}
          </ButtonAnchor>
        </Card>
      </section>
    </div>
  );
}
