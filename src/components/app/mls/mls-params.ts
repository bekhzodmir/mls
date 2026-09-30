import type { ListingView } from "@/lib/data/views";
import {
  currencies,
  dealTypes,
  districtIds,
  propertyTypes,
  sourceKinds,
  type BuildingKind,
  type Currency,
  type DealType,
  type DistrictId,
  type ID,
  type ISODateTime,
  type ListingStatus,
  type Money,
  type PropertyType,
  type RenovationState,
  type SourceKind,
} from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { firstParam, type SearchParamsRecord } from "./url";

/**
 * MLS search (§15.2, §36.4). Every filter is URL state and one pure predicate
 * (`matchesMls`) decides membership, so the server list and the live
 * "Показать N" counter in the filter form can never disagree.
 *
 * - Unknown is a value: a listing with an unknown area, floor, year… never
 *   passes a filter on that attribute (§34.3).
 * - Prices are compared only in the chosen currency; other currencies are
 *   excluded, never silently converted (§34.1).
 * - Business status and data quality stay separate dimensions (§36.4):
 *   "verified" means one checked fact — ownership confirmed — not a blanket
 *   badge (§16.4).
 */

export const mlsTabs = ["base", "mine", "requests"] as const;
export type MlsTab = (typeof mlsTabs)[number];

export const roomChoices = [1, 2, 3, 4] as const;
/** 4 means "4 or more". */
export type RoomChoice = (typeof roomChoices)[number];

export const updatedChoices = [1, 3, 7, 30] as const;
export type UpdatedChoice = (typeof updatedChoices)[number];

const renovationStates = [
  "shell",
  "needs_repair",
  "renovated",
  "designer",
] as const satisfies readonly RenovationState[];
const buildingKinds = ["new_building", "secondary"] as const satisfies readonly BuildingKind[];

/** Listings that are over: shown in the shared base only on request. */
export const FINISHED_STATUSES: ReadonlySet<ListingStatus> = new Set(["closed", "archived", "withdrawn", "expired"]);

export interface MlsParams {
  tab: MlsTab;
  q?: string;
  dealType?: DealType;
  propertyType?: PropertyType;
  district?: DistrictId;
  rooms?: RoomChoice;
  /** Major units of `currency`. */
  priceMax?: number;
  /** Currency of the price filters; USD when omitted. */
  currency?: Currency;
  areaMin?: number;
  areaMax?: number;
  floorMin?: number;
  floorMax?: number;
  floorsMax?: number;
  renovation?: RenovationState;
  building?: BuildingKind;
  yearMin?: number;
  /** Major units of `currency` per m². */
  ppsqmMax?: number;
  updated?: UpdatedChoice;
  /** Organization id, or "none" for independent realtors. */
  agency?: ID | "none";
  source?: SourceKind;
  verified?: boolean;
  cadastre?: boolean;
  exclusive?: boolean;
  /** Include closed / withdrawn / expired listings in the shared base. */
  finished?: boolean;
}

/** Keys of the advanced (<details>) block, used for the "выбрано: N" hint. */
export const advancedKeys = [
  "areaMin",
  "areaMax",
  "floorMin",
  "floorMax",
  "floorsMax",
  "renovation",
  "building",
  "yearMin",
  "ppsqmMax",
  "updated",
  "agency",
  "source",
  "verified",
  "cadastre",
  "exclusive",
  "finished",
] as const satisfies readonly (keyof MlsParams)[];

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** A finite, non-negative number with at most `max` digits; commas accepted as decimal marks. */
export function parseAmount(value: string | undefined, max = 1e12): number | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : undefined;
}

function parseInteger(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !/^\d{1,4}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
}

function choice<T extends number>(values: readonly T[], value: number | undefined): T | undefined {
  return value !== undefined && (values as readonly number[]).includes(value) ? (value as T) : undefined;
}

function flag(value: string | undefined): boolean | undefined {
  return value === "1" || value === "on" || value === "true" ? true : undefined;
}

