import { describe, expect, it } from "vitest";
import type { OfferView } from "@/lib/data/views";
import { money } from "@/lib/domain/money";
import type { Offer } from "@/lib/domain/types";
import {
  declineOffer,
  defaultExpiry,
  initialNegotiation,
  MAX_RESPONSE_DAYS,
  reduceNegotiation,
  validateCounter,
  validateDecline,
} from "./negotiation";
import { offerCounts, offerHref, offerListHref, parseOfferStatus, priceGap, sortOffers } from "./offer-list";

/** 11:00 in Tashkent on Wednesday 30 September 2026 (the demo clock). */
const NOW = new Date("2026-09-30T06:00:00.000Z");
const AT = NOW.toISOString();
const usd = (amount: number) => money(amount, "USD");

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-x",
    listingId: "lst-x",
    clientId: "cl-x",
    status: "countered",
    versions: [
      { version: 1, amount: usd(215_000), by: "buyer", at: "2026-09-21T07:00:00.000Z" },
      {
        version: 2,
        amount: usd(232_000),
        by: "owner",
        at: "2026-09-23T10:00:00.000Z",
        expiresAt: "2026-10-02T13:00:00.000Z",
        note: "Не ниже $230 000.",
      },
    ],
    ...overrides,
  };
}

describe("offer list", () => {
  it("reads only known statuses from the URL", () => {
    expect(parseOfferStatus({ status: "countered" })).toBe("countered");
    expect(parseOfferStatus({ status: ["accepted", "open"] })).toBe("accepted");
    expect(parseOfferStatus({ status: "nonsense" })).toBeUndefined();
    expect(parseOfferStatus({})).toBeUndefined();
  });

  it("builds list and detail links", () => {
    expect(offerListHref("ru")).toBe("/ru/app/offers");
    expect(offerListHref("uz", "accepted")).toBe("/uz/app/offers?status=accepted");
    expect(offerHref("ru", "offer-01")).toBe("/ru/app/offers/offer-01");
  });

  it("states the gap to the asking price in money, never converting currencies", () => {
    expect(priceGap(usd(225_000), usd(235_000))).toEqual({ kind: "below", amount: usd(10_000) });
    expect(priceGap(usd(240_000), usd(235_000))).toEqual({ kind: "above", amount: usd(5_000) });
    expect(priceGap(usd(235_000), usd(235_000))).toEqual({ kind: "equal" });
    expect(priceGap(money(1_000_000, "UZS"), usd(235_000))).toEqual({ kind: "other_currency" });
  });

  it("puts overdue answers first, then waiting ones, then decided; newest first within a group", () => {
    type Row = Pick<OfferView, "awaitingSide" | "responseOverdue" | "latest" | "offer">;
    const row = (id: string, at: string, awaiting?: "buyer" | "owner", overdue = false): Row => ({
      offer: offer({ id }),
      latest: { version: 1, amount: usd(1), by: "buyer", at },
      awaitingSide: awaiting,
      responseOverdue: overdue,
    });
    const rows = [
      row("decided-new", "2026-09-29T10:00:00.000Z"),
      row("waiting-old", "2026-09-20T10:00:00.000Z", "owner"),
      row("overdue", "2026-09-10T10:00:00.000Z", "buyer", true),
      row("waiting-new", "2026-09-28T10:00:00.000Z", "buyer"),
    ];
    expect(sortOffers(rows).map((item) => item.offer.id)).toEqual(["overdue", "waiting-new", "waiting-old", "decided-new"]);
    expect(offerCounts(rows)).toEqual({ awaiting: 3, overdue: 1 });
  });
});

