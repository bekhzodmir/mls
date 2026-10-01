import type { RankedMatch } from "@/lib/domain/matching";
import { MIN_APPLY_CONFIDENCE, type RequirementDraft } from "@/lib/domain/requirement-parser";
import { fitsMinor, toMinor } from "@/lib/domain/money";
import type {
  BuildingKind,
  Currency,
  DealType,
  DistrictId,
  ID,
  ISODateTime,
  Money,
  ParsedField,
  PropertyType,
  Range,
  RenovationState,
  Requirement,
  RequirementCriterion,
} from "@/lib/domain/types";

/**
 * State of the Requirement Editor (§14.4, §35.4 steps 1–3) as plain data:
 *
 * - The parser proposes values; confident ones (≥ MIN_APPLY_CONFIDENCE) are
 *   prefilled, weaker ones are offered as suggestions to apply by hand.
 * - Whatever the agent edits becomes an override that later typing in the
 *   sentence no longer replaces.
 * - Budget amounts are prefilled even when the currency is unknown, but the
 *   currency is never guessed (§35.5): searching and saving stay blocked
 *   until the agent picks it.
 * - Numbers are kept as the text the agent typed and parsed only when the
 *   draft Requirement is built, so partial input never jumps around.
 */

export interface RangeInput {
  min: string;
  max: string;
}

export interface FloorInput {
  notFirst: boolean;
  notLast: boolean;
  min: string;
  max: string;
}

export interface RequirementFormValues {
  dealType?: DealType;
  propertyTypes: PropertyType[];
  districts: DistrictId[];
  rooms: RangeInput;
  area: RangeInput;
  /** Major units as typed ("85000"). */
  budgetMin: string;
  budgetMax: string;
  currency?: Currency;
  buildingKind?: BuildingKind;
  renovation: RenovationState[];
  floor: FloorInput;
  mortgage?: boolean;
  extras: string[];
}

export type FormKey = keyof RequirementFormValues;

/** Parsed draft fields, in the order the editor lists them. */
export const draftKeys = [
  "dealType",
  "propertyTypes",
  "districts",
  "rooms",
  "area",
  "budget",
  "buildingKind",
  "renovation",
  "floor",
  "mortgage",
  "extras",
] as const;
export type DraftKey = (typeof draftKeys)[number];

/** Form fields each parsed field fills. */
export const formKeysOf: Record<DraftKey, FormKey[]> = {
  dealType: ["dealType"],
  propertyTypes: ["propertyTypes"],
  districts: ["districts"],
  rooms: ["rooms"],
  area: ["area"],
  budget: ["budgetMin", "budgetMax", "currency"],
  buildingKind: ["buildingKind"],
  renovation: ["renovation"],
  floor: ["floor"],
  mortgage: ["mortgage"],
  extras: ["extras"],
};

export function emptyFormValues(): RequirementFormValues {
  return {
    propertyTypes: [],
    districts: [],
    rooms: { min: "", max: "" },
    area: { min: "", max: "" },
    budgetMin: "",
    budgetMax: "",
    renovation: [],
    floor: { notFirst: false, notLast: false, min: "", max: "" },
    extras: [],
  };
}

/* ------------------------------------------------------------ numbers */

