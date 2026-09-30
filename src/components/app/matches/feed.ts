import type { MatchView } from "@/lib/data/views";
import { needsAttention } from "@/lib/domain/freshness";
import type { MatchSort } from "@/lib/domain/matching";
import type { Client, ConfidenceBand, Freshness, ID, MatchStatus, Money, Requirement } from "@/lib/domain/types";
import { confidentValue, telegramFacts, type PhysicalFacts } from "@/components/app/inventory/labels";
import { appPath } from "@/lib/routes";

/**
 * Match feed and shortlist state (§12, §22.7, §35.4) as plain data: URL
 * filters, grouping by requirement, and what a card links to. Rendering lives
 * in `match-card.tsx`; this module is pure and unit-tested.
 */

export const visibleBands = ["excellent", "good", "possible"] as const satisfies readonly ConfidenceBand[];
export type VisibleBand = (typeof visibleBands)[number];

/** Every match status in lifecycle order (§11.4), then the alternatives. */
export const matchStatuses = [
  "new",
  "notified",
  "viewed",
  "contacted",
  "negotiation",
  "accepted",
  "deal_in_progress",
  "won",
  "rejected",
  "expired",
  "duplicate",
  "cancelled",
] as const satisfies readonly MatchStatus[];

export const matchSorts = ["relevance", "freshness", "price"] as const satisfies readonly MatchSort[];

/** Shortlist tabs (§35.4 step 4): internal listings and Telegram posts are separate sources. */
export const shortlistSources = ["internal", "telegram"] as const;
export type ShortlistSource = (typeof shortlistSources)[number];

type Raw = string | string[] | undefined;

function oneOf<T extends string>(values: readonly T[], raw: Raw): T | undefined {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value !== undefined && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

export interface MatchFeedParams {
  band?: VisibleBand;
  status?: MatchStatus;
}

export function parseMatchFeedParams(raw: Record<string, Raw>): MatchFeedParams {
  const params: MatchFeedParams = {};
  const band = oneOf(visibleBands, raw.band);
  const status = oneOf(matchStatuses, raw.status);
  if (band) params.band = band;
  if (status) params.status = status;
  return params;
}

export interface ShortlistParams {
  sort: MatchSort;
  source: ShortlistSource;
}

export function parseShortlistParams(raw: Record<string, Raw>): ShortlistParams {
  return { sort: oneOf(matchSorts, raw.sort) ?? "relevance", source: oneOf(shortlistSources, raw.source) ?? "internal" };
}

/** Statuses that take a match out of the active shortlist (kept, never deleted). */
const SET_ASIDE = new Set<MatchStatus>(["rejected", "duplicate", "expired", "cancelled"]);

export function isSetAside(status: MatchStatus): boolean {
  return SET_ASIDE.has(status);
}

/** A stale or expired offer is never styled as an active match (§36.3). */
export function isStale(freshness: Freshness): boolean {
  return needsAttention(freshness);
}

export interface RequirementGroup {
  requirement: Requirement;
  client: Client;
  matches: MatchView[];
}

/**
 * Groups a feed by requirement, keeping the feed order inside each group and
 * ordering groups by their best (first) match — so the strongest work is on
 * top, and ties keep the repository's deterministic order.
 */
export function groupByRequirement(matches: readonly MatchView[]): RequirementGroup[] {
  const groups = new Map<ID, RequirementGroup>();
  for (const match of matches) {
    const group = groups.get(match.requirement.id);
    if (group) group.matches.push(match);
    else groups.set(match.requirement.id, { requirement: match.requirement, client: match.client, matches: [match] });
  }
  return [...groups.values()];
}

/** Counts per status for the filter chips, in lifecycle order; zero counts are left out. */
export function statusCounts(matches: readonly MatchView[]): { status: MatchStatus; count: number }[] {
  return matchStatuses
    .map((status) => ({ status, count: matches.filter((match) => match.status === status).length }))
    .filter((item) => item.count > 0);
}

export function bandCounts(matches: readonly MatchView[]): Record<VisibleBand, number> {
  const counts: Record<VisibleBand, number> = { excellent: 0, good: 0, possible: 0 };
  for (const match of matches) {
    const band = match.ranked.band;
    if (band !== "hidden") counts[band] += 1;
  }
  return counts;
}

/** Splits a shortlist into what is still in play and what was set aside. */
export function partitionShortlist(matches: readonly MatchView[]): { active: MatchView[]; setAside: MatchView[] } {
  return {
    active: matches.filter((match) => !isSetAside(match.status)),
    setAside: matches.filter((match) => isSetAside(match.status)),
  };
}

/* ------------------------------------------------------------- targets */

/** Physical facts of the matched offer: listing attributes, or confident post fields. */
export function targetFacts(match: MatchView): PhysicalFacts {
  if (match.target.kind === "telegram") return telegramFacts(match.target.view.post);
  const { property } = match.target.view;
  const facts: PhysicalFacts = { propertyType: property.propertyType, district: property.district };
  if (property.areaName) facts.areaName = property.areaName;
  if (property.landmark) facts.landmark = property.landmark;
  if (property.rooms !== undefined) facts.rooms = property.rooms;
  if (property.areaTotal !== undefined) facts.areaTotal = property.areaTotal;
  if (property.floor !== undefined) facts.floor = property.floor;
  if (property.floorsTotal !== undefined) facts.floorsTotal = property.floorsTotal;
  return facts;
}

/** The asking price, or undefined when a post's price was not read confidently. */
export function targetPrice(match: MatchView): Money | undefined {
  return match.target.kind === "listing"
    ? match.target.view.listing.price
    : confidentValue(match.target.view.post.parsed.price);
}

/** True for another professional's listing: contact goes through a cooperation request. */
export function isPartnerListing(match: MatchView): boolean {
  return (
    match.target.kind === "listing" &&
    (match.target.view.access === "partner_masked" || match.target.view.access === "partner_shared")
  );
}

/** Workspace page of the matched offer: property profile or Telegram post. */
export function targetHref(locale: string, match: MatchView): string {
  return match.target.kind === "listing"
    ? appPath(locale, `/properties/${encodeURIComponent(match.target.view.listing.id)}`)
    : appPath(locale, `/radar/${encodeURIComponent(match.target.view.post.id)}`);
}

export function matchDetailHref(locale: string, matchId: string): string {
  return appPath(locale, `/matches/${encodeURIComponent(matchId)}`);
}

export function requirementDetailHref(locale: string, requirementId: ID, params: Partial<ShortlistParams> = {}): string {
  const query = new URLSearchParams();
  if (params.source && params.source !== "internal") query.set("source", params.source);
  if (params.sort && params.sort !== "relevance") query.set("sort", params.sort);
  const search = query.toString();
  return `${appPath(locale, `/requirements/${encodeURIComponent(requirementId)}`)}${search ? `?${search}` : ""}`;
}

/** New cooperation request for a partner listing and this buyer request (§15.3). */
export function cooperationRequestHref(locale: string, listingId: ID, requirementId?: ID): string {
  const query = new URLSearchParams({ listingId });
  if (requirementId) query.set("requirementId", requirementId);
  return `${appPath(locale, "/mls/cooperation/new")}?${query.toString()}`;
}

export function matchFeedHref(locale: string, params: MatchFeedParams): string {
  const query = new URLSearchParams();
  if (params.band) query.set("band", params.band);
  if (params.status) query.set("status", params.status);
  const search = query.toString();
  return `${appPath(locale, "/matches")}${search ? `?${search}` : ""}`;
}
