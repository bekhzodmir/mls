import { format } from "@/i18n/define-messages";
import { formatList, formatNumber } from "@/i18n/format";
import { intlLocale, type Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import radar from "@/i18n/messages/radar";
import type { ListingView, TelegramListingView } from "@/lib/data/views";
import {
  compareForDuplicates,
  dedupRecordFromListing,
  dedupRecordFromTelegram,
  findDuplicateCandidates,
  type DedupRecord,
} from "@/lib/domain/dedup";
import { districtName } from "@/lib/domain/geo";
import { formatMoney } from "@/lib/domain/money";
import type { ParsedListingFields, TelegramListing } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { agentLine, floorRelevant, listingTitle, roomsRelevant, typeWithRooms } from "../mls/listing-labels";
import type { DuplicateEntry, DuplicateListLabels } from "./duplicate-list";
import type { ParsedFieldListLabels } from "./parsed-field-list";
import { postFacts, type PostFacts, type ValueLabels } from "./parse-view";
import { radarPostHref } from "./radar-params";

/**
 * Server-side label builders for the Radar screens. Client components get the
 * resulting plain objects as props, so only one locale's strings travel to
 * the browser.
 */

export type RadarMessages = (typeof radar)["ru"];

export function valueLabels(locale: Locale): ValueLabels {
  return {
    value: radar[locale].value,
    dealType: domain[locale].dealType,
    propertyType: domain[locale].propertyType,
  };
}

export function fieldListLabels(locale: Locale): ParsedFieldListLabels {
  const t = radar[locale];
  return {
    field: t.field,
    parsed: t.parsed,
    confidence: { level: t.confidence.level, percent: t.confidence.percent },
    values: valueLabels(locale),
  };
}

export function duplicateListLabels(locale: Locale): DuplicateListLabels {
  const t = radar[locale].duplicates;
  return {
    signals: t.signals,
    conflicts: t.conflicts,
    recommendation: t.recommendation,
    kind: t.kind,
    open: t.open,
    conflict: domain[locale].dedupConflict,
    signal: domain[locale].duplicateSignal,
  };
}

/** «Квартира, 2 комн. · Чиланзар» from confident facts; the generic title when nothing is known. */
export function postTitle(locale: Locale, facts: PostFacts): string {
  if (!facts.propertyType && facts.rooms === undefined && !facts.district) return radar[locale].detail.titleFallback;
  const place = facts.district ? districtName(facts.district, locale) : mls[locale].card.unknownDistrict;
  return `${typeWithRooms(locale, facts.propertyType, facts.rooms)} · ${place}`;
}

export interface FactChip {
  key: string;
  text: string;
  unknown: boolean;
}

/**
 * Key extracted facts as chips (§22.8). A relevant attribute without a
 * confident value becomes an explicit "…: неизвестно" chip — Unknown is a
 * value, not an omission.
 */
export function factChips(locale: Locale, parsed: ParsedListingFields): FactChip[] {
  const t = radar[locale];
  const d = domain[locale];
  const facts = postFacts(parsed);
  const unknown = (key: keyof RadarMessages["field"]): FactChip => ({
    key,
    text: format(t.card.unknownChip, { field: t.field[key] }),
    unknown: true,
  });
  const chips: FactChip[] = [];
  chips.push(
    facts.dealType ? { key: "dealType", text: d.dealType[facts.dealType], unknown: false } : unknown("dealType"),
  );
  chips.push(
    facts.propertyType
      ? { key: "propertyType", text: d.propertyType[facts.propertyType], unknown: false }
      : unknown("propertyType"),
  );
  if (roomsRelevant(facts.propertyType)) {
    chips.push(
      facts.rooms !== undefined
        ? { key: "rooms", text: format(t.value.rooms, { n: facts.rooms }), unknown: false }
        : unknown("rooms"),
    );
  }
  chips.push(
    facts.district
      ? { key: "district", text: districtName(facts.district, locale), unknown: false }
      : unknown("district"),
  );
  chips.push(
    facts.areaTotal !== undefined
      ? {
          key: "areaTotal",
          text: format(t.value.area, { n: formatNumber(locale, facts.areaTotal, { maximumFractionDigits: 1 }) }),
          unknown: false,
        }
      : unknown("areaTotal"),
  );
  if (floorRelevant(facts.propertyType)) {
    const text =
      facts.floor !== undefined && facts.floorsTotal !== undefined
        ? format(t.value.floorOf, { floor: facts.floor, total: facts.floorsTotal })
        : facts.floor !== undefined
          ? format(t.value.floor, { n: facts.floor })
          : undefined;
    chips.push(text ? { key: "floor", text, unknown: false } : unknown("floor"));
  }
  chips.push(facts.price ? { key: "price", text: formatMoney(locale, facts.price), unknown: false } : unknown("price"));
  return chips;
}

/** «Продажа, квартира, Чиланзар и 2 комн.» — what a "similar posts" subscription would watch. */
export function subscriptionText(locale: Locale, facts: PostFacts): string | undefined {
  const t = radar[locale];
  const d = domain[locale];
  const parts: string[] = [];
  if (facts.dealType) parts.push(d.dealType[facts.dealType]);
  if (facts.propertyType) parts.push(d.propertyType[facts.propertyType].toLocaleLowerCase(intlLocale[locale]));
  if (facts.district) parts.push(districtName(facts.district, locale));
  if (facts.rooms !== undefined && roomsRelevant(facts.propertyType))
    parts.push(format(t.value.rooms, { n: facts.rooms }));
  if (parts.length === 0) return undefined;
  return formatList(locale, parts);
}

/* ---------------------------------------------------------- duplicates */

/** The engine reads physical attributes only; a withheld address is never part of it. */
export function listingDedupRecord(view: ListingView): DedupRecord {
  return dedupRecordFromListing(view.listing, { ...view.property, address: view.property.address ?? "" });
}

export function listingDuplicateTitle(locale: Locale, view: ListingView): { title: string; subtitle: string } {
  return {
    title: listingTitle(locale, view.property),
    subtitle: `${formatMoney(locale, view.listing.price)} · ${agentLine(locale, view)}`,
  };
}

export function postDuplicateTitle(locale: Locale, view: TelegramListingView): { title: string; subtitle: string } {
  const facts = postFacts(view.post.parsed);
  const price = facts.price ? `${formatMoney(locale, facts.price)} · ` : "";
  return { title: postTitle(locale, facts), subtitle: `${price}${view.source.title}` };
}

function listingHref(locale: Locale, id: string): string {
  return appPath(locale, `/properties/${encodeURIComponent(id)}`);
}

/**
 * Duplicate candidates for a post page: the collector's suggestions (kept
 * even when the engine scores them low — a human flagged them for review)
 * plus what the dedup engine finds among visible listings and other posts.
 * Conflicting attributes are always computed, so "different floor" is said
 * out loud instead of hidden behind a similarity score (§34.5).
 */
export function postDuplicates(
  locale: Locale,
  post: TelegramListing,
  posts: readonly TelegramListingView[],
  listings: readonly ListingView[],
): DuplicateEntry[] {
  const target = dedupRecordFromTelegram(post);
  const postsById = new Map(posts.map((view) => [view.post.id, view]));
  const entries: DuplicateEntry[] = [];
  const seen = new Set<string>();

  for (const suggestion of post.duplicateCandidates) {
    const other = postsById.get(suggestion.listingId);
    if (!other) continue;
    const comparison = compareForDuplicates(target, dedupRecordFromTelegram(other.post));
    entries.push({
      id: other.post.id,
      kind: "telegram",
      ...postDuplicateTitle(locale, other),
      href: radarPostHref(locale, other.post.id),
      signals: suggestion.reasons,
      conflicts: comparison.conflicts,
      recommendation: comparison.recommendation,
    });
    seen.add(other.post.id);
  }

  const listingsById = new Map(listings.map((view) => [view.listing.id, view]));
  const pool: DedupRecord[] = [
    ...posts
      .filter((view) => view.post.id !== post.id && !seen.has(view.post.id))
      .map((view) => dedupRecordFromTelegram(view.post)),
    ...listings.map(listingDedupRecord),
  ];
  for (const candidate of findDuplicateCandidates(target, pool)) {
    const listing = listingsById.get(candidate.id);
    const other = postsById.get(candidate.id);
    if (listing) {
      entries.push({
        id: candidate.id,
        kind: "listing",
        ...listingDuplicateTitle(locale, listing),
        href: listingHref(locale, candidate.id),
        signals: candidate.signals,
        conflicts: candidate.conflicts,
        recommendation: candidate.recommendation,
      });
    } else if (other) {
      entries.push({
        id: candidate.id,
        kind: "telegram",
        ...postDuplicateTitle(locale, other),
        href: radarPostHref(locale, candidate.id),
        signals: candidate.signals,
        conflicts: candidate.conflicts,
        recommendation: candidate.recommendation,
      });
    }
  }
  return entries;
}

/** A record the Copilot compares a pasted post against, with its display data resolved here. */
export interface CopilotPoolEntry {
  record: DedupRecord;
  entry: Omit<DuplicateEntry, "signals" | "conflicts" | "recommendation">;
}

export function copilotPool(
  locale: Locale,
  posts: readonly TelegramListingView[],
  listings: readonly ListingView[],
): CopilotPoolEntry[] {
  return [
    ...listings.map((view) => ({
      record: listingDedupRecord(view),
      entry: {
        id: view.listing.id,
        kind: "listing" as const,
        ...listingDuplicateTitle(locale, view),
        href: listingHref(locale, view.listing.id),
      },
    })),
    ...posts.map((view) => ({
      record: dedupRecordFromTelegram(view.post),
      entry: {
        id: view.post.id,
        kind: "telegram" as const,
        ...postDuplicateTitle(locale, view),
        href: radarPostHref(locale, view.post.id),
      },
    })),
  ];
}