/** Minor units → the major-unit text a person would type ("85000", "85000.5"). */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  if (cents === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(cents).padStart(2, "0").replace(/0$/, "")}`;
}

function numberToInput(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

type Parsed<T> = { ok: true; value?: T } | { ok: false };

const SPACES = /[\s   ]/g;

/** "85 000" → 8 500 000 minor units; "" → no value; "85,000", "abc" or an amount too large to hold → error. */
export function parseAmount(text: string): Parsed<number> {
  const compact = text.replace(SPACES, "");
  if (!compact) return { ok: true };
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(compact)) return { ok: false };
  const amount = compact.replace(",", ".");
  if (!fitsMinor(amount)) return { ok: false };
  const minor = toMinor(amount);
  return minor > 0 ? { ok: true, value: minor } : { ok: false };
}

/** Non-negative number; integers only when `integer` is set (rooms, floors). */
export function parseCount(text: string, integer: boolean): Parsed<number> {
  const compact = text.replace(SPACES, "").replace(",", ".");
  if (!compact) return { ok: true };
  const pattern = integer ? /^\d{1,3}$/ : /^\d{1,6}(?:\.\d{1,2})?$/;
  if (!pattern.test(compact)) return { ok: false };
  return { ok: true, value: Number(compact) };
}

/* ------------------------------------------------------- from the draft */

function hasValue<T>(field: ParsedField<T>): field is ParsedField<T> & { value: T } {
  return field.value !== undefined;
}

/**
 * The form values one parsed field proposes, whatever its confidence. The
 * budget carries its amounts even without a currency; the currency itself
 * is included only when the text named it without contradiction.
 */
export function valuesFromDraftField(
  draft: RequirementDraft,
  key: DraftKey,
  minConfidence: number = MIN_APPLY_CONFIDENCE,
): Partial<RequirementFormValues> {
  switch (key) {
    case "dealType":
      return hasValue(draft.dealType) ? { dealType: draft.dealType.value } : {};
    case "propertyTypes":
      return hasValue(draft.propertyTypes) ? { propertyTypes: [...draft.propertyTypes.value] } : {};
    case "districts":
      return hasValue(draft.districts) ? { districts: [...draft.districts.value] } : {};
    case "rooms":
      return hasValue(draft.rooms)
        ? { rooms: { min: numberToInput(draft.rooms.value.min), max: numberToInput(draft.rooms.value.max) } }
        : {};
    case "area":
      return hasValue(draft.area)
        ? { area: { min: numberToInput(draft.area.value.min), max: numberToInput(draft.area.value.max) } }
        : {};
    case "budget": {
      if (!hasValue(draft.budget)) return {};
      const { amountsMinor, currency } = draft.budget.value;
      const out: Partial<RequirementFormValues> = {
        budgetMin: amountsMinor.min === undefined ? "" : minorToInput(amountsMinor.min),
        budgetMax: amountsMinor.max === undefined ? "" : minorToInput(amountsMinor.max),
      };
      // Two currencies in one sentence lower the confidence: then the agent confirms it.
      if (currency && draft.budget.confidence >= minConfidence) out.currency = currency;
      return out;
    }
    case "buildingKind":
      return hasValue(draft.buildingKind) ? { buildingKind: draft.buildingKind.value } : {};
    case "renovation":
      return hasValue(draft.renovation) ? { renovation: [...draft.renovation.value] } : {};
    case "floor": {
      if (!hasValue(draft.floor)) return {};
      const floor = draft.floor.value;
      return {
        floor: {
          notFirst: Boolean(floor.notFirst),
          notLast: Boolean(floor.notLast),
          min: numberToInput(floor.min),
          max: numberToInput(floor.max),
        },
      };
    }
    case "mortgage":
      return hasValue(draft.mortgage) ? { mortgage: draft.mortgage.value } : {};
    case "extras":
      return hasValue(draft.extras) ? { extras: [...draft.extras.value] } : {};
  }
}

/**
 * Whether a parsed field is applied automatically. The budget amounts are
 * applied whenever they were read — only the currency needs confirmation.
 */
export function isAutoApplied(
  draft: RequirementDraft,
  key: DraftKey,
  minConfidence: number = MIN_APPLY_CONFIDENCE,
): boolean {
  const field = draft[key] as ParsedField<unknown>;
  if (!hasValue(field)) return false;
  return key === "budget" || field.confidence >= minConfidence;
}

/** Form values proposed by the parser: confident fields plus budget amounts. */
export function formValuesFromDraft(
  draft: RequirementDraft,
  minConfidence: number = MIN_APPLY_CONFIDENCE,
): RequirementFormValues {
  const values = emptyFormValues();
  for (const key of draftKeys) {
    if (isAutoApplied(draft, key, minConfidence))
      Object.assign(values, valuesFromDraftField(draft, key, minConfidence));
  }
  return values;
}

/**
 * A stored requirement as form values, for editing it (§14.4). Every field
 * becomes an agent value, so editing the sentence afterwards proposes
 * changes instead of silently replacing what was confirmed.
 */
export function formValuesFromRequirement(requirement: Requirement): RequirementFormValues {
  const { budget, floor } = requirement;
  const values: RequirementFormValues = {
    dealType: requirement.dealType,
    propertyTypes: [...requirement.propertyTypes],
    districts: [...requirement.districts],
    rooms: { min: numberToInput(requirement.rooms.min), max: numberToInput(requirement.rooms.max) },
    area: { min: numberToInput(requirement.area.min), max: numberToInput(requirement.area.max) },
    budgetMin: budget.min ? minorToInput(budget.min.amountMinor) : "",
    budgetMax: budget.max ? minorToInput(budget.max.amountMinor) : "",
    currency: budget.currency,
    renovation: [...(requirement.renovation ?? [])],
    floor: {
      notFirst: Boolean(floor?.notFirst),
      notLast: Boolean(floor?.notLast),
      min: numberToInput(floor?.min),
      max: numberToInput(floor?.max),
    },
    extras: [...requirement.extras],
  };
  if (requirement.buildingKind) values.buildingKind = requirement.buildingKind;
  if (requirement.mortgage !== undefined) values.mortgage = requirement.mortgage;
  return values;
}

/** Parser proposal with the agent's edits on top (an override may be `undefined` on purpose). */
export function mergeFormValues(
  parsed: RequirementFormValues,
  overrides: Partial<RequirementFormValues>,
): RequirementFormValues {
  return { ...parsed, ...overrides };
}

/** The currency hint shown when the text has amounts but no (reliable) currency. */
export function suggestedCurrency(draft: RequirementDraft): Currency | undefined {
  const budget = draft.budget.value;
  if (!budget) return undefined;
  return budget.suggestedCurrency?.value ?? budget.currency;
}

/* ------------------------------------------------------ building a draft */

export type Blocker = "deal_type" | "currency" | "invalid";

export type FieldError = "number" | "range";

export interface FieldErrors {
  rooms?: FieldError;
  area?: FieldError;
  budget?: FieldError;
  floor?: FieldError;
}

export interface DraftContext {
  id: ID;
  clientId: ID;
  agentId: ID;
  organizationId?: ID;
  /** The agent's sentence, stored verbatim (§34.3). */
  text: string;
  nowIso: ISODateTime;
}

export interface DraftBuild {
  /** Everything but the deal type; undefined while a field is invalid or the currency is unconfirmed. */
  base?: Omit<Requirement, "dealType">;
  dealType?: DealType;
  blockers: Blocker[];
  errors: FieldErrors;
  /** Must-haves that constrain something; toggles on empty criteria are dropped. */
  hardCriteria: RequirementCriterion[];
}

function range(
  input: RangeInput,
  parse: (text: string) => Parsed<number>,
): { value: Range<number> } | { error: FieldError } {
  const min = parse(input.min);
  const max = parse(input.max);
  if (!min.ok || !max.ok) return { error: "number" };
  if (min.value !== undefined && max.value !== undefined && min.value > max.value) return { error: "range" };
  const value: Range<number> = {};
  if (min.value !== undefined) value.min = min.value;
  if (max.value !== undefined) value.max = max.value;
  return { value };
}

/** Criteria that currently carry a value in the form. */
export function filledCriteria(values: RequirementFormValues): Set<RequirementCriterion> {
  const filled = new Set<RequirementCriterion>();
  if (values.districts.length > 0) filled.add("location");
  if (values.budgetMin.trim() || values.budgetMax.trim()) filled.add("price");
  if (values.propertyTypes.length > 0) filled.add("property_type");
  if (values.rooms.min.trim() || values.rooms.max.trim()) filled.add("rooms");
  if (values.area.min.trim() || values.area.max.trim()) filled.add("area");
  const { floor } = values;
  if (floor.notFirst || floor.notLast || floor.min.trim() || floor.max.trim()) filled.add("floor");
  if (values.buildingKind) filled.add("building_kind");
  if (values.renovation.length > 0) filled.add("renovation");
  return filled;
}

/** Criteria whose absence makes the search wider (§36.3); never blocking. */
export const qualityCriteria = ["property_type", "location", "price", "rooms", "area"] as const;
export type QualityCriterion = (typeof qualityCriteria)[number];

export function missingCriteria(values: RequirementFormValues): QualityCriterion[] {
  const filled = filledCriteria(values);
  return qualityCriteria.filter((criterion) => !filled.has(criterion));
}

export function buildDraft(
  values: RequirementFormValues,
  hard: readonly RequirementCriterion[],
  context: DraftContext,
): DraftBuild {
  const errors: FieldErrors = {};
  const blockers: Blocker[] = [];

  const rooms = range(values.rooms, (text) => parseCount(text, true));
  if ("error" in rooms) errors.rooms = rooms.error;
  const area = range(values.area, (text) => parseCount(text, false));
  if ("error" in area) errors.area = area.error;
  const floorRange = range({ min: values.floor.min, max: values.floor.max }, (text) => parseCount(text, true));
  if ("error" in floorRange) errors.floor = floorRange.error;
  const budget = range({ min: values.budgetMin, max: values.budgetMax }, parseAmount);
  if ("error" in budget) errors.budget = budget.error;

  const filled = filledCriteria(values);
  const hardCriteria = [...new Set(hard)].filter((criterion) => filled.has(criterion));

  if (!values.dealType) blockers.push("deal_type");
  const hasBudget = "value" in budget && (budget.value.min !== undefined || budget.value.max !== undefined);
  if (hasBudget && !values.currency) blockers.push("currency");
  if (Object.keys(errors).length > 0) blockers.push("invalid");

  const result: DraftBuild = { blockers, errors, hardCriteria };
  if (values.dealType) result.dealType = values.dealType;
  if (!("value" in rooms && "value" in area && "value" in floorRange && "value" in budget)) return result;
  if (blockers.includes("currency")) return result;

  // With no amounts the currency does not affect matching; USD is only the record's default unit.
  const currency: Currency = values.currency ?? "USD";
  const toMoney = (minor: number): Money => ({ amountMinor: minor, currency });
  const budgetValue: Requirement["budget"] = { currency };
  if (budget.value.min !== undefined) budgetValue.min = toMoney(budget.value.min);
  if (budget.value.max !== undefined) budgetValue.max = toMoney(budget.value.max);

  const base: Omit<Requirement, "dealType"> = {
    id: context.id,
    clientId: context.clientId,
    agentId: context.agentId,
    propertyTypes: [...values.propertyTypes],
    city: "tashkent",
    districts: [...values.districts],
    rooms: rooms.value,
    area: area.value,
    budget: budgetValue,
    extras: values.extras.map((extra) => extra.trim()).filter(Boolean),
    hardCriteria,
    status: "active",
    version: 1,
    createdAt: context.nowIso,
    updatedAt: context.nowIso,
  };
  if (context.organizationId) base.organizationId = context.organizationId;
  const floor: NonNullable<Requirement["floor"]> = {};
  if (values.floor.notFirst) floor.notFirst = true;
  if (values.floor.notLast) floor.notLast = true;
  if (floorRange.value.min !== undefined) floor.min = floorRange.value.min;
  if (floorRange.value.max !== undefined) floor.max = floorRange.value.max;
  if (Object.keys(floor).length > 0) base.floor = floor;
  if (values.buildingKind) base.buildingKind = values.buildingKind;
  if (values.renovation.length > 0) base.renovation = [...values.renovation];
  if (values.mortgage !== undefined) base.mortgage = values.mortgage;
  if (context.text.trim()) base.naturalLanguageInput = context.text;
  result.base = base;
  return result;
}

export function withDealType(base: Omit<Requirement, "dealType">, dealType: DealType): Requirement {
  return { ...base, dealType };
}

/* ------------------------------------------------------------- results */

export interface ResultCounts {
  total: number;
  listings: number;
  telegram: number;
  excellent: number;
  good: number;
  possible: number;
}

/** "12: 9 в базе · 3 в Telegram; отличных 2 · хороших 5 · возможных 5". */
export function countResults(matches: readonly RankedMatch[]): ResultCounts {
  const counts: ResultCounts = { total: 0, listings: 0, telegram: 0, excellent: 0, good: 0, possible: 0 };
  for (const match of matches) {
    if (match.band === "hidden") continue;
    counts.total += 1;
    counts[match.candidate.target.kind === "listing" ? "listings" : "telegram"] += 1;
    counts[match.band] += 1;
  }
  return counts;
}
