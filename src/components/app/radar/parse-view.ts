import { format } from "@/i18n/define-messages";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { DEDUP_MIN_PARSE_CONFIDENCE, type DedupRecord } from "@/lib/domain/dedup";
import { districtName } from "@/lib/domain/geo";
import { formatMoney } from "@/lib/domain/money";
import { formatUzPhone } from "@/lib/domain/phone";
import type { DealType, DistrictId, Money, ParsedField, ParsedListingFields, PropertyType } from "@/lib/domain/types";

/**
 * Presentation logic for parsed Telegram posts (§13.2, §22.8, §35.5), shared
 * by the Radar list, the post page and the Copilot. Pure and client-safe:
 * labels arrive as arguments, so client components ship no dictionaries.
 *
 * One threshold everywhere: below `MIN_PARSE_CONFIDENCE` a parsed value is
 * Unknown — the same bar matching and dedup use — so what the screen calls
 * "recognized" is exactly what takes part in matching.
 */

export const MIN_PARSE_CONFIDENCE = DEDUP_MIN_PARSE_CONFIDENCE;
/** From here a value is shown as high confidence; between the two, medium. */
export const HIGH_CONFIDENCE = 0.85;

export const parsedFieldKeys = [
  "dealType",
  "propertyType",
  "district",
  "rooms",
  "areaTotal",
  "floor",
  "floorsTotal",
  "price",
  "phone",
] as const satisfies readonly (keyof ParsedListingFields)[];
export type ParsedFieldKey = (typeof parsedFieldKeys)[number];

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export function confidenceLevel(field: ParsedField<unknown>): ConfidenceLevel {
  if (field.value === undefined) return "none";
  if (field.confidence >= HIGH_CONFIDENCE) return "high";
  if (field.confidence >= MIN_PARSE_CONFIDENCE) return "medium";
  return "low";
}

/** The value when it is confident enough to use, otherwise Unknown. */
export function confident<T>(field: ParsedField<T>): T | undefined {
  return field.confidence >= MIN_PARSE_CONFIDENCE ? field.value : undefined;
}

