import {
  acceptOffer,
  answeringSide,
  counterOffer,
  isNegotiable,
  latestOfferVersion,
  parseAmount,
  versionExpired,
  type OfferSide,
} from "@/components/app/deals/offers";
import { addDaysToKey, tashkentInstant, tashkentParts } from "@/components/app/viewings/time";
import { canTransitionOffer } from "@/lib/domain/lifecycle";
import type { Currency, ISODateTime, Money, Offer, OfferVersion } from "@/lib/domain/types";

/**
 * Offer negotiation on the Offer Detail screen (§22.11, §35.2 row 10), as a
 * local demo state. The repository is read-only, so accepting, declining
 * and countering change a copy held on the page — and the screen says so.
 *
 * The rules are the real ones, shared with the Deal Workspace
 * (`@/components/app/deals/offers`): only the side whose turn it is answers;
 * every counter-offer is a new version with its author, time, expiry and
 * note; earlier versions are never edited; acceptance and refusal are final.
 * Pure: every function returns new objects and never touches its input.
 */

/** A counter-offer waits at most this long for an answer (a product setting, not a legal term). */
export const MAX_RESPONSE_DAYS = 30;
/** The suggested deadline: two Tashkent days ahead, end of the working day. */
export const DEFAULT_RESPONSE_DAYS = 2;
export const DEFAULT_RESPONSE_TIME = "18:00";

export const declineReasons = ["price", "terms", "other_option", "changed_plans", "other"] as const;
export type DeclineReason = (typeof declineReasons)[number];

/** The final answer recorded on this page: who decided, on which version, when and why. */
export interface OfferDecision {
  kind: "accepted" | "declined";
  side: OfferSide;
  version: number;
  at: ISODateTime;
  reason?: DeclineReason;
  comment?: string;
}

export type NegotiationNotice =
  | { kind: "accepted"; amount: Money }
  | { kind: "declined"; reason: DeclineReason; comment?: string }
  | { kind: "countered"; version: number; amount: Money; expiresAt: ISODateTime };

export interface NegotiationState {
  /** The offer as loaded; "reset" returns to it. */
  initial: Offer;
  offer: Offer;
  /** Version numbers appended on this page: shown as unsaved demo entries. */
  demoVersions: number[];
  decision?: OfferDecision;
  notice?: NegotiationNotice;
}

export type NegotiationAction =
  | { type: "accept"; at: ISODateTime }
  | { type: "decline"; reason: DeclineReason; comment?: string; at: ISODateTime }
  | { type: "counter"; amount: Money; expiresAt: ISODateTime; note?: string; at: ISODateTime }
  | { type: "reset" };

export function initialNegotiation(offer: Offer): NegotiationState {
  return { initial: structuredClone(offer), offer: structuredClone(offer), demoVersions: [] };
}

/** Refusing the latest version: final, like acceptance; the versions stay as they were. */
export function declineOffer(offer: Offer): Offer | undefined {
  if (!isNegotiable(offer) || !latestOfferVersion(offer)) return undefined;
  if (!canTransitionOffer(offer.status, "declined").ok) return undefined;
  return { ...offer, status: "declined", versions: offer.versions.map((version) => ({ ...version })) };
}