export function parseMlsParams(params: SearchParamsRecord): MlsParams {
  const get = (key: string) => firstParam(params, key);
  const parsed: MlsParams = { tab: oneOf(mlsTabs, get("tab")) ?? "base" };

  const entries: Partial<MlsParams> = {
    q: get("q")?.slice(0, 120),
    dealType: oneOf(dealTypes, get("dealType")),
    propertyType: oneOf(propertyTypes, get("propertyType")),
    district: oneOf(districtIds, get("district")),
    rooms: choice(roomChoices, parseInteger(get("rooms"), 1, 4)),
    priceMax: parseAmount(get("priceMax")),
    currency: oneOf(currencies, get("currency")),
    areaMin: parseAmount(get("areaMin"), 100_000),
    areaMax: parseAmount(get("areaMax"), 100_000),
    floorMin: parseInteger(get("floorMin"), 1, 200),
    floorMax: parseInteger(get("floorMax"), 1, 200),
    floorsMax: parseInteger(get("floorsMax"), 1, 200),
    renovation: oneOf(renovationStates, get("renovation")),
    building: oneOf(buildingKinds, get("building")),
    yearMin: parseInteger(get("yearMin"), 1800, 2100),
    ppsqmMax: parseAmount(get("ppsqmMax")),
    updated: choice(updatedChoices, parseInteger(get("updated"), 1, 30)),
    agency: get("agency")?.slice(0, 64),
    source: oneOf(sourceKinds, get("source")),
    verified: flag(get("verified")),
    cadastre: flag(get("cadastre")),
    exclusive: flag(get("exclusive")),
    finished: flag(get("finished")),
  };
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== "") (parsed as unknown as Record<string, unknown>)[key] = value;
  }
  return parsed;
}

/** Canonical URL: the default tab and empty values are left out. */
export function mlsHref(locale: string, params: Partial<MlsParams> = {}): string {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "base") query.set("tab", params.tab);
  const order: (keyof MlsParams)[] = [
    "q",
    "dealType",
    "propertyType",
    "district",
    "rooms",
    "priceMax",
    "currency",
    ...advancedKeys,
  ];
  for (const key of order) {
    const value = params[key];
    if (value === undefined || value === false || value === "") continue;
    // The currency only matters next to a price filter.
    if (key === "currency" && params.priceMax === undefined && params.ppsqmMax === undefined) continue;
    query.set(key, value === true ? "1" : String(value));
  }
  const search = query.toString();
  return `${appPath(locale, "/mls")}${search ? `?${search}` : ""}`;
}

export function advancedCount(params: MlsParams): number {
  return advancedKeys.filter((key) => params[key] !== undefined).length;
}

export function filterCount(params: MlsParams): number {
  const quick = (["q", "dealType", "propertyType", "district", "rooms", "priceMax"] as const).filter(
    (key) => params[key] !== undefined,
  ).length;
  return quick + advancedCount(params);
}

/* ---------------------------------------------------------------- facets */

/**
 * The filterable attributes of one listing — small and serializable, so the
 * filter form can count results in the browser with the same predicate.
 */
export interface MlsFacet {
  id: ID;
  status: ListingStatus;
  dealType: DealType;
  propertyType: PropertyType;
  district: DistrictId;
  rooms?: number;
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
  renovation?: RenovationState;
  buildingKind?: BuildingKind;
  yearBuilt?: number;
  price: Money;
  updatedAt: ISODateTime;
  organizationId?: ID;
  source: SourceKind;
  exclusive: boolean;
  ownershipConfirmed: boolean;
  cadastreConfirmed: boolean;
}

export function facetOf(view: ListingView): MlsFacet {
  const { listing, property } = view;
  const confirmed = (subject: "ownership" | "cadastre") =>
    listing.verifications.some((item) => item.subject === subject && item.status === "confirmed");
  const facet: MlsFacet = {
    id: listing.id,
    status: listing.status,
    dealType: listing.dealType,
    propertyType: property.propertyType,
    district: property.district,
    price: listing.price,
    updatedAt: listing.updatedAt,
    source: listing.source,
    exclusive: listing.exclusive,
    ownershipConfirmed: confirmed("ownership"),
    cadastreConfirmed: confirmed("cadastre"),
  };
  if (property.rooms !== undefined) facet.rooms = property.rooms;
  if (property.areaTotal !== undefined) facet.areaTotal = property.areaTotal;
  if (property.floor !== undefined) facet.floor = property.floor;
  if (property.floorsTotal !== undefined) facet.floorsTotal = property.floorsTotal;
  if (property.renovation) facet.renovation = property.renovation;
  if (property.buildingKind) facet.buildingKind = property.buildingKind;
  if (property.yearBuilt !== undefined) facet.yearBuilt = property.yearBuilt;
  if (listing.organizationId) facet.organizationId = listing.organizationId;
  return facet;
}

