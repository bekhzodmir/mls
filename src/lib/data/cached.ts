import { cache } from "react";
import {
  getClient,
  getCooperation,
  getDeal,
  getLead,
  getListing,
  getMatch,
  getRequirement,
  getTelegramListing,
  getViewing,
} from "./repository";

/**
 * Request-scoped record lookups for the workspace detail routes.
 *
 * Each `[id]` route checks that its record exists in a `layout.tsx`, above the
 * route's `loading.tsx` boundary, so an unknown id answers with a real 404
 * before any HTML streams (a `notFound()` inside a Suspense boundary can only
 * produce a "soft" 404 with status 200). The layout, `generateMetadata` and
 * the page all call the same cached function, so the repository is asked once
 * per request.
 */
export const loadLead = cache(getLead);
export const loadClient = cache(getClient);
export const loadRequirement = cache(getRequirement);
export const loadListing = cache(getListing);
export const loadMatch = cache(getMatch);
export const loadTelegramListing = cache(getTelegramListing);
export const loadCooperation = cache(getCooperation);
export const loadViewing = cache(getViewing);
export const loadDeal = cache(getDeal);
