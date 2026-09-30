import type { ClientStatus, LeadStatus } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * URL filters for the CRM lists. Filters live in the query string so a list
 * is shareable and rendered on the server (§36.2: every Today block opens a
 * list with its filter applied). Unknown values are ignored, not errors.
 */

export const leadStatuses = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "converted",
  "lost",
] as const satisfies readonly LeadStatus[];

export const clientStatuses = [
  "new",
  "contacted",
  "selection",
  "viewing",
  "negotiation",
  "deal",
  "deferred",
  "lost",
] as const satisfies readonly ClientStatus[];

type Param = string | string[] | undefined;

export function firstParam(value: Param): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

/** The value when it is one of `allowed`, otherwise undefined. */
export function oneOf<T extends string>(value: Param, allowed: readonly T[]): T | undefined {
  const first = firstParam(value);
  return first !== undefined && (allowed as readonly string[]).includes(first) ? (first as T) : undefined;
}

/** `/{locale}/app{path}?a=1` with empty values dropped and a stable key order. */
export function crmHref(locale: string, path: string, params: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return `${appPath(locale, path)}${query ? `?${query}` : ""}`;
}
