import { describe, expect, it } from "vitest";
import {
  acceptTerms,
  acceptedTerms,
  awaitingResponseFrom,
  canOpenDispute,
  cancelRequest,
  declineRequest,
  diffTerms,
  expireIfOverdue,
  markViewed,
  openDispute,
  presetTerms,
  proposeTerms,
  splitAmount,
  validateTerms,
  type CooperationResult,
} from "./commission";
import { canTransitionCooperation } from "./lifecycle";
import { money } from "./money";
import type { CommissionTerms, CooperationRequest } from "./types";

const BUYER_AGENT = "agent-buyer";
const LISTING_AGENT = "agent-listing";
const T0 = "2026-09-30T06:00:00.000Z";
const T1 = "2026-09-30T07:00:00.000Z";
const T2 = "2026-09-30T08:00:00.000Z";

function draft(overrides: Partial<CooperationRequest> = {}): CooperationRequest {
  return {
    id: "coop-1",
    listingId: "listing-1",
    fromAgentId: BUYER_AGENT,
    toAgentId: LISTING_AGENT,
    status: "draft",
    versions: [],
    respondBy: "2026-10-02T13:00:00.000Z",
    disclosure: "masked",
    createdAt: T0,
    ...overrides,
  };
}

/** Deep-freezes a request so any in-place mutation throws in strict mode. */
function frozen(request: CooperationRequest): CooperationRequest {
  request.versions.forEach((version) => Object.freeze(version.terms));
  request.versions.forEach((version) => Object.freeze(version));
  Object.freeze(request.versions);
  return Object.freeze(request);
}

