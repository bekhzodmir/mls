import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import { districtName } from "@/lib/domain/geo";
import { compareMoney } from "@/lib/domain/money";
import type {
  DistrictId,
  ISODateTime,
  Listing,
  Money,
  ParsedField,
  PropertyType,
  TelegramListing,
  VerificationItem,
  VerificationSubject,
} from "@/lib/domain/types";

/**
 * Short, privacy-safe labels for properties, listings and Telegram posts.
 * They are built only from fields every access level may see (type, rooms,
 * massif, landmark, district) — never the full address — so the same label
 * works on a masked partner listing (§16.3, §36.4). Missing values are named
 * as unknown, never filled with a default.
 */

/** Parsed Telegram fields below this confidence are Unknown (§13.2; same bar as matching). */
export const MIN_CONFIDENCE = 0.6;

export function confidentValue<T>(field: ParsedField<T>, min = MIN_CONFIDENCE): T | undefined {
  return field.confidence >= min ? field.value : undefined;
}

/** The physical facts a label needs; satisfied by Property, PropertyView and parsed posts. */
export interface PhysicalFacts {
  propertyType?: PropertyType;
  district?: DistrictId;
  areaName?: string;
  landmark?: string;
  rooms?: number;
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
}

function number(locale: Locale, value: number): string {
  return formatNumber(locale, value, { maximumFractionDigits: 1 });
}

/** Room counts matter for flats and houses; floors for flats, single rooms and premises; land has neither. */
function roomsRelevant(type: PropertyType | undefined): boolean {
  return type === undefined || type === "apartment" || type === "house";
}

function floorRelevant(type: PropertyType | undefined): boolean {
  return type === undefined || type === "apartment" || type === "commercial" || type === "room";
}

/** «3-комн. квартира», «Дом», «Квартира», or «Тип неизвестен». */
export function typeLabel(locale: Locale, facts: Pick<PhysicalFacts, "propertyType" | "rooms">): string {
  const t = properties[locale].label;
  const { propertyType, rooms } = facts;
  if (!propertyType) return rooms === undefined ? t.unknownType : format(t.roomsOnly, { n: rooms });
  const type = domain[locale].propertyType[propertyType];
  if (rooms === undefined || !roomsRelevant(propertyType)) return type;
  return format(t.roomsType, { n: rooms, type: type.toLocaleLowerCase(intlLocale[locale]) });
}

/** «Юнусабад», «Юнусабад-19 квартал» or «Район неизвестен». */
export function placeLabel(locale: Locale, facts: Pick<PhysicalFacts, "district" | "areaName">): string {
  if (facts.areaName) return facts.areaName;
  return facts.district ? districtName(facts.district, locale) : properties[locale].label.unknownDistrict;
}

/** «3-комн. квартира · Юнусабад-19 квартал». */
export function propertyTitle(locale: Locale, facts: PhysicalFacts): string {
  return `${typeLabel(locale, facts)} · ${placeLabel(locale, facts)}`;
}

/**
 * District, massif and landmark without repeats: «Юнусабад · Юнусабад-19
 * квартал · метро Шахристан». The full address never appears here.
 */
export function locationLine(locale: Locale, facts: PhysicalFacts): string {
  const parts = [
    facts.district ? districtName(facts.district, locale) : properties[locale].label.unknownDistrict,
    facts.areaName,
    facts.landmark,
  ].filter((part): part is string => Boolean(part));
  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLocaleLowerCase(intlLocale[locale]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" · ");
}

/** «4/9 этаж», «4 этаж», «этажей: 2» — or undefined when nothing is known. */
export function floorText(locale: Locale, facts: Pick<PhysicalFacts, "floor" | "floorsTotal">): string | undefined {
  const t = properties[locale].label;
  const { floor, floorsTotal } = facts;
  if (floor !== undefined && floorsTotal !== undefined) return format(t.floorOf, { floor, total: floorsTotal });
  if (floor !== undefined) return format(t.floor, { floor });
  if (floorsTotal !== undefined) return format(t.floorsTotal, { total: floorsTotal });
  return undefined;
}

export interface AttributeChip {
  key: "rooms" | "area" | "floor";
  text: string;
  /** True when the value is missing: rendered as Unknown, not hidden. */
  unknown: boolean;
}