/**
 * Price per m² in the listing currency, rounded to whole units (a
 * comparison figure, not a price); undefined when the area is unknown.
 */
export function pricePerSqm(price: Money, areaTotal: number | undefined): Money | undefined {
  if (!areaTotal || areaTotal <= 0) return undefined;
  return { amountMinor: Math.round(price.amountMinor / areaTotal / 100) * 100, currency: price.currency };
}

const DAY_MS = 86_400_000;
const toMinor = (major: number) => Math.round(major * 100);

/** The single predicate behind the list and the live counter. `tab` scoping happens in the repository. */
export function matchesMls(facet: MlsFacet, params: MlsParams, now: Date): boolean {
  if (params.tab === "base" && !params.finished && FINISHED_STATUSES.has(facet.status)) return false;
  if (params.dealType && facet.dealType !== params.dealType) return false;
  if (params.propertyType && facet.propertyType !== params.propertyType) return false;
  if (params.district && facet.district !== params.district) return false;
  if (params.rooms !== undefined) {
    if (facet.rooms === undefined) return false;
    if (params.rooms === 4 ? facet.rooms < 4 : facet.rooms !== params.rooms) return false;
  }
  const currency = params.currency ?? "USD";
  if (params.priceMax !== undefined) {
    if (facet.price.currency !== currency || facet.price.amountMinor > toMinor(params.priceMax)) return false;
  }
  if (params.ppsqmMax !== undefined) {
    const perSqm = pricePerSqm(facet.price, facet.areaTotal);
    if (!perSqm || perSqm.currency !== currency || perSqm.amountMinor > toMinor(params.ppsqmMax)) return false;
  }
  if (params.areaMin !== undefined && (facet.areaTotal === undefined || facet.areaTotal < params.areaMin)) return false;
  if (params.areaMax !== undefined && (facet.areaTotal === undefined || facet.areaTotal > params.areaMax)) return false;
  if (params.floorMin !== undefined && (facet.floor === undefined || facet.floor < params.floorMin)) return false;
  if (params.floorMax !== undefined && (facet.floor === undefined || facet.floor > params.floorMax)) return false;
  if (params.floorsMax !== undefined && (facet.floorsTotal === undefined || facet.floorsTotal > params.floorsMax)) {
    return false;
  }
  if (params.renovation && facet.renovation !== params.renovation) return false;
  if (params.building && facet.buildingKind !== params.building) return false;
  if (params.yearMin !== undefined && (facet.yearBuilt === undefined || facet.yearBuilt < params.yearMin)) return false;
  if (params.updated !== undefined) {
    if (now.getTime() - new Date(facet.updatedAt).getTime() > params.updated * DAY_MS) return false;
  }
  if (params.agency !== undefined) {
    if (params.agency === "none" ? facet.organizationId !== undefined : facet.organizationId !== params.agency) {
      return false;
    }
  }
  if (params.source && facet.source !== params.source) return false;
  if (params.verified && !facet.ownershipConfirmed) return false;
  if (params.cadastre && !facet.cadastreConfirmed) return false;
  if (params.exclusive && !facet.exclusive) return false;
  return true;
}

export function filterMls(views: readonly ListingView[], params: MlsParams, now: Date): ListingView[] {
  return views.filter((view) => matchesMls(facetOf(view), params, now));
}

/** Agencies present in the result set, for the agency select; sorted by name. */
export function agencyOptions(views: readonly ListingView[]): { id: ID; name: string }[] {
  const byId = new Map<ID, string>();
  for (const view of views) {
    if (view.organization) byId.set(view.organization.id, view.organization.name);
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
