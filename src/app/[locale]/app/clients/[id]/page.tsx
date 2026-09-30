import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  FileWarning,
  Handshake,
  History,
  ListPlus,
  Phone,
  Plus,
  Quote,
  SearchCheck,
  Send,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { ClientStatusBadge, ConsentStateBadge, LeadSourceBadge } from "@/components/app/crm/badges";
import { leadingRequirement, NextAction } from "@/components/app/crm/client-card";
import { ClientMemory } from "@/components/app/crm/client-memory";
import { ClientMoreMenu } from "@/components/app/crm/client-more-menu";
import { buildClientTimeline, type TimelineEvent } from "@/components/app/crm/client-timeline";
import { contactRevokedAt } from "@/components/app/crm/duplicates";
import { telegramHref } from "@/components/app/crm/lead-card";
import {
  ChipRow,
  CrmSection,
  StickyActionBar,
  StickyBarSpacer,
  stickyActionClasses,
} from "@/components/app/crm/layout-parts";
import { listingHref, matchTargetHref, matchTargetLabel, propertyLabel } from "@/components/app/crm/object-label";
import { requirementChips } from "@/components/app/crm/requirement-summary";
import { PageHeader } from "@/components/app/page-header";
import { BandBadge, FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Chip, ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { intlLocale, type Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate, formatDateTime, formatList } from "@/i18n/format";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadClient } from "@/lib/data/cached";
import { getViewer } from "@/lib/data/repository";
import { formatMoney } from "@/lib/domain/money";
import { formatUzPhone, maskUzPhone, telHref } from "@/lib/domain/phone";
import { appHref, appPath } from "@/lib/routes";

const TIMELINE_PREVIEW = 8;

const primaryAction = "bg-primary text-primary-fg hover:bg-primary-hover";
const secondaryAction = "border border-border bg-surface text-fg hover:bg-surface-muted";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/clients/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadClient(id);
  return { title: detail?.client.name ?? clients[locale].meta.title };
}

function list(locale: Locale, items: string[]): string {
  return formatList(locale, items);
}

function timelineText(locale: Locale, event: TimelineEvent): string {
  const t = clients[locale].timeline;
  const d = domain[locale];
  switch (event.kind) {
    case "lead_received":
      return format(t.leadReceived, { source: d.leadSource[event.source] });
    case "created":
      return t.created;
    case "requirement_created":
      return t.requirementCreated;
    case "requirement_updated":
      return format(t.requirementUpdated, { n: event.version });
    case "viewing":
      return format(t.viewing, { status: d.viewingStatus[event.status] });
    case "offer":
      return format(t.offer, {
        amount: formatMoney(locale, event.amount),
        by: clients[locale].offers.by[event.by],
      });
    case "deal":
      return format(t.deal, { stage: d.dealStage[event.stage] });
    case "consent_granted":
      return format(t.consentGranted, { purpose: d.consentPurpose[event.purpose] });
    case "consent_revoked":
      return format(t.consentRevoked, { purpose: d.consentPurpose[event.purpose] });
    case "memory":
      return format(t.memory, { text: event.text });
    case "last_contact":
      return t.lastContact;
  }
}

/**
 * Client profile (§14.3, §22.3, §36.3): top block with status, what the
 * client looks for and who owns them; sticky Call / Write / Task / More; then
 * requirements, matches, viewings, offers, deals, related parties, consents,
 * remembered preferences and the timeline. Contacts are visible to the
 * responsible agent and masked with an explanation otherwise.
 */
