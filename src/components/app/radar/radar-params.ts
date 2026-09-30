import type { TelegramFilter, TelegramListingView } from "@/lib/data/views";
import { dealTypes, districtIds, type DealType, type DistrictId, type TelegramListingStatus } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { firstParam, type SearchParamsRecord } from "../mls/url";

/**
 * Telegram Radar filters live in the URL (§22.8, §36.4) so a filtered view
 * can be shared and is rendered on the server:
 * `/app/radar?district=chilanzar&dealType=sale&status=saved&q=метро`.
 *
 * `status` defaults to "active" — everything except posts the agent hid —
 * so a hidden post leaves the working list but is one tap away.
 */

export const radarStatusFilters = ["active", "new", "saved", "converted", "reported_stale", "hidden"] as const;
export type RadarStatusFilter = (typeof radarStatusFilters)[number];

export interface RadarParams {
  district?: DistrictId;
  dealType?: DealType;
  status: RadarStatusFilter;
  q?: string;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Unknown or malformed values are ignored rather than failing the page. */
export function parseRadarParams(params: SearchParamsRecord): RadarParams {
  const parsed: RadarParams = { status: oneOf(radarStatusFilters, firstParam(params, "status")) ?? "active" };
  const district = oneOf(districtIds, firstParam(params, "district"));
  const dealType = oneOf(dealTypes, firstParam(params, "dealType"));
  const q = firstParam(params, "q")?.slice(0, 120);
  if (district) parsed.district = district;
  if (dealType) parsed.dealType = dealType;
  if (q) parsed.q = q;
  return parsed;
}

/** The repository filter; the "active" pseudo-status is applied by `keepByStatus`. */
export function toTelegramFilter(params: RadarParams): TelegramFilter {
  const filter: TelegramFilter = {};
  if (params.district) filter.district = params.district;
  if (params.dealType) filter.dealType = params.dealType;
  if (params.q) filter.q = params.q;
  if (params.status !== "active") filter.status = params.status as TelegramListingStatus;
  return filter;
}

export function keepByStatus(view: TelegramListingView, status: RadarStatusFilter): boolean {
  return status === "active" ? view.post.status !== "hidden" : view.post.status === status;
}

export function hasRadarFilters(params: RadarParams): boolean {
  return Boolean(params.district || params.dealType || params.q || params.status !== "active");
}

/** Canonical, shareable URL: defaults are left out. */
export function radarHref(locale: string, params: Partial<RadarParams> = {}): string {
  const query = new URLSearchParams();
  if (params.district) query.set("district", params.district);
  if (params.dealType) query.set("dealType", params.dealType);
  if (params.status && params.status !== "active") query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  const search = query.toString();
  return `${appPath(locale, "/radar")}${search ? `?${search}` : ""}`;
}

export function radarPostHref(locale: string, id: string): string {
  return appPath(locale, `/radar/${encodeURIComponent(id)}`);
}

/** "Преобразовать в объект" opens the new-property form prefilled from the post (§35.5). */
export function convertHref(locale: string, id: string): string {
  return `${appPath(locale, "/properties/new")}?${new URLSearchParams({ fromTelegram: id }).toString()}`;
}
