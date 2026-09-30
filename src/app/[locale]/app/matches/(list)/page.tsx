import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ListPlus, Sparkles, UserRound } from "lucide-react";
import {
  bandCounts,
  groupByRequirement,
  matchFeedHref,
  parseMatchFeedParams,
  requirementDetailHref,
  statusCounts,
  visibleBands,
  type MatchFeedParams,
  type RequirementGroup,
} from "@/components/app/matches/feed";
import { MatchCard } from "@/components/app/matches/match-card";
import { requirementCriteria } from "@/components/app/matches/requirement-criteria";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import matchesScreen from "@/i18n/messages/matches-screen";
import { getLocale } from "@/i18n/server";
import { listMatchFeed } from "@/lib/data/repository";
import type { MatchView } from "@/lib/data/views";
import { appPath } from "@/lib/routes";

/** Cards per requirement in the feed; the rest is one tap away in the shortlist. */
const PER_GROUP = 3;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: matchesScreen[locale].meta.feed };
}

function applyFilter(matches: MatchView[], params: MatchFeedParams): MatchView[] {
  return matches.filter(
    (match) => (!params.band || match.ranked.band === params.band) && (!params.status || match.status === params.status),
  );
}

function FilterChips({ locale, all, params }: { locale: Locale; all: MatchView[]; params: MatchFeedParams }) {
  const t = matchesScreen[locale].feed;
  const d = domain[locale];
  const bands = bandCounts(applyFilter(all, { status: params.status }));
  const statusPool = applyFilter(all, { band: params.band });
  const statuses = statusCounts(statusPool);
  if (params.status && !statuses.some((item) => item.status === params.status)) {
    statuses.push({ status: params.status, count: 0 });
  }
  return (
    <div className="space-y-2">
      <nav aria-label={t.band.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={matchFeedHref(locale, { status: params.status })} active={!params.band}>
              {t.band.all}
            </ChipLink>
          </li>
          {visibleBands.map((band) => (
            <li key={band}>
              <ChipLink href={matchFeedHref(locale, { ...params, band })} active={params.band === band}>
                {d.band[band]} <span className="tabular opacity-80">{bands[band]}</span>
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t.status.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={matchFeedHref(locale, { band: params.band })} active={!params.status}>
              {t.status.all} <span className="tabular opacity-80">{statusPool.length}</span>
            </ChipLink>
          </li>
          {statuses.map(({ status, count }) => (
            <li key={status}>
              <ChipLink href={matchFeedHref(locale, { ...params, status })} active={params.status === status}>
                {d.matchStatus[status]} <span className="tabular opacity-80">{count}</span>
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Group({ locale, group }: { locale: Locale; group: RequirementGroup }) {
  const t = matchesScreen[locale].feed.group;
  const { requirement, client, matches } = group;
  const titleId = `group-${requirement.id}`;
  const shown = matches.slice(0, PER_GROUP);
  const rest = matches.length - shown.length;
  const summary = requirementCriteria(locale, requirement)
    .items.map((item) => item.value)
    .join(" · ");

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 id={titleId} className="text-h2 text-fg">
            <Link
              href={appPath(locale, `/clients/${encodeURIComponent(client.id)}`)}
              className="inline-flex min-h-11 items-center gap-2 underline-offset-2 hover:underline"
              aria-label={format(t.label, { name: client.name })}
            >
              <UserRound aria-hidden className="size-5 text-fg-muted" />
              {client.name}
            </Link>
          </h2>
          <p className="text-small text-fg-muted">{summary}</p>
        </div>
        <Link
          href={requirementDetailHref(locale, requirement.id)}
          className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
        >
          {t.shortlist} <span className="tabular">({matches.length})</span>
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </header>
      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((match) => (
          <li key={match.id}>
            <MatchCard locale={locale} match={match} />
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <Link
          href={requirementDetailHref(locale, requirement.id)}
          className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-small font-medium text-fg hover:bg-surface-muted"
        >
          {format(plural(locale, rest, t.more), { n: rest })}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

/**
 * Match feed (§7.1, §12, §22.7): every match for the viewer's active client
 * requests, grouped by request, explained by reasons. Band and status
 * filters are URL state; the full list per request is its shortlist.
 */
export default async function MatchesPage({ searchParams }: PageProps<"/[locale]/app/matches">) {
  const locale = await getLocale();
  const t = matchesScreen[locale].feed;
  const params = parseMatchFeedParams(await searchParams);
  const all = await listMatchFeed();
  const filtered = applyFilter(all, params);
  const groups = groupByRequirement(filtered);
  const filteredActive = Boolean(params.band || params.status);

  return (
    <div className="space-y-5">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={
          all.length > 0
            ? format(t.countLine, {
                matches: format(plural(locale, filtered.length, t.summary), { n: filtered.length }),
                requirements: format(plural(locale, groups.length, t.requirements), { n: groups.length }),
              })
            : t.subtitle
        }
        className="mb-0"
      />

      {all.length > 0 ? <FilterChips locale={locale} all={all} params={params} /> : null}
      {all.length > 0 ? <Notice kind="info">{t.note}</Notice> : null}

      {groups.length > 0 ? (
        groups.map((group) => <Group key={group.requirement.id} locale={locale} group={group} />)
      ) : filteredActive ? (
        <EmptyState
          icon={Sparkles}
          title={t.empty.filteredTitle}
          description={t.empty.filteredText}
          action={<ChipLink href={matchFeedHref(locale, {})}>{t.empty.reset}</ChipLink>}
        />
      ) : (
        <EmptyState
          icon={Sparkles}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={appPath(locale, "/requirements/new")}>
              <ListPlus aria-hidden className="size-4" />
              {t.empty.action}
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
