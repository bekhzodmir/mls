import type { PropertyListParams } from "@/components/app/inventory/filters";
import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import requirementDetail from "@/i18n/messages/requirement-detail";
import { districtName } from "@/lib/domain/geo";
import { formatMoney, toMajor } from "@/lib/domain/money";
import type { Range, Requirement, RequirementCriterion } from "@/lib/domain/types";

/**
 * What a requirement asks for, criterion by criterion, with each one marked
 * as a hard constraint or a soft preference (§35.4 step 3). Only what the
 * requirement actually says is listed; unconstrained criteria are returned
 * separately so the screen can say "not specified" instead of inventing a
 * default (§36.3 Requirement Editor).
 */

export const criterionKeys = [
  "dealType",
  "propertyType",
  "location",
  "rooms",
  "area",
  "price",
  "floor",
  "buildingKind",
  "renovation",
  "mortgage",
  "extras",
] as const;
export type CriterionKey = (typeof criterionKeys)[number];

/** Which requirement criterion can make each item a must-have. */
const hardCriterion: Partial<Record<CriterionKey, RequirementCriterion>> = {
  propertyType: "property_type",
  location: "location",
  rooms: "rooms",
  area: "area",
  price: "price",
  floor: "floor",
  buildingKind: "building_kind",
  renovation: "renovation",
};

export interface CriterionItem {
  key: CriterionKey;
  value: string;
  /** Deal type is always a hard filter (§12.2); others only when the agent marked them. */
  hard: boolean;
}

export interface RequirementCriteria {
  items: CriterionItem[];
  /** Criteria the requirement leaves open. */
  unset: CriterionKey[];
}

function list(locale: Locale, items: string[], type: "conjunction" | "disjunction" = "disjunction"): string {
  return new Intl.ListFormat(intlLocale[locale], { type }).format(items);
}

function numberText(locale: Locale, value: number): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 1 }).format(value);
}

interface RangeTemplates {
  exact: string;
  range: string;
  from: string;
  to: string;
}

function rangeText<T>(
  range: Range<T>,
  templates: RangeTemplates,
  show: (value: T) => string,
  same: (a: T, b: T) => boolean,
): string | undefined {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) {
    return same(min, max)
      ? format(templates.exact, { n: show(min) })
      : format(templates.range, { min: show(min), max: show(max) });
  }
  if (min !== undefined) return format(templates.from, { min: show(min) });
  if (max !== undefined) return format(templates.to, { max: show(max) });
  return undefined;
}

export function requirementCriteria(locale: Locale, requirement: Requirement): RequirementCriteria {
  const t = requirementDetail[locale].criteria;
  const d = domain[locale];
  const hard = new Set(requirement.hardCriteria);
  const values: Partial<Record<CriterionKey, string>> = {};

  values.dealType = d.dealType[requirement.dealType];
  if (requirement.propertyTypes.length > 0) {
    values.propertyType = list(locale, requirement.propertyTypes.map((type) => d.propertyType[type]));
  }
  if (requirement.districts.length > 0) {
    values.location = list(locale, requirement.districts.map((id) => districtName(id, locale)));
  }
  const num = (value: number) => numberText(locale, value);
  const same = (a: number, b: number) => a === b;
  const plain: RangeTemplates = { exact: t.exact, range: t.range, from: t.from, to: t.to };
  const sqm: RangeTemplates = { exact: t.areaExact, range: t.areaRange, from: t.areaFrom, to: t.areaTo };
  values.rooms = rangeText(requirement.rooms, plain, num, same);
  values.area = rangeText(requirement.area, sqm, num, same);
  values.price = rangeText(
    requirement.budget,
    plain,
    (value) => formatMoney(locale, value),
    (a, b) => a.amountMinor === b.amountMinor && a.currency === b.currency,
  );

  const floor = requirement.floor;
  if (floor) {
    const parts: string[] = [];
    if (floor.notFirst) parts.push(t.floorNotFirst);
    if (floor.notLast) parts.push(t.floorNotLast);
    const bounds = rangeText({ min: floor.min, max: floor.max }, plain, num, same);
    if (bounds) parts.push(bounds);
    if (parts.length > 0) values.floor = parts.join(", ");
  }
  if (requirement.buildingKind) values.buildingKind = d.buildingKind[requirement.buildingKind];
  if (requirement.renovation?.length) {
    values.renovation = list(locale, requirement.renovation.map((state) => d.renovation[state]));
  }
  if (requirement.mortgage !== undefined) values.mortgage = requirement.mortgage ? t.mortgageYes : t.mortgageNo;
  const extras = requirement.extras.map((extra) => extra.trim()).filter(Boolean);
  if (extras.length > 0) values.extras = extras.join(", ");

  const items: CriterionItem[] = [];
  const unset: CriterionKey[] = [];
  for (const key of criterionKeys) {
    const value = values[key];
    if (value === undefined) {
      unset.push(key);
      continue;
    }
    const criterion = hardCriterion[key];
    items.push({ key, value, hard: key === "dealType" || (criterion !== undefined && hard.has(criterion)) });
  }
  return { items, unset };
}

/**
 * Property-list filters that approximate the requirement, for "Найти в
 * объектах". Only unambiguous criteria become filters (one type, one
 * district); the budget ceiling travels with its currency (§34.1).
 */
export function propertySearchFor(requirement: Requirement): PropertyListParams {
  const params: PropertyListParams = { scope: "all", view: "list", dealType: requirement.dealType };
  if (requirement.propertyTypes.length === 1) params.propertyType = requirement.propertyTypes[0];
  if (requirement.districts.length === 1) params.district = requirement.districts[0];
  if (requirement.rooms.min !== undefined) params.roomsMin = requirement.rooms.min;
  if (requirement.rooms.max !== undefined) params.roomsMax = requirement.rooms.max;
  const max = requirement.budget.max;
  if (max) {
    params.priceMax = toMajor(max);
    params.currency = max.currency;
  }
  return params;
}