function value(result: CooperationResult): CooperationRequest {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error}`);
  return result.value;
}

/** Buyer's agent sends 50/50, the listing agent counters with 70/30. */
function negotiated(): CooperationRequest {
  const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
  return value(proposeTerms(sent, presetTerms("70/30", "USD"), LISTING_AGENT, T1, "Эксклюзив"));
}

describe("presetTerms", () => {
  it("builds explicit terms with the larger share on the listing side by default (§41 D2)", () => {
    expect(presetTerms("70/30", "USD")).toEqual({
      preset: "70/30",
      listingSidePercent: 70,
      buyerSidePercent: 30,
      basis: "gross_commission",
      currency: "USD",
      payoutCondition: "on_deal_closing",
    });
    expect(presetTerms("80/20", "UZS")).toMatchObject({ listingSidePercent: 80, buyerSidePercent: 20 });
    expect(presetTerms("50/50", "USD")).toMatchObject({ listingSidePercent: 50, buyerSidePercent: 50 });
  });

  it("lets every preset be flipped towards the buyer side", () => {
    expect(presetTerms("70/30", "USD", { largerShare: "buyer" })).toMatchObject({
      listingSidePercent: 30,
      buyerSidePercent: 70,
    });
    expect(presetTerms("80/20", "USD", { largerShare: "buyer" })).toMatchObject({
      listingSidePercent: 20,
      buyerSidePercent: 80,
    });
  });

  it("starts custom at 50/50 and derives the other side from a single override", () => {
    expect(presetTerms("custom", "USD")).toMatchObject({ listingSidePercent: 50, buyerSidePercent: 50 });
    expect(presetTerms("custom", "USD", { listingSidePercent: 62.5 })).toMatchObject({
      listingSidePercent: 62.5,
      buyerSidePercent: 37.5,
    });
    expect(presetTerms("custom", "USD", { buyerSidePercent: 40 })).toMatchObject({
      listingSidePercent: 60,
      buyerSidePercent: 40,
    });
  });

  it("produces valid terms for every preset in both directions", () => {
    for (const preset of ["50/50", "70/30", "80/20", "custom"] as const) {
      for (const largerShare of ["listing", "buyer"] as const) {
        expect(validateTerms(presetTerms(preset, "USD", { largerShare }))).toEqual([]);
      }
    }
  });
});

describe("validateTerms", () => {
  const codes = (terms: CommissionTerms) => validateTerms(terms).map((issue) => issue.code);

  it("requires the two shares to sum to 100", () => {
    expect(codes(presetTerms("custom", "USD", { listingSidePercent: 60, buyerSidePercent: 30 }))).toEqual([
      "percent_sum",
    ]);
    // Two-decimal percents are summed exactly in basis points.
    expect(codes(presetTerms("custom", "USD", { listingSidePercent: 33.33, buyerSidePercent: 66.67 }))).toEqual([]);
  });

  it("rejects negative and over-precise shares", () => {
    expect(codes(presetTerms("custom", "USD", { listingSidePercent: 110 }))).toEqual(["negative_percent"]);
    expect(codes(presetTerms("custom", "USD", { listingSidePercent: 33.333 }))).toEqual([
      "percent_precision",
      "percent_precision",
    ]);
  });

  it("flags a named preset whose numbers were changed", () => {
    expect(codes(presetTerms("70/30", "USD", { listingSidePercent: 65 }))).toEqual(["preset_mismatch"]);
  });

  it("checks the fixed amount basis", () => {
    expect(codes(presetTerms("50/50", "USD", { basis: "fixed_amount" }))).toEqual(["fixed_amount_missing"]);
    expect(
      codes(presetTerms("50/50", "USD", { basis: "fixed_amount", fixedAmount: money(1000, "UZS") })),
    ).toEqual(["fixed_amount_currency"]);
    expect(codes(presetTerms("50/50", "USD", { basis: "fixed_amount", fixedAmount: money(0, "USD") }))).toEqual([
      "fixed_amount_not_positive",
    ]);
    expect(codes(presetTerms("50/50", "USD", { fixedAmount: money(1000, "USD") }))).toEqual(["fixed_amount_unused"]);
  });

  it("requires a note for a custom payout condition", () => {
    expect(codes(presetTerms("50/50", "USD", { payoutCondition: "custom", payoutNote: "  " }))).toEqual([
      "custom_payout_note_missing",
    ]);
    expect(
      codes(presetTerms("50/50", "USD", { payoutCondition: "custom", payoutNote: "После регистрации в кадастре" })),
    ).toEqual([]);
  });

  it("names the field for each issue", () => {
    expect(validateTerms(presetTerms("50/50", "USD", { basis: "fixed_amount" }))).toEqual([
      { code: "fixed_amount_missing", field: "fixedAmount" },
    ]);
  });
});

describe("splitAmount", () => {
  it("splits the gross commission by role", () => {
    const split = splitAmount(presetTerms("70/30", "USD"), money(3000, "USD"));
    expect(split.listingSide).toEqual({ amountMinor: 210_000, currency: "USD" });
    expect(split.buyerSide).toEqual({ amountMinor: 90_000, currency: "USD" });
  });

  it("gives an exact-half remainder to the listing side", () => {
    const split = splitAmount(presetTerms("50/50", "USD"), { amountMinor: 100_001, currency: "USD" });
    expect(split.listingSide.amountMinor).toBe(50_001);
    expect(split.buyerSide.amountMinor).toBe(50_000);
  });

  it("rounds each side to the nearest minor unit", () => {
    const terms = presetTerms("custom", "USD", { listingSidePercent: 33.33 });
    const split = splitAmount(terms, { amountMinor: 100, currency: "USD" });
    expect(split.listingSide.amountMinor).toBe(33); // 33.33 → 33
    expect(split.buyerSide.amountMinor).toBe(67); // 66.67 → 67
  });

  it("always sums to the basis, even for very large UZS amounts", () => {
    const percents = [0, 0.01, 12.5, 33.33, 50, 62.55, 70, 80, 99.99, 100];
    const amounts = [0, 1, 7, 99, 100_001, 123_456_789, Number.MAX_SAFE_INTEGER];
    for (const listingSidePercent of percents) {
      const terms = presetTerms("custom", "UZS", { listingSidePercent });
      for (const amountMinor of amounts) {
        const { listingSide, buyerSide } = splitAmount(terms, { amountMinor, currency: "UZS" });
        expect(BigInt(listingSide.amountMinor) + BigInt(buyerSide.amountMinor)).toBe(BigInt(amountMinor));
        expect(Number.isSafeInteger(listingSide.amountMinor)).toBe(true);
        expect(listingSide.amountMinor).toBeGreaterThanOrEqual(0);
        expect(buyerSide.amountMinor).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("splits the fixed amount when the basis is fixed_amount", () => {
    const terms = presetTerms("80/20", "USD", { basis: "fixed_amount", fixedAmount: money(1500, "USD") });
    const split = splitAmount(terms, money(99_999, "USD"));
    expect(split.listingSide.amountMinor).toBe(120_000);
    expect(split.buyerSide.amountMinor).toBe(30_000);
    expect(splitAmount(terms)).toEqual(split);
  });

  it("refuses invalid terms, missing gross and currency mismatches", () => {
    expect(() => splitAmount(presetTerms("custom", "USD", { listingSidePercent: 60, buyerSidePercent: 30 }), money(1, "USD"))).toThrow(
      /percent_sum/,
    );
    expect(() => splitAmount(presetTerms("50/50", "USD"))).toThrow(TypeError);
    expect(() => splitAmount(presetTerms("50/50", "USD"), money(1000, "UZS"))).toThrow(/Currency mismatch/);
    expect(() => splitAmount(presetTerms("50/50", "USD"), money(-1, "USD"))).toThrow(RangeError);
  });
});

describe("diffTerms", () => {
  it("lists changed fields in a stable order", () => {
    expect(diffTerms(presetTerms("50/50", "USD"), presetTerms("50/50", "USD"))).toEqual([]);
    expect(diffTerms(presetTerms("50/50", "USD"), presetTerms("70/30", "USD"))).toEqual([
      "preset",
      "listingSidePercent",
      "buyerSidePercent",
    ]);
    expect(
      diffTerms(presetTerms("50/50", "USD"), presetTerms("50/50", "USD", { payoutCondition: "on_act_signed" })),
    ).toEqual(["payoutCondition"]);
  });

  it("ignores provenance and empty notes", () => {
    const a = presetTerms("50/50", "USD", { basis: "fixed_amount", fixedAmount: money(1000, "USD", "1000$") });
    const b = presetTerms("50/50", "USD", { basis: "fixed_amount", fixedAmount: money("1000.00", "USD") });
    expect(diffTerms(a, b)).toEqual([]);
    expect(diffTerms(presetTerms("50/50", "USD"), presetTerms("50/50", "USD", { payoutNote: "" }))).toEqual([]);
    expect(
      diffTerms(a, presetTerms("50/50", "USD", { basis: "fixed_amount", fixedAmount: money(1200, "USD") })),
    ).toEqual(["fixedAmount"]);
  });
});

describe("proposeTerms", () => {
  it("sends the first version and keeps contacts masked", () => {
    const request = frozen(draft());
    const result = proposeTerms(request, presetTerms("50/50", "USD"), BUYER_AGENT, T0, "  Мой клиент готов  ");
    const sent = value(result);
    expect(sent.status).toBe("sent");
    expect(sent.disclosure).toBe("masked");
    expect(sent.versions).toEqual([
      { version: 1, terms: presetTerms("50/50", "USD"), proposedById: BUYER_AGENT, proposedAt: T0, note: "Мой клиент готов" },
    ]);
    expect(result.ok && result.event).toMatchObject({ action: "terms_proposed", version: 1, actorId: BUYER_AGENT });
    // The original request is untouched.
    expect(request.status).toBe("draft");
    expect(request.versions).toHaveLength(0);
  });

  it("appends a counter-proposal without rewriting history", () => {
    const sent = frozen(value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0)));
    const result = proposeTerms(sent, presetTerms("70/30", "USD"), LISTING_AGENT, T1);
    const countered = value(result);
    expect(countered.status).toBe("negotiation");
    expect(countered.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(countered.versions[0]).toBe(sent.versions[0]);
    expect(result.ok && result.event.changed).toEqual(["preset", "listingSidePercent", "buyerSidePercent"]);
  });

  it("rejects a counter-proposal that changes nothing", () => {
    const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
    expect(proposeTerms(sent, presetTerms("50/50", "USD"), LISTING_AGENT, T1)).toEqual({
      ok: false,
      error: "no_changes",
    });
  });

  it("returns validation issues instead of throwing", () => {
    const bad = presetTerms("custom", "USD", { listingSidePercent: 60, buyerSidePercent: 30 });
    expect(proposeTerms(draft(), bad, BUYER_AGENT, T0)).toEqual({
      ok: false,
      error: "invalid_terms",
      issues: [{ code: "percent_sum", field: "buyerSidePercent" }],
    });
  });

  it("only lets the parties propose, and only the requester sends a draft", () => {
    expect(proposeTerms(draft(), presetTerms("50/50", "USD"), "someone-else", T0)).toMatchObject({
      error: "not_a_party",
    });
    expect(proposeTerms(draft(), presetTerms("50/50", "USD"), LISTING_AGENT, T0)).toMatchObject({
      error: "not_initiator",
    });
    expect(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, "yesterday")).toMatchObject({
      error: "invalid_time",
    });
  });

  it("locks accepted terms and refuses closed requests", () => {
    const accepted = value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2));
    expect(proposeTerms(accepted, presetTerms("80/20", "USD"), LISTING_AGENT, T2)).toEqual({
      ok: false,
      error: "terms_locked",
    });
    for (const status of ["declined", "expired", "cancelled", "disputed"] as const) {
      expect(proposeTerms({ ...negotiated(), status }, presetTerms("80/20", "USD"), LISTING_AGENT, T2)).toEqual({
        ok: false,
        error: "request_closed",
      });
    }
  });
});

describe("acceptTerms", () => {
  it("lets the counterparty accept the latest version and shares contacts (§18.2)", () => {
    const request = frozen(negotiated());
    const result = acceptTerms(request, 2, BUYER_AGENT, T2);
    const accepted = value(result);
    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedVersion).toBe(2);
    expect(accepted.disclosure).toBe("contacts_shared");
    expect(accepted.versions).toBe(request.versions);
    expect(acceptedTerms(accepted)?.terms).toEqual(presetTerms("70/30", "USD"));
    expect(result.ok && result.event).toEqual({
      action: "terms_accepted",
      requestId: "coop-1",
      actorId: BUYER_AGENT,
      at: T2,
      version: 2,
    });
  });

  it("does not let the proposer accept their own proposal", () => {
    expect(acceptTerms(negotiated(), 2, LISTING_AGENT, T2)).toEqual({ ok: false, error: "own_proposal" });
  });

  it("refuses superseded or unknown versions", () => {
    expect(acceptTerms(negotiated(), 1, LISTING_AGENT, T2)).toEqual({ ok: false, error: "not_latest_version" });
    expect(acceptTerms(negotiated(), 7, BUYER_AGENT, T2)).toEqual({ ok: false, error: "version_not_found" });
  });

  it("refuses outsiders, drafts and second acceptances", () => {
    expect(acceptTerms(negotiated(), 2, "someone-else", T2)).toEqual({ ok: false, error: "not_a_party" });
    expect(acceptTerms(draft(), 1, LISTING_AGENT, T2)).toEqual({ ok: false, error: "not_sent" });
    const accepted = value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2));
    expect(acceptTerms(accepted, 2, BUYER_AGENT, T2)).toEqual({ ok: false, error: "terms_locked" });
  });
});

describe("declineRequest / cancelRequest / markViewed", () => {
  it("lets the counterparty decline and records the reason", () => {
    const result = declineRequest(negotiated(), BUYER_AGENT, T2, "  Клиент передумал ");
    expect(value(result).status).toBe("declined");
    expect(result.ok && result.event).toMatchObject({ action: "request_declined", version: 2, reason: "Клиент передумал" });
    expect(value(result).versions).toHaveLength(2);
    expect(declineRequest(negotiated(), LISTING_AGENT, T2)).toEqual({ ok: false, error: "own_proposal" });
  });

  it("cancels a draft only by the requester, an open request by either party", () => {
    expect(value(cancelRequest(draft(), BUYER_AGENT, T0)).status).toBe("cancelled");
    expect(cancelRequest(draft(), LISTING_AGENT, T0)).toEqual({ ok: false, error: "not_initiator" });
    expect(value(cancelRequest(negotiated(), LISTING_AGENT, T2)).status).toBe("cancelled");
    const accepted = value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2));
    expect(cancelRequest(accepted, BUYER_AGENT, T2)).toEqual({ ok: false, error: "terms_locked" });
  });

  it("marks a sent request viewed by the recipient only", () => {
    const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
    expect(awaitingResponseFrom(sent)).toBe(LISTING_AGENT);
    expect(value(markViewed(sent, LISTING_AGENT, T1)).status).toBe("viewed");
    expect(markViewed(sent, BUYER_AGENT, T1)).toEqual({ ok: false, error: "own_proposal" });
    expect(markViewed(negotiated(), BUYER_AGENT, T1)).toEqual({ ok: false, error: "invalid_status" });
  });
});

describe("counter-proposal deadline", () => {
  it("moves respondBy when a proposal sets a new one", () => {
    const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
    const later = "2026-10-05T13:00:00.000Z";
    const result = proposeTerms(sent, presetTerms("70/30", "USD"), LISTING_AGENT, T1, undefined, later);
    expect(result.ok && result.value.respondBy).toBe(later);
    expect(result.ok && result.event.respondBy).toBe(later);
    // Without one the deadline stays as it was.
    expect(value(proposeTerms(sent, presetTerms("70/30", "USD"), LISTING_AGENT, T1)).respondBy).toBe(sent.respondBy);
  });

  it("refuses a deadline that is not after the proposal", () => {
    const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
    for (const respondBy of [T1, T0, "not a date"]) {
      expect(proposeTerms(sent, presetTerms("70/30", "USD"), LISTING_AGENT, T1, undefined, respondBy)).toEqual({
        ok: false,
        error: "invalid_time",
      });
    }
  });
});

describe("openDispute", () => {
  it("lets either party dispute accepted terms and keeps the history", () => {
    const accepted = frozen(value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2)));
    const result = openDispute(accepted, LISTING_AGENT, T2, "  Выплата не поступила  ");
    expect(result.ok && result.value.status).toBe("disputed");
    expect(result.ok && result.value.versions).toBe(accepted.versions);
    expect(result.ok && result.value.acceptedVersion).toBe(2);
    expect(result.ok && result.event).toEqual({
      action: "dispute_opened",
      requestId: "coop-1",
      actorId: LISTING_AGENT,
      at: T2,
      version: 2,
      reason: "Выплата не поступила",
    });
    expect(openDispute(accepted, BUYER_AGENT, T2, "Условия").ok).toBe(true);
  });

  it("needs a reason, a party and accepted terms", () => {
    const accepted = value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2));
    expect(openDispute(accepted, BUYER_AGENT, T2, "   ")).toEqual({ ok: false, error: "reason_missing" });
    expect(openDispute(accepted, "agent-other", T2, "x")).toEqual({ ok: false, error: "not_a_party" });
    expect(openDispute(draft(), BUYER_AGENT, T2, "x")).toEqual({ ok: false, error: "not_sent" });
    expect(openDispute(negotiated(), BUYER_AGENT, T2, "x")).toEqual({ ok: false, error: "invalid_status" });
    const declined = value(declineRequest(negotiated(), BUYER_AGENT, T2));
    expect(openDispute(declined, BUYER_AGENT, T2, "x")).toEqual({ ok: false, error: "request_closed" });
    expect(canOpenDispute("accepted")).toBe(true);
    expect(canOpenDispute("negotiation")).toBe(false);
  });
});

describe("expireIfOverdue", () => {
  it("expires an unanswered request after respondBy and keeps its versions", () => {
    const request = negotiated();
    expect(expireIfOverdue(request, new Date("2026-10-02T12:59:59.000Z"))).toBeUndefined();
    const expired = expireIfOverdue(request, new Date("2026-10-02T13:00:00.000Z"));
    expect(expired?.value.status).toBe("expired");
    expect(expired?.value.versions).toBe(request.versions);
    expect(expired?.event).toEqual({ action: "request_expired", requestId: "coop-1", at: "2026-10-02T13:00:00.000Z" });
  });

  it("never expires accepted terms", () => {
    const accepted = value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2));
    expect(expireIfOverdue(accepted, new Date("2027-01-01T00:00:00.000Z"))).toBeUndefined();
  });
});

describe("consistency with the cooperation lifecycle", () => {
  it("only produces status changes that the lifecycle map allows", () => {
    const sent = value(proposeTerms(draft(), presetTerms("50/50", "USD"), BUYER_AGENT, T0));
    const viewed = value(markViewed(sent, LISTING_AGENT, T1));
    const steps: [CooperationRequest, CooperationRequest][] = [
      [draft(), sent],
      [sent, viewed],
      [viewed, value(proposeTerms(viewed, presetTerms("70/30", "USD"), LISTING_AGENT, T1))],
      [negotiated(), value(proposeTerms(negotiated(), presetTerms("80/20", "USD"), BUYER_AGENT, T2))],
      [negotiated(), value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2))],
      [sent, value(acceptTerms(sent, 1, LISTING_AGENT, T1))],
      [negotiated(), value(declineRequest(negotiated(), BUYER_AGENT, T2))],
      [draft(), value(cancelRequest(draft(), BUYER_AGENT, T0))],
      [negotiated(), expireIfOverdue(negotiated(), new Date("2026-10-03T00:00:00.000Z"))!.value],
      [
        value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2)),
        value(openDispute(value(acceptTerms(negotiated(), 2, BUYER_AGENT, T2)), LISTING_AGENT, T2, "Выплата")),
      ],
    ];
    for (const [before, after] of steps) {
      expect(canTransitionCooperation(before.status, after.status)).toEqual({ ok: true });
    }
  });
});
