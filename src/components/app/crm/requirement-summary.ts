import { intlLocale, type Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import { districtName } from "@/lib/domain/geo";
import { formatMoney } from "@/lib/domain/money";
import type { Money, Range, Requirement } from "@/lib/domain/types";

/**
 * Short, human summary of what a client is looking for (§14.3 top block,
 * §22.3): «Продажа · Квартира · Чиланзар · 2–3 комн. · до $75 000». Only
 * what the requirement actually says is named — an unset criterion is left
 * out, never filled with a default. Uzbek word order is respected
 * («$75 000 gacha», «kamida 2 xonali»).
 */

export type RequirementLike = Pick<
  Requirement,
  "dealType" | "propertyTypes" | "districts" | "rooms" | "area" | "budget"
>;

type RangeTemplates = { exact?: string; range: string; min: string; max: string };

function number(locale: Locale, value: number): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 1 }).format(value);
}

/** Formats a range with the given templates; undefined when both bounds are unset. */
export function formatRange<T>(
  range: Range<T>,
  templates: RangeTemplates,
  show: (value: T) => string,
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): string | undefined {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) {
    if (same(min, max) && templates.exact) return format(templates.exact, { n: show(min) });
    return format(templates.range, { min: show(min), max: show(max) });
  }
  if (max !== undefined) return format(templates.max, { max: show(max) });
  if (min !== undefined) return format(templates.min, { min: show(min) });
  return undefined;
}

export function formatRooms(locale: Locale, rooms: Range<number>): string | undefined {
  return formatRange(rooms, clients[locale].requirement.rooms, (value) => number(locale, value));
}

export function formatArea(locale: Locale, area: Range<number>): string | undefined {
  return formatRange(area, clients[locale].requirement.area, (value) => number(locale, value));
}

export function formatBudget(locale: Locale, budget: Range<Money>): string | undefined {
  return formatRange(
    budget,
    clients[locale].requirement.budget,
    (value) => formatMoney(locale, value),
    (a, b) => a.amountMinor === b.amountMinor && a.currency === b.currency,
  );
}

/** "Чиланзар, Юнусабад +2" or "Любой район". */
export function formatDistricts(locale: Locale, ids: Requirement["districts"], limit = 2): string {
  const t = clients[locale].requirement;
  if (ids.length === 0) return t.anyDistrict;
  const names = ids
    .slice(0, limit)
    .map((id) => districtName(id, locale))
    .join(", ");
  return ids.length > limit ? `${names} ${format(t.moreDistricts, { n: ids.length - limit })}` : names;
}

/** Chips in reading order: deal, type, place, rooms, area, budget. */
export function requirementChips(locale: Locale, requirement: RequirementLike, districtLimit = 2): string[] {
  const d = domain[locale];
  const chips: string[] = [d.dealType[requirement.dealType]];
  if (requirement.propertyTypes.length > 0) {
    chips.push(requirement.propertyTypes.map((type) => d.propertyType[type]).join(" / "));
  }
  chips.push(formatDistricts(locale, requirement.districts, districtLimit));
  for (const part of [
    formatRooms(locale, requirement.rooms),
    formatArea(locale, requirement.area),
    formatBudget(locale, requirement.budget),
  ]) {
    if (part) chips.push(part);
  }
  return chips;
}

export function requirementSummary(locale: Locale, requirement: RequirementLike): string {
  return requirementChips(locale, requirement).join(" · ");
}