/**
 * Rooms / area / floor chips. A relevant attribute that is missing becomes an
 * explicit "unknown" chip; attributes that do not apply to the type
 * (rooms of a shop, floor of a plot) are left out.
 */
export function attributeChips(locale: Locale, facts: PhysicalFacts): AttributeChip[] {
  const t = properties[locale].label;
  const chips: AttributeChip[] = [];
  if (roomsRelevant(facts.propertyType)) {
    chips.push(
      facts.rooms === undefined
        ? { key: "rooms", text: t.roomsUnknown, unknown: true }
        : { key: "rooms", text: format(t.rooms, { n: facts.rooms }), unknown: false },
    );
  }
  chips.push(
    facts.areaTotal === undefined
      ? { key: "area", text: t.areaUnknown, unknown: true }
      : { key: "area", text: format(t.area, { n: number(locale, facts.areaTotal) }), unknown: false },
  );
  if (floorRelevant(facts.propertyType) || facts.floorsTotal !== undefined) {
    const text = floorText(locale, facts);
    chips.push(text ? { key: "floor", text, unknown: false } : { key: "floor", text: t.floorUnknown, unknown: true });
  }
  return chips;
}

export function areaText(locale: Locale, areaTotal: number | undefined): string {
  const t = properties[locale].label;
  return areaTotal === undefined ? domain[locale].unknown : format(t.area, { n: number(locale, areaTotal) });
}

/* --------------------------------------------------------------- price */

export interface PriceChange {
  previous: Money;
  current: Money;
  at: ISODateTime;
  direction: "down" | "up";
}

/**
 * The most recent price step of a listing, if it changed and both prices are
 * in the same currency (a currency switch is not a "drop").
 */
export function latestPriceChange(listing: Pick<Listing, "priceHistory">): PriceChange | undefined {
  const history = listing.priceHistory;
  if (history.length < 2) return undefined;
  const last = history[history.length - 1];
  const previous = history[history.length - 2];
  if (last.price.currency !== previous.price.currency) return undefined;
  const order = compareMoney(last.price, previous.price);
  if (order === 0) return undefined;
  return { previous: previous.price, current: last.price, at: last.at, direction: order < 0 ? "down" : "up" };
}

/* -------------------------------------------------------- verification */

export interface VerificationSummary {
  total: number;
  confirmed: number;
  pending: number;
  /** The registry or source did not answer — never counted as confirmed (§16.4). */
  unavailable: number;
  problems: VerificationSubject[];
}

export function verificationSummary(items: readonly VerificationItem[]): VerificationSummary {
  const summary: VerificationSummary = { total: items.length, confirmed: 0, pending: 0, unavailable: 0, problems: [] };
  for (const item of items) {
    if (item.status === "confirmed") summary.confirmed += 1;
    else if (item.status === "pending") summary.pending += 1;
    else if (item.status === "unavailable") summary.unavailable += 1;
    else summary.problems.push(item.subject);
  }
  return summary;
}

/* ------------------------------------------------------------ telegram */

/** Confident physical facts of a post: an advertisement, not a verified object (§34.4). */
export function telegramFacts(post: Pick<TelegramListing, "parsed">): PhysicalFacts {
  const facts: PhysicalFacts = {};
  const { parsed } = post;
  const propertyType = confidentValue(parsed.propertyType);
  const district = confidentValue(parsed.district);
  const rooms = confidentValue(parsed.rooms);
  const areaTotal = confidentValue(parsed.areaTotal);
  const floor = confidentValue(parsed.floor);
  const floorsTotal = confidentValue(parsed.floorsTotal);
  if (propertyType) facts.propertyType = propertyType;
  if (district) facts.district = district;
  if (rooms !== undefined) facts.rooms = rooms;
  if (areaTotal !== undefined) facts.areaTotal = areaTotal;
  if (floor !== undefined) facts.floor = floor;
  if (floorsTotal !== undefined) facts.floorsTotal = floorsTotal;
  return facts;
}

/* --------------------------------------------------------- free text */

/**
 * Language of stored free text (descriptions, requests) for the `lang`
 * attribute: Cyrillic reads as Russian, Latin as Uzbek (Latin). A hint for
 * screen readers and hyphenation — user text is never translated (§14.4).
 */
export function textLang(text: string): "ru" | "uz-Latn" {
  return /[\u0400-\u04FF]/.test(text) ? "ru" : "uz-Latn";
}
