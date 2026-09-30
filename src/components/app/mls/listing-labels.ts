import { format } from "@/i18n/define-messages";
import { formatNumber } from "@/i18n/format";
import { intlLocale, type Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import radar from "@/i18n/messages/radar";
import type { ListingView, PropertyView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import type { PropertyType } from "@/lib/domain/types";

/**
 * Privacy-safe labels for listings in the MLS and in Radar duplicate lists.
 * Built only from fields every access level may see — type, rooms, massif,
 * landmark, district — never the full address (§16.3, §36.4).
 */

export function roomsRelevant(type: PropertyType | undefined): boolean {
  return type === undefined || type === "apartment" || type === "house";
}

export function floorRelevant(type: PropertyType | undefined): boolean {
  return type === undefined || type === "apartment" || type === "commercial" || type === "room";
}

/** "a, b и c" / "a, b va c". */
export function joinList(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(items);
}

/** «Квартира, 3 комн.» — the type with rooms where rooms apply. */
export function typeWithRooms(locale: Locale, type: PropertyType | undefined, rooms: number | undefined): string {
  const typeText = type ? domain[locale].propertyType[type] : mls[locale].card.unknownType;
  if (rooms === undefined || !roomsRelevant(type)) return typeText;
  return `${typeText}, ${format(radar[locale].value.rooms, { n: rooms })}`;
}

/** «Квартира, 3 комн. · Юнусабад-19 квартал». */
export function listingTitle(locale: Locale, property: PropertyView): string {
  const place = property.areaName ?? districtName(property.district, locale);
  return `${typeWithRooms(locale, property.propertyType, property.rooms)} · ${place}`;
}

/** District, massif and landmark without repeats; the full address never appears here. */
export function listingPlace(locale: Locale, property: PropertyView): string {
  const district = districtName(property.district, locale);
  // "Шайхантахур, ул. Навои" already names the district.
  const areaNamesDistrict = property.areaName?.toLocaleLowerCase(locale).includes(district.toLocaleLowerCase(locale));
  const parts = [areaNamesDistrict ? undefined : district, property.areaName, property.landmark].filter(
    (part): part is string => Boolean(part),
  );
  return [...new Set(parts)].join(" · ");
}

/** «54 м² · 3/4 этаж» with unknown values left out (the chips name them). */
export function sizeLine(locale: Locale, property: PropertyView): string | undefined {
  const r = radar[locale].value;
  const parts: string[] = [];
  if (property.areaTotal !== undefined) {
    parts.push(format(r.area, { n: formatNumber(locale, property.areaTotal, { maximumFractionDigits: 1 }) }));
  }
  if (floorRelevant(property.propertyType)) {
    if (property.floor !== undefined && property.floorsTotal !== undefined) {
      parts.push(format(r.floorOf, { floor: property.floor, total: property.floorsTotal }));
    } else if (property.floor !== undefined) {
      parts.push(format(r.floor, { n: property.floor }));
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** «Азиз Каримов · Demo Realty» or «… · без агентства». */
export function agentLine(locale: Locale, view: Pick<ListingView, "agent" | "organization">): string {
  const t = mls[locale].card;
  return view.organization
    ? format(t.by, { agent: view.agent.name, organization: view.organization.name })
    : format(t.independent, { agent: view.agent.name });
}