export default async function ClientPage({ params }: PageProps<"/[locale]/app/clients/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const [detail, viewer] = await Promise.all([loadClient(id), getViewer()]);
  if (!detail) notFound();

  const t = clients[locale];
  const d = domain[locale];
  const at = now();
  const { client } = detail;
  const canSeeContacts = client.responsibleAgentId === viewer.agent.id;
  const revokedAt = contactRevokedAt(client);
  const leading = leadingRequirement(detail.requirements.map((view) => view.requirement));
  const openTasks = detail.tasks.filter((task) => task.state !== "done").length;
  const timeline = buildClientTimeline(detail, at);
  const newRequirementHref = `${appHref(locale, "requirementsNew")}?clientId=${encodeURIComponent(client.id)}`;
  const newViewingHref = `${appHref(locale, "viewingsNew")}?clientId=${encodeURIComponent(client.id)}`;
  const writeHintId = "client-write-hint";
  const firstPhone = client.phones[0];
  const hasActiveRequirement = detail.requirements.some((view) => view.requirement.status === "active");

  const sections = [
    { id: "requirements", label: t.sections.requirements },
    { id: "matches", label: t.sections.matches },
    { id: "viewings", label: t.sections.viewings },
    { id: "offers", label: t.sections.offers },
    { id: "deals", label: t.sections.deals },
    { id: "household", label: t.sections.household },
    { id: "consents", label: t.sections.consents },
    { id: "memory", label: t.sections.memory },
    { id: "timeline", label: t.sections.timeline },
  ];

  const renderTimelineItem = (event: TimelineEvent, index: number) => (
    <li key={`${event.kind}-${event.at}-${index}`} className="flex gap-3">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-border-strong" />
      <div className="min-w-0">
        <p className="text-small text-fg">{timelineText(locale, event)}</p>
        <p className="text-caption text-fg-muted">
          <time dateTime={event.at}>{formatDateTime(locale, event.at)}</time>
        </p>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader locale={locale} backHref={appHref(locale, "clients")} title={client.name}>
        <div className="flex flex-wrap gap-1.5">
          <ClientStatusBadge locale={locale} status={client.status} />
          <LeadSourceBadge locale={locale} source={client.source} />
        </div>
        <CrmTabs locale={locale} />
      </PageHeader>

      <Card className="space-y-4 p-4">
        {revokedAt ? (
          <Notice kind="danger" title={d.consentPurpose.contact}>
            {format(t.profile.consentRevoked, { date: formatDate(locale, revokedAt) })}
          </Notice>
        ) : null}

        <div className="flex items-start gap-3">
          <Avatar name={client.name} className="size-12" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-small text-fg-muted">{t.profile.summary}</p>
            {leading ? (
              <ul className="flex flex-wrap gap-1.5">
                {requirementChips(locale, leading, 3).map((chip) => (
                  <li key={chip}>
                    <Chip>{chip}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-fg">
                {t.profile.noSummary}.{" "}
                <Link href={newRequirementHref} className="font-medium text-primary underline-offset-2 hover:underline">
                  {t.requirements.add}
                </Link>
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-small sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">{t.profile.phones}</dt>
            <dd className="font-medium text-fg">
              {canSeeContacts ? (
                <ul>
                  {client.phones.map((phone) => (
                    <li key={phone}>
                      <a href={telHref(phone)} className="tabular underline-offset-2 hover:underline">
                        {formatUzPhone(phone)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="tabular">{client.phones.map(maskUzPhone).join(", ")}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.telegram}</dt>
            <dd className="font-medium text-fg">
              {client.telegramUsername && canSeeContacts ? (
                <a
                  href={telegramHref(client.telegramUsername)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  @{client.telegramUsername}
                </a>
              ) : (
                <span className="text-fg-muted">{client.telegramUsername ? "@•••" : t.profile.noTelegram}</span>
              )}
              {!client.telegramUsername && !revokedAt ? (
                <p id={writeHintId} className="text-caption font-normal text-fg-muted">
                  {t.profile.writeDisabled}
                </p>
              ) : null}
              {revokedAt ? (
                <p id={writeHintId} className="text-caption font-normal text-danger-fg">
                  {t.profile.writeBlocked}
                </p>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.responsible}</dt>
            <dd className="font-medium text-fg">
              {detail.responsibleAgent.name}
              {detail.responsibleAgent.id === viewer.agent.id ? ` · ${d.role[viewer.agent.role]}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.language}</dt>
            <dd className="font-medium text-fg">{leads[locale].language[client.language]}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.source}</dt>
            <dd className="font-medium text-fg">
              {d.leadSource[client.source]} ·{" "}
              {format(t.profile.createdAt, { date: formatDate(locale, client.createdAt) })}
            </dd>
          </div>
          {detail.lead ? (
            <div>
              <dt className="text-fg-muted">{t.profile.lead}</dt>
              <dd className="font-medium">
                <Link
                  href={appPath(locale, `/leads/${encodeURIComponent(detail.lead.id)}`)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {t.profile.openLead}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>

        {!canSeeContacts ? (
          <Notice kind="permission" title={t.profile.maskedTitle}>
            {format(t.profile.masked, { name: detail.responsibleAgent.name })}
          </Notice>
        ) : null}

        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-small text-fg-muted">{t.profile.nextAction}</p>
          {client.nextAction ? (
            <NextAction locale={locale} nextAction={client.nextAction} at={at} />
          ) : (
            <p className="text-small text-fg">{t.profile.noNextAction}</p>
          )}
          {openTasks > 0 ? (
            <p className="text-caption text-fg-muted">{format(t.profile.openTasks, { n: openTasks })}</p>
          ) : null}
        </div>
      </Card>

      <div className="mt-4">
        <StickyActionBar label={t.profile.actionsLabel}>
          {firstPhone && canSeeContacts && !revokedAt ? (
            <a href={telHref(firstPhone)} className={cn(stickyActionClasses, primaryAction)}>
              <Phone aria-hidden className="size-5 lg:size-4" />
              {t.profile.call}
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-describedby={writeHintId}
              className={cn(stickyActionClasses, primaryAction, "opacity-50")}
            >
              <Phone aria-hidden className="size-5 lg:size-4" />
              {t.profile.call}
            </button>
          )}
          {client.telegramUsername && canSeeContacts && !revokedAt ? (
            <a
              href={telegramHref(client.telegramUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(stickyActionClasses, secondaryAction)}
            >
              <Send aria-hidden className="size-5 lg:size-4" />
              {t.profile.write}
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-describedby={writeHintId}
              title={revokedAt ? t.profile.writeBlocked : t.profile.writeDisabled}
              className={cn(stickyActionClasses, secondaryAction, "opacity-50")}
            >
              <Send aria-hidden className="size-5 lg:size-4" />
              {t.profile.write}
            </button>
          )}
          <Link
            href={`${appHref(locale, "tasksNew")}?clientId=${encodeURIComponent(client.id)}`}
            className={cn(stickyActionClasses, secondaryAction)}
          >
            <ListPlus aria-hidden className="size-5 lg:size-4" />
            {t.profile.task}
          </Link>
          <ClientMoreMenu locale={locale} clientId={client.id} />
        </StickyActionBar>
      </div>

      <div className="mt-6">
        <ChipRow label={t.profile.sectionsLabel}>
          {sections.map((section) => (
            <li key={section.id}>
              <ChipLink href={`#${section.id}`}>{section.label}</ChipLink>
            </li>
          ))}
        </ChipRow>
      </div>

      <div className="mt-6 space-y-8">
        <CrmSection
          id="requirements"
          title={t.sections.requirements}
          action={
            <ButtonLink href={newRequirementHref} variant="soft">
              <Plus aria-hidden className="size-4" />
              {t.requirements.add}
            </ButtonLink>
          }
        >
          {detail.requirements.length > 0 ? (
            <ul className="space-y-3">
              {detail.requirements.map(({ requirement, matchCounts }) => (
                <li key={requirement.id}>
                  <Card className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={requirement.status === "active" ? "success" : "neutral"} icon={SearchCheck}>
                        {d.requirementStatus[requirement.status]}
                      </Badge>
                      <span className="text-caption text-fg-muted">
                        {format(t.requirements.version, { n: requirement.version })} ·{" "}
                        {requirement.version > 1
                          ? format(t.requirements.updated, { date: formatDate(locale, requirement.updatedAt) })
                          : format(t.requirements.created, { date: formatDate(locale, requirement.createdAt) })}
                      </span>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {requirementChips(locale, requirement, 4).map((chip) => (
                        <li key={chip}>
                          <Chip>{chip}</Chip>
                        </li>
                      ))}
                    </ul>
                    {requirement.naturalLanguageInput ? (
                      <blockquote className="flex gap-2 text-small text-fg-muted">
                        <Quote aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <p>
                          <span className="sr-only">{t.requirements.verbatim}: </span>
                          {requirement.naturalLanguageInput}
                        </p>
                      </blockquote>
                    ) : null}
                    {requirement.hardCriteria.length > 0 ? (
                      <p className="text-caption text-fg-muted">
                        {format(t.requirements.hard, {
                          list: list(
                            locale,
                            requirement.hardCriteria.map((criterion) => domain[locale].requirementCriterion[criterion]),
                          ),
                        })}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-small text-fg">
                        {requirement.status !== "active"
                          ? format(t.requirements.notMatched, {
                              status: d.requirementStatus[requirement.status].toLocaleLowerCase(intlLocale[locale]),
                            })
                          : matchCounts.total > 0
                            ? format(t.requirements.matches, { n: matchCounts.total })
                            : t.requirements.noMatches}
                      </p>
                      <ButtonLink
                        href={appPath(locale, `/requirements/${encodeURIComponent(requirement.id)}`)}
                        variant="secondary"
                      >
                        {t.requirements.open}
                        <ChevronRight aria-hidden className="size-4" />
                      </ButtonLink>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.requirements.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection
          id="matches"
          title={t.sections.matches}
          description={
            detail.matches.total > 0
              ? format(t.matches.summary, { total: detail.matches.total, ...detail.matches.byBand })
              : undefined
          }
        >
          {detail.matches.top.length > 0 ? (
            <ul className="space-y-3">
              {detail.matches.top.map((match) => (
                <li key={match.id}>
                  <Card className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BandBadge locale={locale} band={match.ranked.band} score={match.ranked.score} />
                      <SourceBadge locale={locale} source={match.ranked.candidate.source} />
                      <FreshnessBadge locale={locale} freshness={match.ranked.freshness} />
                    </div>
                    <p className="text-body font-semibold text-fg">
                      <Link href={matchTargetHref(locale, match.target)} className="hover:underline">
                        {matchTargetLabel(locale, match.target)}
                      </Link>
                    </p>
                    {match.ranked.candidate.price ? (
                      <p className="text-small font-semibold text-fg">
                        <MoneyText locale={locale} value={match.ranked.candidate.price} />
                      </p>
                    ) : null}
                    <p className="flex items-start gap-1.5 text-small text-fg-muted">
                      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                      {summarizeMatch(locale, match.ranked.reasons)}
                    </p>
                    <Link
                      href={appPath(locale, `/requirements/${encodeURIComponent(match.requirement.id)}`)}
                      className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary hover:underline"
                    >
                      {t.matches.openShortlist}
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {hasActiveRequirement ? t.matches.empty : t.matches.emptyNoRequirement}
            </p>
          )}
        </CrmSection>

        <CrmSection
          id="viewings"
          title={t.sections.viewings}
          action={
            <ButtonLink href={newViewingHref} variant="soft">
              <CalendarPlus aria-hidden className="size-4" />
              {t.viewings.add}
            </ButtonLink>
          }
        >
          {detail.viewings.length > 0 ? (
            <ul className="space-y-3">
              {detail.viewings.map(({ viewing, listing, partner, conflictsWith }) => (
                <li key={viewing.id}>
                  <Card className="space-y-1.5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-small font-semibold text-fg">
                        <time dateTime={viewing.startsAt}>{formatDateTime(locale, viewing.startsAt)}</time>
                      </p>
                      <Badge
                        tone={
                          viewing.status === "completed"
                            ? "success"
                            : viewing.status === "cancelled" || viewing.status === "no_show"
                              ? "neutral"
                              : "info"
                        }
                        icon={CalendarCheck}
                      >
                        {d.viewingStatus[viewing.status]}
                      </Badge>
                    </div>
                    <p className="text-small text-fg">
                      <Link
                        href={appPath(locale, `/viewings/${encodeURIComponent(viewing.id)}`)}
                        className="hover:underline"
                      >
                        {propertyLabel(locale, listing.property)}
                      </Link>
                    </p>
                    {partner ? (
                      <p className="text-caption text-fg-muted">{format(t.viewings.partner, { name: partner.name })}</p>
                    ) : null}
                    {conflictsWith.length > 0 && viewing.status !== "completed" ? (
                      <p className="flex items-center gap-1.5 text-caption font-medium text-warning-fg">
                        <TriangleAlert aria-hidden className="size-3.5" />
                        {t.viewings.conflict}
                      </p>
                    ) : null}
                    {viewing.feedback ? (
                      <p className="text-caption text-fg-muted">
                        {format(t.viewings.feedback, { text: viewing.feedback.text })}
                      </p>
                    ) : null}
                    {viewing.nextAction ? (
                      <p className="text-caption text-fg-muted">
                        {format(t.viewings.nextAction, { text: viewing.nextAction })}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.viewings.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection id="offers" title={t.sections.offers}>
          {detail.offers.length > 0 ? (
            <ul className="space-y-3">
              {detail.offers.map(({ offer, listing, latest }) => (
                <li key={offer.id}>
                  <Card className="flex flex-wrap items-start justify-between gap-2 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-body font-semibold text-fg">
                        <MoneyText locale={locale} value={latest.amount} />{" "}
                        <span className="text-small font-normal text-fg-muted">{t.offers.by[latest.by]}</span>
                      </p>
                      <p className="text-small text-fg">
                        <Link href={listingHref(locale, listing.listing.id)} className="hover:underline">
                          {propertyLabel(locale, listing.property)}
                        </Link>
                      </p>
                      <p className="text-caption text-fg-muted">
                        {format(t.offers.version, { n: latest.version })} · {formatDateTime(locale, latest.at)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        offer.status === "accepted"
                          ? "success"
                          : offer.status === "open" || offer.status === "countered"
                            ? "info"
                            : "neutral"
                      }
                      icon={Handshake}
                    >
                      {d.offerStatus[offer.status]}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.offers.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection id="deals" title={t.sections.deals}>
          {detail.deals.length > 0 ? (
            <ul className="space-y-3">
              {detail.deals.map((view) => (
                <li key={view.deal.id}>
                  <Card className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-body font-semibold text-fg">{propertyLabel(locale, view.listing.property)}</p>
                      <Badge tone="brand">{format(t.deals.stage, { stage: d.dealStage[view.deal.stage] })}</Badge>
                    </div>
                    {view.deal.nextAction ? (
                      <p className="flex flex-wrap items-center gap-2 text-small text-fg">
                        {view.nextActionOverdue ? (
                          <Badge tone="danger" icon={TriangleAlert}>
                            {t.deals.overdue}
                          </Badge>
                        ) : null}
                        {format(t.deals.nextAction, { text: view.deal.nextAction.text })}
                      </p>
                    ) : null}
                    {view.missingRequiredDocuments > 0 ? (
                      <p className="flex items-center gap-1.5 text-caption font-medium text-warning-fg">
                        <FileWarning aria-hidden className="size-3.5" />
                        {format(t.deals.missingDocs, { n: view.missingRequiredDocuments })}
                      </p>
                    ) : null}
                    <Link
                      href={appPath(locale, `/deals/${encodeURIComponent(view.deal.id)}`)}
                      className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary hover:underline"
                    >
                      {t.deals.open}
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.deals.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection id="household" title={t.sections.household} description={t.household.text}>
          {client.household.length > 0 ? (
            <ul className="space-y-2">
              {client.household.map((party) => (
                <li key={party.id}>
                  <Card className="flex items-center gap-3 p-3">
                    <span
                      aria-hidden
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
                    >
                      <UserRound className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-small font-semibold text-fg">{party.name}</p>
                      <p className="text-caption text-fg-muted">{d.relatedPartyRole[party.role]}</p>
                    </div>
                    <p className="text-small text-fg">
                      {party.phone ? (
                        canSeeContacts ? (
                          <a href={telHref(party.phone)} className="tabular underline-offset-2 hover:underline">
                            {formatUzPhone(party.phone)}
                          </a>
                        ) : (
                          <span className="tabular">{maskUzPhone(party.phone)}</span>
                        )
                      ) : (
                        <span className="text-caption text-fg-muted">{t.household.noPhone}</span>
                      )}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.household.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection id="consents" title={t.sections.consents} description={t.consents.text}>
          {client.consents.length > 0 ? (
            <ul className="space-y-2">
              {client.consents.map((consent) => (
                <li key={consent.id}>
                  <Card className="flex flex-wrap items-start justify-between gap-2 p-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-small font-semibold text-fg">{d.consentPurpose[consent.purpose]}</p>
                      <p className="text-caption text-fg-muted">
                        {domain[locale].consentChannel[consent.channel]} ·{" "}
                        {format(t.consents.granted, { date: formatDate(locale, consent.grantedAt) })}
                      </p>
                      <p className="text-caption text-fg-subtle">
                        {format(t.consents.version, { version: consent.textVersion })}
                      </p>
                    </div>
                    <ConsentStateBadge locale={locale} consent={consent} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
              {t.consents.empty}
            </p>
          )}
        </CrmSection>

        <CrmSection id="memory" title={t.sections.memory} description={t.memory.text}>
          <ClientMemory locale={locale} items={client.memory} />
        </CrmSection>

        <CrmSection id="timeline" title={t.sections.timeline}>
          {timeline.length > 0 ? (
            <div className="space-y-3">
              <ol className="space-y-3">{timeline.slice(0, TIMELINE_PREVIEW).map(renderTimelineItem)}</ol>
              {timeline.length > TIMELINE_PREVIEW ? (
                <details className="group">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-small font-medium text-primary">
                    <History aria-hidden className="size-4" />
                    {format(t.timeline.showAll, { n: timeline.length })}
                  </summary>
                  <ol className="mt-3 space-y-3">
                    {timeline
                      .slice(TIMELINE_PREVIEW)
                      .map((event, index) => renderTimelineItem(event, index + TIMELINE_PREVIEW))}
                  </ol>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="text-small text-fg-muted">{t.timeline.empty}</p>
          )}
        </CrmSection>
      </div>

      <StickyBarSpacer />
    </>
  );
}
