import type { ListingFilter } from "@/lib/data/views";
import {
  currencies,
  dealTypes,
  districtIds,
  propertyTypes,
  sourceKinds,
  type Currency,
  type DealType,
  type DistrictId,
  type FreshnessState,
  type ListingStatus,
  type PropertyType,
  type SourceKind,
} from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { parseAmount } from "./amount";

/**
 * Property search filters as URL state (§15.2, §22.5, §36.4). Filters live in
 * the query string so a search is shareable, server-rendered and survives a
 * reload. Invalid values are dropped rather than guessed.
 *
 * Business status, freshness and source are separate dimensions (§36.4): the
 * UI offers them as three independent controls, never one combined "active".
 *
 * A price ceiling is applied only together with an explicit currency: the
 * repository would otherwise assume USD, and a currency is never guessed
 * (§34.1, §35.5). `pendingPrice` keeps such a ceiling so the screen can ask.
 */

export const listingScopes = ["mine", "agency", "mls", "all"] as const;
export type ListingScope = (typeof listingScopes)[number];

export const propertyListViews = ["list", "districts"] as const;
export type PropertyListView = (typeof propertyListViews)[number];

export const freshnessStates = ["fresh", "normal", "aging", "needs_confirmation", "expired"] as const satisfies
  readonly FreshnessState[];

/** Every listing status, in lifecycle order (§11.1) followed by the side outcomes. */
export const listingStatuses = [
  "draft",
  "contract_signed",
  "verification_pending",
  "verified",
  "active_mls",
  "offer",
  "under_contract",
  "closed",
  "archived",
  "expired",
  "withdrawn",
  "suspended",
  "verification_failed",
  "disputed",
] as const satisfies readonly ListingStatus[];

/** Quick room chips: exact 1, 2, 3 and "4 or more". */
export const roomChoices = [1, 2, 3, 4] as const;
export const ROOMS_OPEN_ENDED_FROM = 4;

/** Upper bound for a plausible room count in a filter. */
const MAX_ROOMS = 20;

export interface PropertyListParams {
  scope: ListingScope;
  view: PropertyListView;
  dealType?: DealType;
  propertyType?: PropertyType;
  district?: DistrictId;
  roomsMin?: number;
  roomsMax?: number;
  /** Price ceiling in major units; applied only with `currency`. */
  priceMax?: number;
  currency?: Currency;
  freshness?: FreshnessState;
  source?: SourceKind;
  status?: ListingStatus;
  q?: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Removable filter groups, in the order they are listed back to the user. */
export const filterKeys = [
  "q",
  "dealType",
  "propertyType",
  "district",
  "rooms",
  "price",
  "currency",
  "status",
  "freshness",
  "source",
] as const;
export type FilterKey = (typeof filterKeys)[number];

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

function roomsValue(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{1,2}$/.test(value)) return undefined;
  const rooms = Number(value);
  return rooms >= 1 && rooms <= MAX_ROOMS ? rooms : undefined;
}

export function parsePropertyListParams(raw: RawSearchParams): PropertyListParams {
  const params: PropertyListParams = {
    scope: oneOf(listingScopes, first(raw.scope)) ?? "all",
    view: oneOf(propertyListViews, first(raw.view)) ?? "list",
  };
  const dealType = oneOf(dealTypes, first(raw.dealType));
  const propertyType = oneOf(propertyTypes, first(raw.propertyType));
  const district = oneOf(districtIds, first(raw.district));
  const freshness = oneOf(freshnessStates, first(raw.freshness));
  const source = oneOf(sourceKinds, first(raw.source));
  const status = oneOf(listingStatuses, first(raw.status));
  const currency = oneOf(currencies, first(raw.currency));
  let roomsMin = roomsValue(first(raw.roomsMin));
  let roomsMax = roomsValue(first(raw.roomsMax));
  // A reversed range is a typo, not an empty result: swap it.
  if (roomsMin !== undefined && roomsMax !== undefined && roomsMin > roomsMax) {
    [roomsMin, roomsMax] = [roomsMax, roomsMin];
  }
  const priceMax = parseAmount(first(raw.priceMax));
  const q = first(raw.q)?.slice(0, 120);

  if (dealType) params.dealType = dealType;
  if (propertyType) params.propertyType = propertyType;
  if (district) params.district = district;
  if (roomsMin !== undefined) params.roomsMin = roomsMin;
  if (roomsMax !== undefined) params.roomsMax = roomsMax;
  if (priceMax !== undefined) params.priceMax = priceMax;
  if (currency) params.currency = currency;
  if (freshness) params.freshness = freshness;
  if (source) params.source = source;
  if (status) params.status = status;
  if (q) params.q = q;
  return params;
}