/** Percent for display, 0–100 without fractions. */
export function confidencePercent(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

/**
 * Fields that apply to the post's (confident) property type: rooms mean
 * nothing for a shop, a single room or a plot; floors mean nothing for a
 * house or a plot. With an unknown type every field applies.
 */
export function relevantFields(parsed: ParsedListingFields): ParsedFieldKey[] {
  const type = confident(parsed.propertyType);
  return parsedFieldKeys.filter((key) => {
    if (key === "rooms") return type === undefined || type === "apartment" || type === "house";
    if (key === "floor" || key === "floorsTotal") {
      return type === undefined || type === "apartment" || type === "commercial" || type === "room";
    }
    return true;
  });
}

export interface ParseQuality {
  /** Relevant fields with a confident value. */
  recognized: number;
  total: number;
  /** Mean confidence over relevant fields, Unknown counting as 0; 0..1. */
  score: number;
  level: ConfidenceLevel;
}

/** One indicator for a whole post: how much of it the parser could read, and how surely. */
export function parseQuality(parsed: ParsedListingFields): ParseQuality {
  const keys = relevantFields(parsed);
  const confidences = keys.map((key) => {
    const field = parsed[key] as ParsedField<unknown>;
    return field.value === undefined ? 0 : field.confidence;
  });
  const recognized = keys.filter((key) => confident(parsed[key] as ParsedField<unknown>) !== undefined).length;
  const score = keys.length === 0 ? 0 : Math.round((confidences.reduce((a, b) => a + b, 0) / keys.length) * 100) / 100;
  const level: ConfidenceLevel =
    recognized === 0 ? "none" : score >= HIGH_CONFIDENCE ? "high" : score >= MIN_PARSE_CONFIDENCE ? "medium" : "low";
  return { recognized, total: keys.length, score, level };
}

/** Confident facts of a post, for titles, chips and subscriptions. */
export interface PostFacts {
  dealType?: DealType;
  propertyType?: PropertyType;
  district?: DistrictId;
  rooms?: number;
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
  price?: Money;
}

export function postFacts(parsed: ParsedListingFields): PostFacts {
  const facts: PostFacts = {};
  const dealType = confident(parsed.dealType);
  const propertyType = confident(parsed.propertyType);
  const district = confident(parsed.district);
  const rooms = confident(parsed.rooms);
  const areaTotal = confident(parsed.areaTotal);
  const floor = confident(parsed.floor);
  const floorsTotal = confident(parsed.floorsTotal);
  const price = confident(parsed.price);
  if (dealType) facts.dealType = dealType;
  if (propertyType) facts.propertyType = propertyType;
  if (district) facts.district = district;
  if (rooms !== undefined) facts.rooms = rooms;
  if (areaTotal !== undefined) facts.areaTotal = areaTotal;
  if (floor !== undefined) facts.floor = floor;
  if (floorsTotal !== undefined) facts.floorsTotal = floorsTotal;
  if (price) facts.price = price;
  return facts;
}

/** The fields that form a "similar posts" subscription; empty when nothing is known. */
export function subscriptionFacts(
  facts: PostFacts,
): Pick<PostFacts, "dealType" | "propertyType" | "district" | "rooms"> {
  const criteria: Pick<PostFacts, "dealType" | "propertyType" | "district" | "rooms"> = {};
  if (facts.dealType) criteria.dealType = facts.dealType;
  if (facts.propertyType) criteria.propertyType = facts.propertyType;
  if (facts.district) criteria.district = facts.district;
  if (facts.rooms !== undefined) criteria.rooms = facts.rooms;
  return criteria;
}

/** Single-line excerpt that never cuts a word in half; emoji and line breaks are kept readable. */
export function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/* --------------------------------------------------------------- values */

export interface ValueLabels {
  value: { rooms: string; area: string; floor: string; floorsTotal: string };
  dealType: Record<DealType, string>;
  propertyType: Record<PropertyType, string>;
}

/**
 * Human text of a parsed value, whatever its confidence (callers decide
 * whether a low-confidence value is shown as a hint or treated as Unknown).
 * Undefined when the parser found nothing.
 */
export function formatParsedValue(
  locale: Locale,
  parsed: ParsedListingFields,
  key: ParsedFieldKey,
  labels: ValueLabels,
): string | undefined {
  switch (key) {
    case "dealType":
      return parsed.dealType.value ? labels.dealType[parsed.dealType.value] : undefined;
    case "propertyType":
      return parsed.propertyType.value ? labels.propertyType[parsed.propertyType.value] : undefined;
    case "district":
      return parsed.district.value ? districtName(parsed.district.value, locale) : undefined;
    case "rooms":
      return parsed.rooms.value === undefined ? undefined : format(labels.value.rooms, { n: parsed.rooms.value });
    case "areaTotal":
      return parsed.areaTotal.value === undefined
        ? undefined
        : format(labels.value.area, { n: formatNumber(locale, parsed.areaTotal.value, { maximumFractionDigits: 1 }) });
    case "floor":
      return parsed.floor.value === undefined ? undefined : format(labels.value.floor, { n: parsed.floor.value });
    case "floorsTotal":
      return parsed.floorsTotal.value === undefined
        ? undefined
        : format(labels.value.floorsTotal, { n: parsed.floorsTotal.value });
    case "price":
      return parsed.price.value ? formatMoney(locale, parsed.price.value) : undefined;
    case "phone":
      return parsed.phone.value ? formatUzPhone(parsed.phone.value) : undefined;
  }
}

/* ---------------------------------------------------------------- dedup */

/**
 * A pasted draft as a dedup record — the same rule as `dedupRecordFromTelegram`:
 * only confidently parsed fields take part, so a guess never creates a match.
 */
export function draftDedupRecord(parsed: ParsedListingFields, text: string, id = "draft"): DedupRecord {
  const record: DedupRecord = { id, text };
  const phone = confident(parsed.phone);
  const district = confident(parsed.district);
  const rooms = confident(parsed.rooms);
  const areaTotal = confident(parsed.areaTotal);
  const floor = confident(parsed.floor);
  const price = confident(parsed.price);
  const dealType = confident(parsed.dealType);
  if (phone) record.phone = phone;
  if (district) record.district = district;
  if (rooms !== undefined) record.rooms = rooms;
  if (areaTotal !== undefined) record.areaTotal = areaTotal;
  if (floor !== undefined) record.floor = floor;
  if (price) record.price = price;
  if (dealType) record.dealType = dealType;
  return record;
}

/* ---------------------------------------------------------------- links */

/**
 * Recognizes a public post link: "https://t.me/handle/123", "t.me/handle/123",
 * "telegram.me/handle/123" (a trailing "?single" or "/" is allowed). Private
 * "t.me/c/…" links and invite links are not public posts and return undefined.
 */
export function parseTelegramLink(input: string): { handle: string; messageId: number; url: string } | undefined {
  const match =
    /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{3,31})\/(\d{1,10})\/?(?:\?[^\s]*)?$/.exec(
      input.trim(),
    );
  if (!match) return undefined;
  const [, handle, id] = match;
  if (handle.toLowerCase() === "c" || handle.toLowerCase() === "joinchat") return undefined;
  const messageId = Number(id);
  return { handle, messageId, url: `https://t.me/${handle}/${messageId}` };
}

/** True when the input is a single link-looking token rather than post text. */
export function looksLikeLink(input: string): boolean {
  const trimmed = input.trim();
  return /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\//i.test(trimmed) && !/\s/.test(trimmed);
}

/** Same post, whatever the letter case of the handle. */
export function sameTelegramUrl(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
