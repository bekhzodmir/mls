import type { EntityRef, ID } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Workspace URLs for records and pre-filtered lists. Every Today block and
 * notification leads to a list with the filter already applied (§36.2), so
 * the filter names here must match what the list screens read from the URL.
 */

const entityPaths: Record<EntityRef["kind"], string> = {
  lead: "/leads",
  client: "/clients",
  // Property screens are keyed by the listing id (Property ≠ Listing).
  listing: "/properties",
  deal: "/deals",
  viewing: "/viewings",
  cooperation: "/mls/cooperation",
  telegram: "/radar",
};

/** Detail page of any record a task or notification can point at. */
export function entityHref(locale: string, ref: EntityRef): string {
  return appPath(locale, `${entityPaths[ref.kind]}/${encodeURIComponent(ref.id)}`);
}

/** Match ids look like `req-03--lst-16` and are safe in a path segment. */
export function matchHref(locale: string, matchId: string): string {
  return appPath(locale, `/matches/${encodeURIComponent(matchId)}`);
}

export function requirementHref(locale: string, requirementId: ID): string {
  return appPath(locale, `/requirements/${encodeURIComponent(requirementId)}`);
}

export type QueryParams = Record<string, string | number | undefined>;

/** `/{locale}/app{path}?a=1&b=2`, skipping empty values and keeping key order. */
export function listHref(locale: string, path: string, params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return `${appPath(locale, path)}${query ? `?${query}` : ""}`;
}