describe("negotiation demo state", () => {
  it("accepts the latest version explicitly and records who decided", () => {
    const state = reduceNegotiation(initialNegotiation(offer()), { type: "accept", at: AT });
    expect(state.offer.status).toBe("accepted");
    expect(state.offer.versions).toHaveLength(2);
    expect(state.decision).toEqual({ kind: "accepted", side: "buyer", version: 2, at: AT });
    expect(state.notice).toEqual({ kind: "accepted", amount: usd(232_000) });
  });

  it("refuses to accept a version whose response deadline passed", () => {
    const stale = offer({
      versions: [{ version: 1, amount: usd(100_000), by: "buyer", at: "2026-09-01T07:00:00.000Z", expiresAt: "2026-09-05T13:00:00.000Z" }],
      status: "open",
    });
    const initial = initialNegotiation(stale);
    expect(reduceNegotiation(initial, { type: "accept", at: AT })).toBe(initial);
  });

  it("declines with a reason and keeps every version", () => {
    const state = reduceNegotiation(initialNegotiation(offer()), {
      type: "decline",
      reason: "price",
      comment: "  Слишком дорого ",
      at: AT,
    });
    expect(state.offer.status).toBe("declined");
    expect(state.offer.versions.map((version) => version.amount.amountMinor)).toEqual([21_500_000, 23_200_000]);
    expect(state.decision).toMatchObject({ kind: "declined", side: "buyer", version: 2, reason: "price", comment: "Слишком дорого" });
    expect(declineOffer({ ...offer(), status: "accepted" })).toBeUndefined();
  });

  it("appends a counter-offer as a new version with its expiry, never editing the history", () => {
    const before = offer();
    const state = reduceNegotiation(initialNegotiation(before), {
      type: "counter",
      amount: usd(225_000),
      expiresAt: "2026-10-03T13:00:00.000Z",
      note: "Готовы за две недели",
      at: AT,
    });
    expect(state.offer.status).toBe("countered");
    expect(state.offer.versions).toHaveLength(3);
    expect(state.offer.versions[2]).toEqual({
      version: 3,
      amount: usd(225_000),
      by: "buyer",
      at: AT,
      expiresAt: "2026-10-03T13:00:00.000Z",
      note: "Готовы за две недели",
    });
    expect(state.offer.versions.slice(0, 2)).toEqual(before.versions);
    expect(state.demoVersions).toEqual([3]);
    // The input was not touched.
    expect(before.versions).toHaveLength(2);
  });

  it("ignores a counter in another currency or with the same amount", () => {
    const initial = initialNegotiation(offer());
    const base = { type: "counter" as const, expiresAt: "2026-10-03T13:00:00.000Z", at: AT };
    expect(reduceNegotiation(initial, { ...base, amount: money(2_900_000_000, "UZS") })).toBe(initial);
    expect(reduceNegotiation(initial, { ...base, amount: usd(232_000) })).toBe(initial);
  });

  it("resets to the loaded offer", () => {
    const changed = reduceNegotiation(initialNegotiation(offer()), { type: "accept", at: AT });
    const reset = reduceNegotiation(changed, { type: "reset" });
    expect(reset.offer).toEqual(offer());
    expect(reset.decision).toBeUndefined();
    expect(reset.notice).toBeUndefined();
  });
});

describe("counter-offer form", () => {
  const latest = offer().versions[1];
  const draft = { amount: "225 000", currency: "USD" as const, date: "2026-10-02", time: "18:00", note: " ок " };

  it("returns money in minor units and a UTC deadline from Tashkent wall-clock time", () => {
    expect(validateCounter(draft, latest, NOW)).toEqual({
      ok: true,
      amount: usd(225_000),
      expiresAt: "2026-10-02T13:00:00.000Z",
      note: "ок",
    });
  });

  it("reports every problem at once", () => {
    expect(validateCounter({ ...draft, amount: "abc", date: "" }, latest, NOW)).toEqual({
      ok: false,
      errors: { amount: "amount_invalid", expiry: "expiry_invalid" },
    });
    expect(validateCounter({ ...draft, amount: "232000" }, latest, NOW)).toEqual({
      ok: false,
      errors: { amount: "amount_same" },
    });
    expect(validateCounter({ ...draft, currency: "UZS" }, latest, NOW)).toEqual({
      ok: false,
      errors: { currency: "currency_mismatch" },
    });
  });

  it("wants a deadline after now and within the maximum window", () => {
    expect(validateCounter({ ...draft, date: "2026-09-30", time: "10:59" }, latest, NOW)).toMatchObject({
      errors: { expiry: "expiry_past" },
    });
    expect(validateCounter({ ...draft, date: "2026-11-30" }, latest, NOW)).toMatchObject({
      errors: { expiry: "expiry_too_far" },
    });
    expect(MAX_RESPONSE_DAYS).toBe(30);
  });

  it("suggests two Tashkent days ahead at 18:00", () => {
    expect(defaultExpiry(NOW)).toEqual({ date: "2026-10-02", time: "18:00" });
    // 19:30 UTC is 00:30 on 1 October in Tashkent: the Tashkent date counts.
    expect(defaultExpiry(new Date("2026-09-30T19:30:00.000Z"))).toEqual({ date: "2026-10-03", time: "18:00" });
  });
});

describe("decline form", () => {
  it("needs a reason, and words for «other»", () => {
    expect(validateDecline(undefined, "")).toEqual({ ok: false, errors: { reason: "reason_missing" } });
    expect(validateDecline("other", "  ")).toEqual({ ok: false, errors: { comment: "comment_missing" } });
    expect(validateDecline("other", " Передумали ")).toEqual({ ok: true, reason: "other", comment: "Передумали" });
    expect(validateDecline("price", "")).toEqual({ ok: true, reason: "price" });
  });
});