/** A price ceiling typed without a currency: shown to the user, not applied. */
export function pendingPrice(params: PropertyListParams): number | undefined {
  return params.priceMax !== undefined && !params.currency ? params.priceMax : undefined;
}

/** Repository filter for the parsed URL state. */
export function toListingFilter(params: PropertyListParams): ListingFilter {
  const filter: ListingFilter = { scope: params.scope };
  if (params.dealType) filter.dealType = params.dealType;
  if (params.propertyType) filter.propertyType = params.propertyType;
  if (params.district) filter.district = params.district;
  if (params.roomsMin !== undefined) filter.roomsMin = params.roomsMin;
  if (params.roomsMax !== undefined) filter.roomsMax = params.roomsMax;
  if (params.currency) {
    filter.currency = params.currency;
    if (params.priceMax !== undefined) filter.priceMax = params.priceMax;
  }
  if (params.freshness) filter.freshness = params.freshness;
  if (params.source) filter.source = params.source;
  if (params.status) filter.status = params.status;
  if (params.q) filter.q = params.q;
  return filter;
}

/** Filters currently narrowing the list (scope and view are not filters). */
export function activeFilters(params: PropertyListParams): FilterKey[] {
  const set: Record<FilterKey, boolean> = {
    q: params.q !== undefined,
    dealType: params.dealType !== undefined,
    propertyType: params.propertyType !== undefined,
    district: params.district !== undefined,
    rooms: params.roomsMin !== undefined || params.roomsMax !== undefined,
    // A ceiling without a currency is not applied, so it is not listed as active.
    price: params.priceMax !== undefined && params.currency !== undefined,
    // The currency on its own also narrows the list (only offers priced in it).
    currency: params.currency !== undefined && params.priceMax === undefined,
    status: params.status !== undefined,
    freshness: params.freshness !== undefined,
    source: params.source !== undefined,
  };
  return filterKeys.filter((key) => set[key]);
}

/** The same search without one filter group. */
export function withoutFilter(params: PropertyListParams, key: FilterKey): PropertyListParams {
  const next = { ...params };
  switch (key) {
    case "rooms":
      delete next.roomsMin;
      delete next.roomsMax;
      break;
    case "price":
      // The currency stays meaningful as its own filter only if the user set it alone.
      delete next.priceMax;
      delete next.currency;
      break;
    default:
      delete next[key];
  }
  return next;
}

/** Scope and view survive "reset all": they say where and how, not what. */
export function withoutAllFilters(params: PropertyListParams): PropertyListParams {
  return { scope: params.scope, view: params.view };
}

export function roomsChoiceActive(params: PropertyListParams, rooms: number): boolean {
  if (rooms >= ROOMS_OPEN_ENDED_FROM) {
    return params.roomsMin === rooms && params.roomsMax === undefined;
  }
  return params.roomsMin === rooms && params.roomsMax === rooms;
}

/** Toggles a quick room chip: a second click on the active chip clears the room filter. */
export function withRoomsChoice(params: PropertyListParams, rooms: number): PropertyListParams {
  const next = withoutFilter(params, "rooms");
  if (roomsChoiceActive(params, rooms)) return next;
  next.roomsMin = rooms;
  if (rooms < ROOMS_OPEN_ENDED_FROM) next.roomsMax = rooms;
  return next;
}

/** Query-string pairs in a stable order; defaults (scope=all, view=list) are left out. */
export function propertyListQuery(params: PropertyListParams): [string, string][] {
  const pairs: [string, string | number | undefined][] = [
    ["scope", params.scope === "all" ? undefined : params.scope],
    ["q", params.q],
    ["dealType", params.dealType],
    ["propertyType", params.propertyType],
    ["district", params.district],
    ["roomsMin", params.roomsMin],
    ["roomsMax", params.roomsMax],
    ["priceMax", params.priceMax],
    ["currency", params.currency],
    ["status", params.status],
    ["freshness", params.freshness],
    ["source", params.source],
    ["view", params.view === "list" ? undefined : params.view],
  ];
  return pairs.flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)] as [string, string]]));
}

export function propertyListHref(locale: string, params: PropertyListParams): string {
  const query = new URLSearchParams(propertyListQuery(params)).toString();
  return `${appPath(locale, "/properties")}${query ? `?${query}` : ""}`;
}
