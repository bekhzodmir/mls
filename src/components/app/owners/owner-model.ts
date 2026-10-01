import type {
  CallView,
  CommunicationView,
  ContractView,
  ListingView,
  OwnerDetailView,
  PropertyView,
  RightHolderView,
  VerificationQueueItem,
} from "@/lib/data/views";
import type { ID, ISODateTime, Listing, ListingStatus, Money } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Pure read helpers for the owner screens (§14.6, §21.4 #24–25). The owner
 * profile joins the property, its listings, the contracts with their right
 * holders, the consents and the viewer's own touchpoints; everything here
 * works on repository views, so access rules are already applied.
 */

export const OWNER_SCOPES = ["own", "agency"] as const;
export type OwnerScopeFilter = (typeof OWNER_SCOPES)[number];

export function ownerHref(locale: string, id: ID): string {
  return appPath(locale, `/owners/${encodeURIComponent(id)}`);
}

export function contractHref(locale: string, id: ID): string {
  return appPath(locale, `/contracts/${encodeURIComponent(id)}`);
}

export function callHref(locale: string, id: ID): string {
  return appPath(locale, `/calls/${encodeURIComponent(id)}`);
}

/** The communications timeline of the calls screen, filtered to one owner. */
export function callsTimelineHref(locale: string, ownerId: ID): string {
  return `${appPath(locale, "/calls/timeline")}?${new URLSearchParams({ ownerId })}`;
}

/* ----------------------------------------------------------- properties */

export interface OwnerPropertyGroup {
  property: PropertyView;
  /** Listings on the property the viewer may open, newest change first. */
  listings: ListingView[];
  /**
   * The listings were reached through a contract on which the owner is a
   * right holder — the property is registered to someone else.
   */
  viaContract: boolean;
}

/**
 * Each property with its listings (Property ≠ Listing, §10.1). A co-owner is
 * linked to the property only through a contract: the contract's listing is
 * then shown, marked as reached through the contract.
 */
export function propertyGroups(
  detail: Pick<OwnerDetailView, "properties" | "listings" | "contracts">,
): OwnerPropertyGroup[] {
  return detail.properties.map((property) => {
    const own = detail.listings.filter((view) => view.listing.propertyId === property.id);
    if (own.length > 0) return { property, listings: own, viaContract: false };
    const seen = new Set<ID>();
    const viaContract = detail.contracts.flatMap((contract) => {
      const view = contract.listing;
      if (!view || view.listing.propertyId !== property.id || seen.has(view.listing.id)) return [];
      seen.add(view.listing.id);
      return [view];
    });
    return { property, listings: viaContract, viaContract: viaContract.length > 0 };
  });
}

/**
 * Checked facts for the profile: the repository's facts on the owner's own
 * listings, plus — for a co-owner reached through a contract — the facts on
 * that contract's listing taken from the queue (same access rules, same
 * order). A fact is never listed twice.
 */
export function ownerFacts(
  own: readonly VerificationQueueItem[],
  queue: readonly VerificationQueueItem[],
  groups: readonly OwnerPropertyGroup[],
): VerificationQueueItem[] {
  const viaContract = new Set(
    groups.filter((group) => group.viaContract).flatMap((group) => group.listings.map((view) => view.listing.id)),
  );
  const seen = new Set(own.map((entry) => entry.key));
  const extra = queue.filter(
    (entry) => entry.target.kind === "listing" && viaContract.has(entry.target.view.listing.id) && !seen.has(entry.key),
  );
  return [...own, ...extra];
}

/* -------------------------------------------------------- right holders */

export interface ConsentGap {
  contract: ContractView;
  /** Right holders on the contract without a confirmed consent, the owner included when missing. */
  missing: RightHolderView[];
  /** This owner's own consent is the missing one. */
  ownMissing: boolean;
}

/**
 * Contracts that cannot be signed because a right holder has not consented
 * (art. 37, §38.5). Consent of one right holder is never consent of the others.
 */
export function consentGaps(contracts: readonly ContractView[], ownerId: ID): ConsentGap[] {
  return contracts.flatMap((contract) => {
    const missing = contract.rightHolders.filter((holder) => holder.status === "missing");
    if (missing.length === 0) return [];
    return [{ contract, missing, ownMissing: missing.some((holder) => holder.ownerId === ownerId) }];
  });
}

/* ------------------------------------------------------------- timeline */

export type OwnerTimelineEntry =
  | { kind: "communication"; at: ISODateTime; id: ID; view: CommunicationView }
  | { kind: "call"; at: ISODateTime; id: ID; view: CallView };

/**
 * The viewer's touchpoints with the owner, newest first (§36.5). A call that
 * already has a timeline entry is shown once, as that entry with a link to
 * the call; other calls (e.g. missed ones) appear on their own.
 */
export function ownerTimeline(detail: Pick<OwnerDetailView, "communications" | "calls">): OwnerTimelineEntry[] {
  const described = new Set(
    detail.communications.map((view) => view.communication.callId).filter((id): id is ID => id !== undefined),
  );
  const entries: OwnerTimelineEntry[] = [
    ...detail.communications.map((view) => ({
      kind: "communication" as const,
      at: view.communication.at,
      id: view.communication.id,
      view,
    })),
    ...detail.calls
      .filter((view) => !described.has(view.call.id))
      .map((view) => ({ kind: "call" as const, at: view.call.startedAt, id: view.call.id, view })),
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id.localeCompare(b.id)));
}

/* ------------------------------------------------------ listing history */

export type ListingHistoryEvent =
  | { kind: "published"; at: ISODateTime; price: Money }
  | { kind: "price"; at: ISODateTime; price: Money; previous: Money }
  | { kind: "confirmed"; at: ISODateTime }
  | { kind: "status"; at: ISODateTime; status: ListingStatus };

/**
 * What is known about a listing's past, newest first: publication with the
 * first price, each price change, the last confirmation and the status as of
 * the last update. Intermediate status changes are not stored, so none are
 * invented; events after `at` (planned expiries) are left to their sections.
 */
export function listingHistory(
  listing: Pick<Listing, "price" | "priceHistory" | "status" | "publishedAt" | "lastConfirmedAt" | "updatedAt">,
  at: Date,
): ListingHistoryEvent[] {
  const [first, ...changes] = listing.priceHistory;
  const events: ListingHistoryEvent[] = [{ kind: "published", at: listing.publishedAt, price: first?.price ?? listing.price }];
  let previous = first?.price;
  for (const change of changes) {
    if (previous) events.push({ kind: "price", at: change.at, price: change.price, previous });
    previous = change.price;
  }
  if (listing.lastConfirmedAt) events.push({ kind: "confirmed", at: listing.lastConfirmedAt });
  events.push({ kind: "status", at: listing.updatedAt, status: listing.status });
  const limit = at.getTime();
  const order: Record<ListingHistoryEvent["kind"], number> = { status: 0, confirmed: 1, price: 2, published: 3 };
  return events
    .filter((event) => new Date(event.at).getTime() <= limit)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : order[a.kind] - order[b.kind]));
}
