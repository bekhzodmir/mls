import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import editor from "@/i18n/messages/requirement-editor";
import type { MatchTargetView, PropertyView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import type { MatchCandidate } from "@/lib/domain/matching";
import type { DistrictId, ParsedField, PropertyType, TelegramListing } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Privacy-safe names for objects inside CRM screens: «Квартира · 3-комн. ·
 * Юнусабад-19». Built from type, rooms, massif and district only — never the
 * full address — so the same label works for masked partner listings. A
 * Telegram post names only confidently parsed fields (Unknown stays Unknown).
 */

const MIN_SHOWN_CONFIDENCE = 0.6;

export function objectLabel(
  locale: Locale,
  parts: { propertyType?: PropertyType; rooms?: number; district?: DistrictId; place?: string },
): string {
  const t = editor[locale].results;
  const type = parts.propertyType ? domain[locale].propertyType[parts.propertyType] : t.unknownType;
  const rooms =
    parts.rooms !== undefined && parts.propertyType !== "land" ? format(t.rooms, { n: parts.rooms }) : undefined;
  const place = parts.place ?? (parts.district ? districtName(parts.district, locale) : t.unknownPlace);
  return [type, rooms, place].filter(Boolean).join(" · ");
}

export function propertyLabel(locale: Locale, property: PropertyView): string {
  return objectLabel(locale, {
    propertyType: property.propertyType,
    rooms: property.rooms,
    district: property.district,
    place: property.areaName,
  });
}

function confident<T>(field: ParsedField<T>): T | undefined {
  return field.confidence >= MIN_SHOWN_CONFIDENCE ? field.value : undefined;
}

export function telegramLabel(locale: Locale, post: TelegramListing): string {
  return objectLabel(locale, {
    propertyType: confident(post.parsed.propertyType),
    rooms: confident(post.parsed.rooms),
    district: confident(post.parsed.district),
  });
}

export function candidateLabel(locale: Locale, candidate: MatchCandidate, place?: string): string {
  return objectLabel(locale, {
    propertyType: candidate.propertyType,
    rooms: candidate.rooms,
    district: candidate.district,
    place,
  });
}

export function matchTargetLabel(locale: Locale, target: MatchTargetView): string {
  return target.kind === "listing"
    ? propertyLabel(locale, target.view.property)
    : telegramLabel(locale, target.view.post);
}

/** Property screens are keyed by the listing id (Property ≠ Listing); posts open in the Radar. */
export function matchTargetHref(locale: Locale, target: MatchTargetView): string {
  return target.kind === "listing"
    ? appPath(locale, `/properties/${encodeURIComponent(target.view.listing.id)}`)
    : appPath(locale, `/radar/${encodeURIComponent(target.view.post.id)}`);
}

export function listingHref(locale: Locale, listingId: string): string {
  return appPath(locale, `/properties/${encodeURIComponent(listingId)}`);
}
