import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building, CirclePause, CircleSlash, ClipboardList, Pencil, Quote, Send, Sparkles, UserRound } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { propertyListHref } from "@/components/app/inventory/filters";
import {
  bandCounts,
  matchSorts,
  parseShortlistParams,
  partitionShortlist,
  requirementDetailHref,
  shortlistSources,
  type ShortlistParams,
  type ShortlistSource,
} from "@/components/app/matches/feed";
import { MatchCard } from "@/components/app/matches/match-card";
import { propertySearchFor } from "@/components/app/matches/requirement-criteria";
import { OriginalPhrase, RequirementCriteriaList } from "@/components/app/matches/requirement-view";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import requirementDetail from "@/i18n/messages/requirement-detail";
import { getLocale } from "@/i18n/server";
import { loadRequirement } from "@/lib/data/cached";
import { getMatchesForRequirement } from "@/lib/data/repository";
import type { MatchView } from "@/lib/data/views";
import type { RequirementStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  // The client's name stays out of the browser title (least exposure, §18.1).
  return { title: requirementDetail[locale].meta.title };
}

const statusIcon: Record<RequirementStatus, typeof Sparkles> = {
  active: Sparkles,
  paused: CirclePause,
  closed: CircleSlash,
};

function sourceOf(match: MatchView): ShortlistSource {
  return match.target.kind === "telegram" ? "telegram" : "internal";
}

