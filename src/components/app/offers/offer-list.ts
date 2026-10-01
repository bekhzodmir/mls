import { oneOf } from "@/components/app/crm/filters";
import type { OfferView } from "@/lib/data/views";
import { subtractMoney } from "@/lib/domain/money";
import type { ID, Money, OfferStatus } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Offers list logic (§21.4 screen 68, §22.11): the status filter in the
 * URL, the order (answers needed first) and the gap between the latest
 * amount and the asking price — in money, never a bare percentage.
 * Pure data in, data out.
 */

export const offerStatuses = [
  "open",
  "countered",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
] as const satisfies readonly OfferStatus[];

type SearchParams = Record<string, string | string[] | undefined>;

/** `?status=` when it names an offer status; anything else means "all". */
export function parseOfferStatus(search: SearchParams): OfferStatus | undefined {
  return oneOf(search.status, offerStatuses);
}

export function offerListHref(locale: string, status?: OfferStatus): string {
  return `${appPath(locale, "/offers")}${status ? `?${new URLSearchParams({ status })}` : ""}`;
}

export function offerHref(locale: string, id: ID): string {
  return appPath(locale, `/offers/${encodeURIComponent(id)}`);
}

export type PriceGap =
  | { kind: "below" | "above"; amount: Money }
  | { kind: "equal" }
  /** The asking price is in another currency: nothing is converted silently. */
  | { kind: "other_currency" };

/** How far an amount is from the asking price, as a positive Money and a direction. */
export function priceGap(amount: Money, asking: Money): PriceGap {
  if (amount.currency !== asking.currency) return { kind: "other_currency" };
  const diff = subtractMoney(asking, amount);
  if (diff.amountMinor === 0) return { kind: "equal" };
  return diff.amountMinor > 0
    ? { kind: "below", amount: diff }
    : { kind: "above", amount: { amountMinor: -diff.amountMinor, currency: diff.currency } };
}

/** 0 = the response deadline passed, 1 = waiting for an answer, 2 = decided. */
export function offerUrgency(view: Pick<OfferView, "awaitingSide" | "responseOverdue">): 0 | 1 | 2 {
  if (view.responseOverdue) return 0;
  return view.awaitingSide ? 1 : 2;
}

/** Answers needed first (overdue, then waiting), then decided; newest version first within a group. */
export function sortOffers<T extends Pick<OfferView, "awaitingSide" | "responseOverdue" | "latest" | "offer">>(
  views: readonly T[],
): T[] {
  return [...views].sort(
    (a, b) =>
      offerUrgency(a) - offerUrgency(b) ||
      b.latest.at.localeCompare(a.latest.at) ||
      a.offer.id.localeCompare(b.offer.id),
  );
}

export function offerCounts(views: readonly Pick<OfferView, "awaitingSide" | "responseOverdue">[]): {
  awaiting: number;
  overdue: number;
} {
  return {
    awaiting: views.filter((view) => view.awaitingSide !== undefined).length,
    overdue: views.filter((view) => view.responseOverdue).length,
  };
}
