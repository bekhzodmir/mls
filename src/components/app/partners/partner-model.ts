import { isOpen } from "@/components/app/mls/cooperation-model";
import { firstParam, type SearchParamsRecord } from "@/components/app/mls/url";
import { withDemoRole, type DemoRole } from "@/components/app/team/demo-role";
import type { PartnerCooperationView, PartnerDetailView, PartnerListingView } from "@/lib/data/views";
import type { ID } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Pure helpers for the partner screens (§5.6, §15, §18.2): URL state, and how
 * a partner's contacts stand — shared after an accepted cooperation, waiting
 * on an open request, or hidden with the listing a request can start from.
 */

/* --------------------------------------------------------------- params */

export interface PartnerParams {
  q?: string;
}

export const MAX_QUERY_LENGTH = 80;

export function parsePartnerParams(params: SearchParamsRecord): PartnerParams {
  const q = firstParam(params, "q")?.slice(0, MAX_QUERY_LENGTH);
  return q ? { q } : {};
}

export function partnersHref(locale: string, params: PartnerParams = {}, demoRole?: DemoRole): string {
  const query = params.q ? `?${new URLSearchParams({ q: params.q }).toString()}` : "";
  return withDemoRole(`${appPath(locale, "/partners")}${query}`, demoRole);
}

export function partnerHref(locale: string, agentId: ID, demoRole?: DemoRole): string {
  return withDemoRole(appPath(locale, `/partners/${encodeURIComponent(agentId)}`), demoRole);
}

/* ------------------------------------------------------------- contacts */

/** Requests that block a new one on the same listing (§15.5 competing requests): open or accepted. */
function isActive(view: PartnerCooperationView): boolean {
  return isOpen(view.request.status) || view.request.status === "accepted";
}

/** The viewer's open or accepted request per listing id. */
export function activeRequestByListing(history: readonly PartnerCooperationView[]): Map<ID, ID> {
  const byListing = new Map<ID, ID>();
  for (const view of history) {
    if (isActive(view) && !byListing.has(view.request.listingId)) byListing.set(view.request.listingId, view.request.id);
  }
  return byListing;
}

/**
 * The partner's listing a cooperation request can start from: Active in the
 * MLS, still masked for the viewer and without a request of the viewer's on it.
 */
export function cooperationTarget(
  listings: readonly PartnerListingView[],
  history: readonly PartnerCooperationView[],
): PartnerListingView | undefined {
  const taken = activeRequestByListing(history);
  return listings.find(
    (view) => view.listing.status === "active_mls" && view.access === "partner_masked" && !taken.has(view.listing.id),
  );
}

export type ContactState =
  | { kind: "shared"; phone?: string; telegramUsername?: string }
  /** An open request (sent, viewed, negotiation): contacts follow its acceptance. */
  | { kind: "pending"; requestId: ID }
  /** No accepted cooperation: hidden, with the listing to request cooperation on, if any. */
  | { kind: "hidden"; listingId?: ID };

export function contactState(detail: Pick<PartnerDetailView, "agent" | "contactsShared" | "listings" | "cooperationHistory">): ContactState {
  if (detail.contactsShared) {
    const state: ContactState = { kind: "shared" };
    if (detail.agent.phone) state.phone = detail.agent.phone;
    if (detail.agent.telegramUsername) state.telegramUsername = detail.agent.telegramUsername;
    return state;
  }
  const open = detail.cooperationHistory.find((view) => isOpen(view.request.status));
  if (open) return { kind: "pending", requestId: open.request.id };
  const target = cooperationTarget(detail.listings, detail.cooperationHistory);
  return target ? { kind: "hidden", listingId: target.listing.id } : { kind: "hidden" };
}