function SourceTabs({
  locale,
  id,
  params,
  counts,
}: {
  locale: Locale;
  id: string;
  params: ShortlistParams;
  counts: Record<ShortlistSource, number>;
}) {
  const t = requirementDetail[locale].shortlist;
  return (
    <nav aria-label={t.tabs} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 border-b border-border">
        {shortlistSources.map((source) => {
          const active = params.source === source;
          const Icon = source === "telegram" ? Send : Building;
          return (
            <li key={source}>
              <Link
                href={requirementDetailHref(locale, id, { ...params, source })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-small font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t[source]}
                <span className="tabular text-fg-muted">{counts[source]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SortChips({ locale, id, params }: { locale: Locale; id: string; params: ShortlistParams }) {
  const t = requirementDetail[locale].shortlist.sort;
  return (
    <nav aria-label={t.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2">
        {matchSorts.map((sort) => (
          <li key={sort}>
            <ChipLink href={requirementDetailHref(locale, id, { ...params, sort })} active={params.sort === sort}>
              {t[sort]}
            </ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Requirement detail and shortlist (§14.4, §22.4, §35.4 steps 3–6): what the
 * client asked for (hard vs soft), the original phrase verbatim, then the
 * matches — internal listings and Telegram posts as separate tabs, sortable
 * by relevance, freshness or price. Rejected and duplicate matches are kept
 * apart, never mixed in with active ones.
 */
export default async function RequirementPage({ params, searchParams }: PageProps<"/[locale]/app/requirements/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadRequirement(id);
  if (!view) notFound();

  const t = requirementDetail[locale];
  const d = domain[locale];
  const { requirement, client } = view;
  const shortlist = parseShortlistParams(await searchParams);
  const matches = requirement.status === "active" ? await getMatchesForRequirement(id, { sort: shortlist.sort }) : [];
  const counts: Record<ShortlistSource, number> = {
    internal: matches.filter((match) => sourceOf(match) === "internal").length,
    telegram: matches.filter((match) => sourceOf(match) === "telegram").length,
  };
  const current = matches.filter((match) => sourceOf(match) === shortlist.source);
  const { active, setAside } = partitionShortlist(current);
  const bands = bandCounts(active);
  const other: ShortlistSource = shortlist.source === "internal" ? "telegram" : "internal";
  const StatusIcon = statusIcon[requirement.status];
  const editHref = `${appPath(locale, "/requirements/new")}?${new URLSearchParams({ clientId: client.id, requirementId: requirement.id })}`;

  return (
    <div className="space-y-5">
      <PageHeader
        locale={locale}
        title={format(t.title, { name: client.name })}
        subtitle={format(t.version, { n: requirement.version, date: formatDate(locale, requirement.updatedAt) })}
        backHref={appPath(locale, `/clients/${encodeURIComponent(client.id)}`)}
        className="mb-0"
        actions={
          <>
            <ButtonLink href={editHref} variant="secondary">
              <Pencil aria-hidden className="size-4" />
              {t.actions.edit}
            </ButtonLink>
            <ButtonLink href={propertyListHref(locale, propertySearchFor(requirement))} variant="soft">
              <Building aria-hidden className="size-4" />
              {t.actions.properties}
            </ButtonLink>
          </>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {requirement.status !== "active" ? (
        <Notice
          kind="info"
          title={requirement.status === "paused" ? t.state.pausedTitle : t.state.closedTitle}
          action={
            <ButtonLink href={editHref} variant="secondary">
              {t.actions.edit}
            </ButtonLink>
          }
        >
          {requirement.status === "paused" ? t.state.pausedText : t.state.closedText}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="requirement-criteria">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="requirement-criteria" className="flex items-center gap-2 text-h2 text-fg">
                <ClipboardList aria-hidden className="size-5 text-fg-muted" />
                {t.criteria.title}
              </h2>
              <Badge tone={requirement.status === "active" ? "success" : "neutral"} icon={StatusIcon}>
                {d.requirementStatus[requirement.status]}
              </Badge>
            </div>
            <RequirementCriteriaList locale={locale} requirement={requirement} />
          </Card>
        </section>
        <section aria-labelledby="requirement-original">
          <Card className="space-y-3 p-4">
            <h2 id="requirement-original" className="flex items-center gap-2 text-h2 text-fg">
              <Quote aria-hidden className="size-5 text-fg-muted" />
              {t.original.title}
            </h2>
            <OriginalPhrase locale={locale} requirement={requirement} />
            <Link
              href={appPath(locale, `/clients/${encodeURIComponent(client.id)}`)}
              className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-primary underline-offset-2 hover:underline"
            >
              <UserRound aria-hidden className="size-4" />
              {t.actions.client}: {client.name}
            </Link>
          </Card>
        </section>
      </div>

      {requirement.status === "active" ? (
        <section aria-labelledby="shortlist-title" className="space-y-3">
          <h2 id="shortlist-title" className="text-h2 text-fg">
            {t.shortlist.title}
          </h2>
          <SourceTabs locale={locale} id={id} params={shortlist} counts={counts} />
          <p className="text-caption text-fg-muted">
            {shortlist.source === "internal" ? t.shortlist.internalHint : t.shortlist.telegramHint}
          </p>
          <SortChips locale={locale} id={id} params={shortlist} />
          <p className="text-caption text-fg-muted">{t.shortlist.distanceNote}</p>

          {active.length > 0 ? (
            <>
              <p role="status" className="text-small font-semibold text-fg">
                {format(t.shortlist.bands, bands)}
              </p>
              <ul className="grid gap-3 lg:grid-cols-2">
                {active.map((match) => (
                  <li key={match.id}>
                    <MatchCard locale={locale} match={match} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={shortlist.source === "telegram" ? Send : Building}
              title={shortlist.source === "internal" ? t.shortlist.empty.internalTitle : t.shortlist.empty.telegramTitle}
              description={t.shortlist.empty.text}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {counts[other] > 0 ? (
                    <ChipLink href={requirementDetailHref(locale, id, { ...shortlist, source: other })}>
                      {format(t.shortlist.empty.other, { source: t.shortlist[other] })}
                    </ChipLink>
                  ) : null}
                  <ButtonLink href={editHref} variant="secondary">
                    {t.actions.edit}
                  </ButtonLink>
                </div>
              }
            />
          )}

          {setAside.length > 0 ? (
            <details className="rounded-lg border border-border bg-surface">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-small font-medium text-fg">
                {format(t.shortlist.setAside, { n: setAside.length })}
              </summary>
              <div className="space-y-3 border-t border-border p-4">
                <p className="text-caption text-fg-muted">{t.shortlist.setAsideHint}</p>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {setAside.map((match) => (
                    <li key={match.id}>
                      <MatchCard locale={locale} match={match} headingLevel={4} />
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
