import { toMajor } from "@/lib/domain/money";
import {
  draftToRequirementFields,
  parseRequirementText,
  type FloorPreference,
  type RequirementDraft,
} from "@/lib/domain/requirement-parser";
import type {
  BuildingKind,
  Currency,
  DealType,
  DistrictId,
  Money,
  PropertyType,
  Range,
  RenovationState,
} from "@/lib/domain/types";

/**
 * «Чиланзар 2 комнаты до 70 000» → structured criteria and property-list
 * filters (§9.3, §14.4). Only confident fields from the requirement parser
 * are used, the currency is never guessed (§35.5), and every criterion says
 * whether it made it into the list filter, so the screen can be honest about
 * what the link will and will not filter by.
 */

/** URL filters read by the property list (`/app/properties`). */
export const PROPERTY_FILTER_KEYS = [
  "dealType",
  "propertyType",
  "district",
  "roomsMin",
  "roomsMax",
  "priceMax",
  "currency",
] as const;
export type PropertyFilterKey = (typeof PROPERTY_FILTER_KEYS)[number];
export type PropertyFilterParams = Partial<Record<PropertyFilterKey, string>>;

export type QueryCriterion =
  | { kind: "dealType"; value: DealType }
  | { kind: "propertyType"; value: PropertyType[] }
  | { kind: "district"; value: DistrictId[] }
  | { kind: "rooms"; value: Range<number> }
  | { kind: "budget"; value: Range<Money> & { currency: Currency } }
  /** Amounts in major units whose currency the text did not name. */
  | { kind: "amount"; value: Range<number> }
  | { kind: "area"; value: Range<number> }
  | { kind: "floor"; value: FloorPreference }
  | { kind: "buildingKind"; value: BuildingKind }
  | { kind: "renovation"; value: RenovationState[] }
  | { kind: "mortgage"; value: boolean }
  | { kind: "extras"; value: string[] };

export interface InterpretedCriterion {
  criterion: QueryCriterion;
  /** True when the property-list link filters by it. */
  applied: boolean;
}

export interface QueryInterpretation {
  draft: RequirementDraft;
  criteria: InterpretedCriterion[];
  params: PropertyFilterParams;
  /**
   * A price ceiling (minor units, as written) without a currency. The user
   * picks USD or UZS explicitly; the link in `params` leaves the price out
   * until then.
   */
  currencyChoice?: { maxMinor: number };
}

/** Digits with phone punctuation: searched as a phone fragment, not parsed as a budget. */
export function isPhoneLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  return /^[\d\s()+-]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 4;
}

function majorString(value: Money): string {
  return String(toMajor(value));
}

/** Structured reading of a search query, or undefined when it has no criteria. */
export function interpretQuery(query: string): QueryInterpretation | undefined {
  if (!query.trim() || isPhoneLikeQuery(query)) return undefined;
  const draft = parseRequirementText(query);
  const fields = draftToRequirementFields(draft);
  const criteria: InterpretedCriterion[] = [];
  const params: PropertyFilterParams = {};
  const add = (criterion: QueryCriterion, applied: boolean) => criteria.push({ criterion, applied });

  if (fields.dealType) {
    params.dealType = fields.dealType;
    add({ kind: "dealType", value: fields.dealType }, true);
  }
  if (fields.propertyTypes?.length) {
    // The list filters by one type; "дом или участок" stays a visible, unapplied criterion.
    const single = fields.propertyTypes.length === 1;
    if (single) params.propertyType = fields.propertyTypes[0];
    add({ kind: "propertyType", value: fields.propertyTypes }, single);
  }
  if (fields.districts?.length) {
    const single = fields.districts.length === 1;
    if (single) params.district = fields.districts[0];
    add({ kind: "district", value: fields.districts }, single);
  }
  if (fields.rooms && (fields.rooms.min !== undefined || fields.rooms.max !== undefined)) {
    if (fields.rooms.min !== undefined) params.roomsMin = String(fields.rooms.min);
    if (fields.rooms.max !== undefined) params.roomsMax = String(fields.rooms.max);
    add({ kind: "rooms", value: fields.rooms }, true);
  }

  let currencyChoice: QueryInterpretation["currencyChoice"];
  if (fields.budget) {
    // The list has a ceiling filter only: "от 50 000$" is shown but not applied.
    const { max, currency } = fields.budget;
    if (max) {
      params.priceMax = majorString(max);
      params.currency = currency;
    }
    add({ kind: "budget", value: fields.budget }, max !== undefined);
  } else {
    const budget = draft.budget.value;
    if (budget && !budget.currency) {
      const { min, max } = budget.amountsMinor;
      const value: Range<number> = {};
      if (min !== undefined) value.min = min / 100;
      if (max !== undefined) value.max = max / 100;
      if (max !== undefined) currencyChoice = { maxMinor: max };
      add({ kind: "amount", value }, false);
    }
  }

  if (fields.area && (fields.area.min !== undefined || fields.area.max !== undefined)) {
    add({ kind: "area", value: fields.area }, false);
  }
  if (fields.floor) add({ kind: "floor", value: fields.floor }, false);
  if (fields.buildingKind) add({ kind: "buildingKind", value: fields.buildingKind }, false);
  if (fields.renovation?.length) add({ kind: "renovation", value: fields.renovation }, false);
  if (fields.mortgage !== undefined) add({ kind: "mortgage", value: fields.mortgage }, false);
  if (fields.extras?.length) add({ kind: "extras", value: fields.extras }, false);

  if (criteria.length === 0) return undefined;
  const interpretation: QueryInterpretation = { draft, criteria, params };
  if (currencyChoice) interpretation.currencyChoice = currencyChoice;
  return interpretation;
}

/** The ceiling of a currency choice as Money in the chosen currency. */
export function choiceAmount(choice: { maxMinor: number }, currency: Currency): Money {
  return { amountMinor: choice.maxMinor, currency };
}

/** Filters for one of the explicit currency choices. */
export function withCurrency(
  params: PropertyFilterParams,
  choice: { maxMinor: number },
  currency: Currency,
): PropertyFilterParams {
  return { ...params, priceMax: majorString(choiceAmount(choice, currency)), currency };
}
