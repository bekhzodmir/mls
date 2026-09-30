import Link from "next/link";
import { ArrowRight, Briefcase, Building, Inbox, Lock, Send, User } from "lucide-react";
import type { ReactNode } from "react";
import { FeedList, type FeedRowData } from "@/components/app/today/feed-row";
import { listingTitle, MIN_SHOWN_CONFIDENCE, telegramTitle } from "@/components/app/today/labels";
import { entityHref, listHref } from "@/components/app/today/links";
import { langOf } from "@/components/app/today/rows";
import { FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import search from "@/i18n/messages/search";
import type {
  ClientListItem,
  DealView,
  LeadView,
  ListingView,
  SearchResults,
  TelegramListingView,
} from "@/lib/data/views";

/** The repository returns at most this many results per group. */
export const SEARCH_GROUP_LIMIT = 8;

export type SearchGroupKey = "clients" | "leads" | "listings" | "telegram" | "deals";
export const searchGroupOrder: readonly SearchGroupKey[] = ["clients", "leads", "listings", "telegram", "deals"];

export function searchTotal(results: SearchResults): number {
  return searchGroupOrder.reduce((sum, key) => sum + results[key].length, 0);
}

function clientRow(locale: Locale, item: ClientListItem): FeedRowData {
  const t = search[locale].item;
  const { client } = item;
  const active = item.requirements.filter((requirement) => requirement.status === "active").length;
  return {
    id: client.id,
    href: entityHref(locale, { kind: "client", id: client.id }),
    icon: User,
    title: client.name,
    lines: [active > 0 ? format(t.requirements, { n: active }) : t.noRequirements],
    badges: <Badge>{domain[locale].clientStatus[client.status]}</Badge>,
  };
}

function leadRow(locale: Locale, view: LeadView, at: Date): FeedRowData {
  const t = search[locale].item;
  const d = domain[locale];
  const { lead } = view;
  return {
    id: lead.id,
    href: entityHref(locale, { kind: "lead", id: lead.id }),
    icon: Inbox,
    title: lead.name ?? t.noName,
    lines: [
      <>
        {d.leadSource[lead.source]} · {format(t.received, { ago: formatRelative(locale, lead.receivedAt, at) })}
      </>,
      <span key="message" lang={langOf(lead.language)}>
        {lead.message}
      </span>,
    ],
    badges: <Badge>{d.leadStatus[lead.status]}</Badge>,
  };
}

function listingRow(locale: Locale, view: ListingView): FeedRowData {
  const t = search[locale];
  const d = domain[locale];
  const { listing } = view;
  const own = view.access === "owner";
  return {
    id: listing.id,
    href: entityHref(locale, { kind: "listing", id: listing.id }),
    icon: Building,
    title: listingTitle(locale, view.property),
    lines: [
      <>
        {d.dealType[listing.dealType]} · <MoneyText locale={locale} value={listing.price} className="font-semibold text-fg" />
      </>,
      own ? null : format(t.item.agent, { name: [view.agent.name, view.organization?.name].filter(Boolean).join(", ") }),
      // Property ≠ Listing: the same flat may be offered by other agents.
      view.otherListingsOnProperty > 0 ? format(t.item.otherListings, { n: view.otherListingsOnProperty }) : null,
    ],
    badges: (
      <>
        <FreshnessBadge locale={locale} freshness={view.freshness} />
        <SourceBadge locale={locale} source={listing.source} />
        {view.access === "partner_masked" ? (
          <Badge icon={Lock} title={t.masked.text}>
            {t.masked.badge}
          </Badge>
        ) : null}
      </>
    ),
  };
}

function telegramRow(locale: Locale, view: TelegramListingView): FeedRowData {
  const t = search[locale].item;
  const { post } = view;
  const price = post.parsed.price.confidence >= MIN_SHOWN_CONFIDENCE ? post.parsed.price.value : undefined;
  return {
    id: post.id,
    href: entityHref(locale, { kind: "telegram", id: post.id }),
    icon: Send,
    title: telegramTitle(locale, post),
    lines: [
      price ? <MoneyText locale={locale} value={price} className="font-semibold text-fg" /> : t.priceUnknown,
      format(t.channel, { title: view.source.title }),
      post.rawText,
    ],
    badges: (
      <>
        <FreshnessBadge locale={locale} freshness={view.freshness} />
        <SourceBadge locale={locale} source="telegram" />
        <Badge>{domain[locale].telegramStatus[post.status]}</Badge>
      </>
    ),
  };
}

function dealRow(locale: Locale, view: DealView): FeedRowData {
  const t = search[locale].item;
  const { deal } = view;
  return {
    id: deal.id,
    href: entityHref(locale, { kind: "deal", id: deal.id }),
    icon: Briefcase,
    title: view.client.name,
    lines: [
      listingTitle(locale, view.listing.property),
      deal.agreedPrice ? (
        <>
          {t.agreedPrice}: <MoneyText locale={locale} value={deal.agreedPrice} />
        </>
      ) : null,
    ],
    badges: <Badge>{domain[locale].dealStage[deal.stage]}</Badge>,
  };
}

/** Where "open in section" leads for each group; the query travels along where the list supports it. */
function sectionHref(locale: Locale, key: SearchGroupKey, q: string): string {
  switch (key) {
    case "clients":
      return listHref(locale, "/clients", { q });
    case "leads":
      return listHref(locale, "/leads");
    case "listings":
      return listHref(locale, "/properties", { q });
    case "telegram":
      return listHref(locale, "/radar", { q });
    case "deals":
      return listHref(locale, "/deals");
  }
}

function Group({
  locale,
  groupKey,
  rows,
  query,
  note,
}: {
  locale: Locale;
  groupKey: SearchGroupKey;
  rows: FeedRowData[];
  query: string;
  note?: ReactNode;
}) {
  const t = search[locale].results;
  const id = `search-group-${groupKey}`;
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <h2 id={id} className="text-h2 text-fg">
            {t.groups[groupKey]} <span className="tabular text-fg-muted">{rows.length}</span>
          </h2>
          {rows.length >= SEARCH_GROUP_LIMIT ? (
            <span className="text-caption text-fg-muted">{format(t.limited, { n: SEARCH_GROUP_LIMIT })}</span>
          ) : null}
        </header>
        {note ? <div className="px-4 pb-2">{note}</div> : null}
        <FeedList rows={rows} />
        {rows.length >= SEARCH_GROUP_LIMIT ? (
          <Link
            href={sectionHref(locale, groupKey, query)}
            className="flex min-h-11 items-center justify-between gap-2 border-t border-border px-4 text-small font-semibold text-primary -outline-offset-2 hover:bg-surface-muted/60"
          >
            {t.openSection}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </Card>
    </section>
  );
}

/** Grouped results with counts; empty groups are left out, the page handles "nothing found". */
export function SearchResultGroups({ locale, results, at }: { locale: Locale; results: SearchResults; at: Date }) {
  const t = search[locale];
  const rows: Record<SearchGroupKey, FeedRowData[]> = {
    clients: results.clients.map((item) => clientRow(locale, item)),
    leads: results.leads.map((view) => leadRow(locale, view, at)),
    listings: results.listings.map((view) => listingRow(locale, view)),
    telegram: results.telegram.map((view) => telegramRow(locale, view)),
    deals: results.deals.map((view) => dealRow(locale, view)),
  };
  const present = searchGroupOrder.filter((key) => rows[key].length > 0);
  const masked = results.listings.some((view) => view.access === "partner_masked");

  return (
    <div className="space-y-4">
      <nav aria-label={t.results.nav} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {present.map((key) => (
            <li key={key} className="shrink-0">
              <a
                href={`#search-group-${key}`}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-small font-medium text-fg hover:bg-surface-muted"
              >
                {t.results.groups[key]}
                <span className="tabular text-fg-muted">{rows[key].length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {present.map((key) => (
        <Group
          key={key}
          locale={locale}
          groupKey={key}
          rows={rows[key]}
          query={results.query}
          note={
            key === "listings" && masked ? (
              <Notice kind="permission" title={t.masked.title}>
                {t.masked.text}
              </Notice>
            ) : key === "telegram" ? (
              <p className="text-caption text-fg-muted">{t.telegramNote}</p>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
