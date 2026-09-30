import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import today from "@/i18n/messages/today";
import { districtName } from "@/lib/domain/geo";
import type { ParsedField, PropertyType, TelegramListing } from "@/lib/domain/types";
import type { PropertyView } from "@/lib/data/views";

/**
 * Short, privacy-safe names for objects in feeds and search results:
 * «3-комн. квартира · Юнусабад-19 квартал». Built only from fields every
 * access level may see (type, rooms, massif, district) — never the full
 * address, so the same label works for masked partner listings.
 */

/** Parsed Telegram fields below this confidence are shown as Unknown (§13.2). */
export const MIN_SHOWN_CONFIDENCE = 0.6;

function typeWithRooms(locale: Locale, propertyType: PropertyType | undefined, rooms: number | undefined): string {
  const t = today[locale].listing;
  if (!propertyType) return rooms === undefined ? t.unknownType : format(t.roomsOnly, { n: rooms });
  const type = domain[locale].propertyType[propertyType];
  if (rooms === undefined || propertyType === "land") return type;
  return format(t.rooms, { n: rooms, type: type.toLocaleLowerCase(intlLocale[locale]) });
}

export function listingTitle(locale: Locale, property: PropertyView): string {
  const place = property.areaName ?? districtName(property.district, locale);
  return `${typeWithRooms(locale, property.propertyType, property.rooms)} · ${place}`;
}

function confident<T>(field: ParsedField<T>): T | undefined {
  return field.confidence >= MIN_SHOWN_CONFIDENCE ? field.value : undefined;
}

/** A Telegram post is an advertisement, not a verified object: only confident parsed fields are named. */
export function telegramTitle(locale: Locale, post: TelegramListing): string {
  const district = confident(post.parsed.district);
  const place = district ? districtName(district, locale) : today[locale].listing.unknownPlace;
  const kind = typeWithRooms(locale, confident(post.parsed.propertyType), confident(post.parsed.rooms));
  return `${kind} · ${place}`;
}

/** The given name for greetings: «Азиз Каримов» → «Азиз». */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
