import { canAdvanceDeal, nextDealStage, type TransitionCheck } from "@/lib/domain/lifecycle";
import type {
  AuditEvent,
  Deal,
  DealDocument,
  DealStage,
  ID,
  ISODateTime,
  Listing,
  Money,
  Offer,
  Viewing,
} from "@/lib/domain/types";
import { acceptOffer, counterOffer, latestOfferVersion, type OfferSide } from "./offers";

/**
 * Local demo state of the Deal Workspace. The repository is read-only, so
 * "advance stage", "accept", "counter" and "upload" change a copy held on
 * the page only — and the UI says so (never pretending a server call
 * happened). The rules are the real ones: advancing runs `canAdvanceDeal`
 * against the current local data, so accepting an offer or uploading a
 * document can unblock the next stage exactly as it would for real.
 *
 * Every local action appends an audit entry marked as demo; nothing is
 * edited or removed (§17.6, §36.3).
 */

export interface DealDemoState {
  deal: Deal;
  offers: Offer[];
  /** Unsaved audit entries created on this page, oldest first. */
  events: AuditEvent[];
  /** The last "go to the next stage" attempt and what it found. */
  lastAttempt?: { from: DealStage; to: DealStage; check: TransitionCheck };
  /** What just happened, for the live status message. */
  notice?: DealDemoNotice;
}

export type DealDemoNotice =
  | { kind: "advanced"; stage: DealStage }
  | { kind: "accepted"; offerId: ID; amount: Money }
  | { kind: "countered"; offerId: ID; version: number; amount: Money }
  | { kind: "uploaded"; documentId: ID; type: DealDocument["type"] };

/** Facts that do not change on the page but feed the stage rules. */
export interface DealDemoContext {
  viewerId: ID;
  /** The frozen app clock, as ISO — the same instant on server and client. */
  nowIso: ISODateTime;
  viewings: Viewing[];
  listing: Listing;
}

export type DealDemoAction =
  | { type: "advance" }
  | { type: "accept"; offerId: ID }
  | { type: "counter"; offerId: ID; amount: Money; by: OfferSide; note?: string }
  | { type: "upload"; documentId: ID };

export function initialDealDemoState(deal: Deal, offers: Offer[]): DealDemoState {
  return { deal: structuredClone(deal), offers: structuredClone(offers), events: [] };
}

function appendEvent(
  state: DealDemoState,
  context: DealDemoContext,
  action: string,
  target: AuditEvent["target"],
  reason?: string,
): AuditEvent[] {
  const event: AuditEvent = {
    id: `demo-${state.deal.id}-${state.events.length + 1}`,
    at: context.nowIso,
    actorId: context.viewerId,
    action,
    target,
  };
  if (reason) event.reason = reason;
  return [...state.events, event];
}

export function reduceDealDemo(
  state: DealDemoState,
  action: DealDemoAction,
  context: DealDemoContext,
): DealDemoState {
  switch (action.type) {
    case "advance": {
      const from = state.deal.stage;
      const to = nextDealStage(from);
      if (!to) return state;
      const check = canAdvanceDeal(state.deal, to, new Date(context.nowIso), {
        viewings: context.viewings,
        offers: state.offers,
        listing: context.listing,
      });
      if (!check.ok) return { ...state, lastAttempt: { from, to, check }, notice: undefined };
      return {
        ...state,
        deal: { ...state.deal, stage: to },
        events: appendEvent(state, context, "deal.stage_changed", { kind: "deal", id: state.deal.id }, `${from} → ${to}`),
        lastAttempt: { from, to, check },
        notice: { kind: "advanced", stage: to },
      };
    }

    case "accept": {
      const offer = state.offers.find((item) => item.id === action.offerId);
      const accepted = offer ? acceptOffer(offer) : undefined;
      const latest = accepted ? latestOfferVersion(accepted) : undefined;
      if (!accepted || !latest) return state;
      return {
        ...state,
        // The accepted amount becomes the agreed price the next stages rely on.
        deal: { ...state.deal, agreedPrice: { ...latest.amount } },
        offers: state.offers.map((item) => (item.id === accepted.id ? accepted : item)),
        events: appendEvent(state, context, "offer.accepted", { kind: "offer", id: accepted.id }),
        lastAttempt: undefined,
        notice: { kind: "accepted", offerId: accepted.id, amount: latest.amount },
      };
    }

    case "counter": {
      const offer = state.offers.find((item) => item.id === action.offerId);
      if (!offer) return state;
      const result = counterOffer(offer, {
        amount: action.amount,
        by: action.by,
        at: context.nowIso,
        note: action.note,
      });
      if (!result.ok) return state;
      const latest = latestOfferVersion(result.offer);
      if (!latest) return state;
      return {
        ...state,
        offers: state.offers.map((item) => (item.id === offer.id ? result.offer : item)),
        events: appendEvent(state, context, "offer.version_added", { kind: "offer", id: offer.id }),
        lastAttempt: undefined,
        notice: { kind: "countered", offerId: offer.id, version: latest.version, amount: latest.amount },
      };
    }

    case "upload": {
      const doc = state.deal.documents.find((item) => item.id === action.documentId);
      if (!doc || (doc.status !== "missing" && doc.status !== "rejected")) return state;
      return {
        ...state,
        deal: {
          ...state.deal,
          documents: state.deal.documents.map((item) =>
            item.id === doc.id ? { ...item, status: "uploaded", uploadedAt: context.nowIso } : item,
          ),
        },
        events: appendEvent(state, context, "document.uploaded", { kind: "document", id: doc.id }),
        lastAttempt: undefined,
        notice: { kind: "uploaded", documentId: doc.id, type: doc.type },
      };
    }
  }
}