export function reduceNegotiation(state: NegotiationState, action: NegotiationAction): NegotiationState {
  switch (action.type) {
    case "accept": {
      const latest = latestOfferVersion(state.offer);
      // A version whose response deadline passed can no longer be accepted.
      if (!latest || versionExpired(latest, new Date(action.at))) return state;
      const side = answeringSide(state.offer);
      const accepted = acceptOffer(state.offer);
      if (!accepted) return state;
      return {
        ...state,
        offer: accepted,
        decision: { kind: "accepted", side, version: latest.version, at: action.at },
        notice: { kind: "accepted", amount: { ...latest.amount } },
      };
    }

    case "decline": {
      const latest = latestOfferVersion(state.offer);
      const declined = declineOffer(state.offer);
      if (!latest || !declined) return state;
      const decision: OfferDecision = {
        kind: "declined",
        side: answeringSide(state.offer),
        version: latest.version,
        at: action.at,
        reason: action.reason,
      };
      const comment = action.comment?.trim();
      if (comment) decision.comment = comment;
      const notice: NegotiationNotice = { kind: "declined", reason: action.reason };
      if (comment) notice.comment = comment;
      return { ...state, offer: declined, decision, notice };
    }

    case "counter": {
      const result = counterOffer(state.offer, {
        amount: action.amount,
        by: answeringSide(state.offer),
        at: action.at,
        note: action.note,
      });
      if (!result.ok) return state;
      const versions = result.offer.versions;
      const added = { ...versions[versions.length - 1], expiresAt: action.expiresAt };
      return {
        ...state,
        offer: { ...result.offer, versions: [...versions.slice(0, -1), added] },
        demoVersions: [...state.demoVersions, added.version],
        notice: { kind: "countered", version: added.version, amount: added.amount, expiresAt: action.expiresAt },
      };
    }

    case "reset":
      return initialNegotiation(state.initial);
  }
}

/* ----------------------------------------------------------- validation */

export interface CounterDraft {
  /** Typed in major units: "220 000", "220000,50". */
  amount: string;
  currency: Currency;
  /** Tashkent wall-clock date "2026-10-02" and time "18:00". */
  date: string;
  time: string;
  note: string;
}

export type CounterError =
  | "amount_invalid"
  | "amount_same"
  | "currency_mismatch"
  | "expiry_invalid"
  | "expiry_past"
  | "expiry_too_far";

export type CounterErrors = Partial<Record<"amount" | "currency" | "expiry", CounterError>>;

export type CounterCheck =
  | { ok: true; amount: Money; expiresAt: ISODateTime; note?: string }
  | { ok: false; errors: CounterErrors };

const DAY_MS = 86_400_000;

/**
 * Checks a counter-offer form against the latest version: a positive amount
 * in the negotiation's currency (no silent conversion), different from the
 * amount on the table, and a response deadline in the future but within
 * MAX_RESPONSE_DAYS. Every problem is reported at once.
 */
export function validateCounter(draft: CounterDraft, latest: OfferVersion, now: Date): CounterCheck {
  const errors: CounterErrors = {};
  const amount = parseAmount(draft.amount, draft.currency);
  if (!amount) errors.amount = "amount_invalid";
  if (draft.currency !== latest.amount.currency) errors.currency = "currency_mismatch";
  else if (amount && amount.amountMinor === latest.amount.amountMinor) errors.amount = "amount_same";

  const expiresAt = tashkentInstant(draft.date, draft.time);
  if (!expiresAt) errors.expiry = "expiry_invalid";
  else if (Date.parse(expiresAt) <= now.getTime()) errors.expiry = "expiry_past";
  else if (Date.parse(expiresAt) > now.getTime() + MAX_RESPONSE_DAYS * DAY_MS) errors.expiry = "expiry_too_far";

  if (!amount || !expiresAt || Object.keys(errors).length > 0) return { ok: false, errors };
  const note = draft.note.trim();
  return note ? { ok: true, amount, expiresAt, note } : { ok: true, amount, expiresAt };
}

/** The suggested response deadline as form values: DEFAULT_RESPONSE_DAYS Tashkent days ahead at 18:00. */
export function defaultExpiry(now: Date): { date: string; time: string } {
  return { date: addDaysToKey(tashkentParts(now).date, DEFAULT_RESPONSE_DAYS), time: DEFAULT_RESPONSE_TIME };
}

export type DeclineCheck =
  | { ok: true; reason: DeclineReason; comment?: string }
  | { ok: false; errors: { reason?: "reason_missing"; comment?: "comment_missing" } };

/** A refusal needs a reason; "other" needs it in words. */
export function validateDecline(reason: DeclineReason | undefined, comment: string): DeclineCheck {
  const text = comment.trim();
  if (!reason) return { ok: false, errors: { reason: "reason_missing" } };
  if (reason === "other" && !text) return { ok: false, errors: { comment: "comment_missing" } };
  return text ? { ok: true, reason, comment: text } : { ok: true, reason };
}
