import type { ListingAccess } from "@/lib/data/views";
import { canTransitionOffer } from "@/lib/domain/lifecycle";
import { toMinor } from "@/lib/domain/money";
import type { Currency, ISODateTime, Money, Offer, OfferVersion } from "@/lib/domain/types";

/**
 * Offer negotiation rules for the Deal Workspace (§8.3 flow 10, §22.11,
 * §35.2 row 10):
 * - every price is a new version with its author, time and expiry; history
 *   is never rewritten, only appended to;
 * - acceptance is an explicit decision of the side whose turn it is;
 * - the agent can act only for a side they represent: always the client
 *   (buyer / tenant), and the owner only on the agent's own listing.
 *
 * Pure: functions return a new Offer (or undefined when the move is not
 * allowed) and never touch the input.
 */

export type OfferSide = OfferVersion["by"];

export function latestOfferVersion(offer: Offer): OfferVersion | undefined {
  return offer.versions[offer.versions.length - 1];
}

/** Open and countered offers still wait for an answer. */
export function isNegotiable(offer: Offer): boolean {
  return offer.status === "open" || offer.status === "countered";
}

/** The side that answers the latest version. */
export function answeringSide(offer: Offer): OfferSide {
  return latestOfferVersion(offer)?.by === "buyer" ? "owner" : "buyer";
}

export function versionExpired(version: OfferVersion, now: Date): boolean {
  return version.expiresAt !== undefined && Date.parse(version.expiresAt) < now.getTime();
}

/**
 * Whether the viewer may record a decision for `side`. The deal agent works
 * for the client; the owner's answer is theirs to record only on their own
 * listing — otherwise it comes through the listing agent.
 */
export function representsSide(side: OfferSide, access: ListingAccess): boolean {
  return side === "buyer" || access === "owner";
}

/** Accepting the latest version: an explicit, final decision. */
export function acceptOffer(offer: Offer): Offer | undefined {
  if (!isNegotiable(offer) || !latestOfferVersion(offer)) return undefined;
  if (!canTransitionOffer(offer.status, "accepted").ok) return undefined;
  return { ...offer, status: "accepted", versions: offer.versions.map((version) => ({ ...version })) };
}

export type CounterError = "not_negotiable" | "wrong_side" | "invalid_amount" | "currency" | "same_amount";

/**
 * Appends a counter-offer by `by` (who must be the answering side). Returns
 * the new offer or the reason it was refused.
 */
export function counterOffer(
  offer: Offer,
  input: { amount: Money; by: OfferSide; at: ISODateTime; note?: string },
): { ok: true; offer: Offer } | { ok: false; error: CounterError } {
  const latest = latestOfferVersion(offer);
  if (!latest || !isNegotiable(offer) || !canTransitionOffer(offer.status, "countered").ok) {
    return { ok: false, error: "not_negotiable" };
  }
  if (input.by !== answeringSide(offer)) return { ok: false, error: "wrong_side" };
  if (!Number.isSafeInteger(input.amount.amountMinor) || input.amount.amountMinor <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (input.amount.currency !== latest.amount.currency) return { ok: false, error: "currency" };
  if (input.amount.amountMinor === latest.amount.amountMinor) return { ok: false, error: "same_amount" };

  const version: OfferVersion = { version: latest.version + 1, amount: { ...input.amount }, by: input.by, at: input.at };
  const note = input.note?.trim();
  if (note) version.note = note;
  return {
    ok: true,
    offer: { ...offer, status: "countered", versions: [...offer.versions.map((v) => ({ ...v })), version] },
  };
}

/**
 * Parses a typed amount in major units ("220 000", "220000,50") into Money.
 * Spaces (including NBSP) are separators; anything else unexpected → undefined.
 */
export function parseAmount(text: string, currency: Currency): Money | undefined {
  const cleaned = text.replace(/[\s  ]/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) return undefined;
  try {
    const amountMinor = toMinor(cleaned);
    return amountMinor > 0 ? { amountMinor, currency } : undefined;
  } catch {
    return undefined;
  }
}
