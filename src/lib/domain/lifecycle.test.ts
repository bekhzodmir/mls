import { describe, expect, it } from "vitest";
import { presetTerms } from "./commission";
import {
  canAdvanceDeal,
  canTransitionCooperation,
  canTransitionListing,
  canTransitionOffer,
  cooperationTransitions,
  dealStageRules,
  listingTransitions,
  mlsReportState,
  nextDealStage,
  offerTransitions,
  type Prerequisite,
  type TransitionCheck,
} from "./lifecycle";
import { money } from "./money";
import {
  dealStages,
  type Deal,
  type DealDocument,
  type DealStage,
  type Listing,
  type VerificationItem,
  type Viewing,
} from "./types";

const NOW = new Date("2026-09-30T06:00:00.000Z"); // Wed 11:00 Tashkent

function doc(type: DealDocument["type"], status: DealDocument["status"] = "uploaded"): DealDocument {
  return { id: `doc-${type}`, type, status, sensitivity: "restricted" };
}

function deal(stage: DealStage, overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    listingId: "listing-1",
    clientId: "client-1",
    agentId: "agent-1",
    stage,
    checklist: [],
    documents: [],
    audit: [],
    createdAt: "2026-09-01T06:00:00.000Z",
    ...overrides,
  };
}

function missing(result: TransitionCheck): Prerequisite[] {
  return result.ok ? [] : result.missing;
}

function codes(result: TransitionCheck): string[] {
  return missing(result).map((item) => item.code);
}

describe("deal stages", () => {
  it("walks the §11.7 order one step at a time", () => {
    expect(nextDealStage("qualification")).toBe("viewing");
    expect(nextDealStage("commission")).toBe("archived");
    expect(nextDealStage("archived")).toBeUndefined();
    expect(Object.keys(dealStageRules)).toEqual([...dealStages]);
  });

  it("refuses skipping or going back and names the available step", () => {
    expect(canAdvanceDeal(deal("viewing"), "under_contract", NOW)).toEqual({
      ok: false,
      missing: [{ code: "transition_not_allowed", params: { from: "viewing", to: "under_contract", next: "offer" } }],
    });
    expect(codes(canAdvanceDeal(deal("closing"), "verification", NOW))).toEqual(["transition_not_allowed"]);
    expect(missing(canAdvanceDeal(deal("archived"), "archived", NOW))[0].params).toEqual({
      from: "archived",
      to: "archived",
    });
  });

  it("qualification → viewing has no extra prerequisites", () => {
    expect(canAdvanceDeal(deal("qualification"), "viewing", NOW)).toEqual({ ok: true });
  });

  it("→ offer needs a completed viewing when viewings are known", () => {
    const viewing: Viewing = {
      id: "v-1",
      listingId: "listing-1",
      clientId: "client-1",
      agentId: "agent-1",
      startsAt: "2026-09-28T09:00:00.000Z",
      durationMinutes: 30,
      status: "scheduled",
      confirmations: { client: true, ownerOrPartner: true },
    };
    // Without viewing data the rule cannot be checked and does not block.
    expect(canAdvanceDeal(deal("viewing"), "offer", NOW)).toEqual({ ok: true });
    expect(codes(canAdvanceDeal(deal("viewing"), "offer", NOW, { viewings: [viewing] }))).toEqual([
      "viewing_not_completed",
    ]);
    expect(
      canAdvanceDeal(deal("viewing"), "offer", NOW, { viewings: [{ ...viewing, status: "completed" }] }),
    ).toEqual({ ok: true });
    // A completed viewing of another listing does not count.
    expect(
      codes(
        canAdvanceDeal(deal("viewing"), "offer", NOW, {
          viewings: [{ ...viewing, status: "completed", listingId: "listing-2" }],
        }),
      ),
    ).toEqual(["viewing_not_completed"]);
  });

  it("→ negotiation needs an offer on record when offers are known", () => {
    expect(codes(canAdvanceDeal(deal("offer"), "negotiation", NOW, { offers: [] }))).toEqual(["offer_missing"]);
    expect(
      canAdvanceDeal(deal("offer"), "negotiation", NOW, {
        offers: [{ id: "o-1", listingId: "listing-1", clientId: "client-1", status: "open", versions: [] }],
      }),
    ).toEqual({ ok: true });
  });

  it("→ under_contract needs the agreed price", () => {
    expect(codes(canAdvanceDeal(deal("negotiation"), "under_contract", NOW))).toEqual(["agreed_price_missing"]);
    expect(
      canAdvanceDeal(deal("negotiation", { agreedPrice: money(82_000, "USD") }), "under_contract", NOW),
    ).toEqual({ ok: true });
  });

  it("→ verification needs the service contract and the owner's consent (§38.5)", () => {
    expect(missing(canAdvanceDeal(deal("under_contract"), "verification", NOW))).toEqual([
      { code: "document_missing", params: { type: "service_contract" } },
      { code: "owner_consent_missing", params: { status: "missing" } },
    ]);
    expect(
      missing(
        canAdvanceDeal(
          deal("under_contract", { documents: [doc("service_contract", "rejected"), doc("owner_consent")] }),
          "verification",
          NOW,
        ),
      ),
    ).toEqual([{ code: "document_rejected", params: { type: "service_contract" } }]);
    expect(
      canAdvanceDeal(
        // A rejected copy is fine once a newer upload exists.
        deal("under_contract", {
          documents: [doc("service_contract", "rejected"), doc("service_contract", "verified"), doc("owner_consent")],
        }),
        "verification",
        NOW,
      ),
    ).toEqual({ ok: true });
  });

  it("→ closing lists every open required checklist item and unverified title document", () => {
    const withProblem = listing({ verifications: [verificationItem("encumbrance", "problem")] });
    const result = canAdvanceDeal(
      deal("verification", {
        checklist: [
          { id: "c1", labelKey: "check_passport", required: true },
          { id: "c2", labelKey: "check_debts", required: true, doneAt: "2026-09-29T06:00:00.000Z" },
          { id: "c3", labelKey: "photos", required: false },
          { id: "c4", labelKey: "check_encumbrance", required: true },
        ],
        documents: [doc("service_contract"), doc("owner_consent"), doc("ownership_certificate")],
      }),
      "closing",
      NOW,
      { listing: withProblem },
    );
    expect(missing(result)).toEqual([
      { code: "checklist_required_open", params: { labelKey: "check_passport" } },
      { code: "checklist_required_open", params: { labelKey: "check_encumbrance" } },
      { code: "document_unverified", params: { type: "ownership_certificate" } },
      { code: "document_missing", params: { type: "cadastre_extract" } },
      { code: "verification_problem", params: { subject: "encumbrance" } },
    ]);
  });

  it("→ closing passes with a complete file", () => {
    expect(
      canAdvanceDeal(
        deal("verification", {
          checklist: [{ id: "c1", labelKey: "check_passport", required: true, doneAt: "2026-09-29T06:00:00.000Z" }],
          documents: [
            doc("service_contract"),
            doc("owner_consent", "verified"),
            doc("ownership_certificate", "verified"),
            doc("cadastre_extract", "verified"),
          ],
        }),
        "closing",
        NOW,
      ),
    ).toEqual({ ok: true });
  });

  it("→ act needs the sale agreement; → commission needs the signed act", () => {
    expect(missing(canAdvanceDeal(deal("closing"), "act", NOW))).toEqual([
      { code: "document_missing", params: { type: "sale_agreement" } },
    ]);
    expect(codes(canAdvanceDeal(deal("act"), "commission", NOW))).toEqual(["act_not_signed", "document_missing"]);
    expect(
      canAdvanceDeal(
        deal("act", { actSignedAt: "2026-09-29T06:00:00.000Z", documents: [doc("completion_act")] }),
        "commission",
        NOW,
      ),
    ).toEqual({ ok: true });
  });

  it("→ commission of a co-broking deal needs valid agreed terms", () => {
    const base = { actSignedAt: "2026-09-29T06:00:00.000Z", documents: [doc("completion_act")], cooperationId: "coop-1" };
    expect(codes(canAdvanceDeal(deal("act", base), "commission", NOW))).toEqual(["commission_terms_missing"]);
    const broken = { ...presetTerms("custom", "USD"), buyerSidePercent: 40 };
    expect(missing(canAdvanceDeal(deal("act", { ...base, commission: { terms: broken } }), "commission", NOW))).toEqual([
      { code: "commission_terms_invalid", params: { issue: "percent_sum" } },
    ]);
    expect(
      canAdvanceDeal(deal("act", { ...base, commission: { terms: presetTerms("70/30", "USD") } }), "commission", NOW),
    ).toEqual({ ok: true });
  });

  it("→ archived needs the MLS report (via MLS) and a recorded payout", () => {
    const viaMls = deal("commission", {
      cooperationId: "coop-1",
      actSignedAt: "2026-09-30T06:00:00.000Z", // Wed → due Mon 5 Oct
      commission: { terms: presetTerms("50/50", "USD") },
    });
    expect(missing(canAdvanceDeal(viaMls, "archived", NOW))).toEqual([
      { code: "mls_report_pending", params: { dueAt: "2026-10-05T18:59:59.999Z", workingDaysLeft: 3 } },
      { code: "payout_not_recorded" },
    ]);
    expect(
      canAdvanceDeal(
        {
          ...viaMls,
          mlsReportedAt: "2026-10-01T06:00:00.000Z",
          commission: { terms: presetTerms("50/50", "USD"), payoutRecordedAt: "2026-10-02T06:00:00.000Z" },
        },
        "archived",
        NOW,
      ),
    ).toEqual({ ok: true });
    // A solo deal is not reported to the MLS but still needs the payout.
    expect(codes(canAdvanceDeal(deal("commission"), "archived", NOW))).toEqual(["payout_not_recorded"]);
  });

  it("mlsReportState tracks the 3-working-day window", () => {
    expect(mlsReportState(deal("act"), NOW)).toEqual({ state: "not_required" });
    expect(mlsReportState(deal("act", { cooperationId: "c" }), NOW)).toEqual({ state: "awaiting_act" });
    const signed = deal("commission", { cooperationId: "c", actSignedAt: "2026-09-30T06:00:00.000Z" });
    expect(mlsReportState(signed, NOW)).toEqual({
      state: "due",
      dueAt: "2026-10-05T18:59:59.999Z",
      workingDaysLeft: 3,
    });
    expect(mlsReportState(signed, new Date("2026-10-06T06:00:00.000Z"))).toEqual({
      state: "overdue",
      dueAt: "2026-10-05T18:59:59.999Z",
      workingDaysLeft: -1,
    });
    expect(mlsReportState({ ...signed, mlsReportedAt: "2026-10-01T06:00:00.000Z" }, NOW)).toEqual({
      state: "reported",
      reportedAt: "2026-10-01T06:00:00.000Z",
    });
  });
});

function verificationItem(
  subject: VerificationItem["subject"],
  status: VerificationItem["status"],
): VerificationItem {
  return { id: `ver-${subject}`, subject, status, method: "document_review", source: "Демо" };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    propertyId: "property-1",
    agentId: "agent-1",
    dealType: "sale",
    price: money(85_000, "USD"),
    priceHistory: [],
    status: "draft",
    confidentiality: "professional",
    source: "realtor_confirmed",
    exclusive: true,
    verifications: [],
    description: "",
    photoCount: 0,
    publishedAt: "2026-09-20T06:00:00.000Z",
    updatedAt: "2026-09-20T06:00:00.000Z",
    ...overrides,
  };
}

describe("listing transitions (§11.1)", () => {
  it("draft → contract_signed needs a contract", () => {
    expect(codes(canTransitionListing(listing(), "contract_signed", NOW))).toEqual(["contract_missing"]);
    expect(canTransitionListing(listing({ contractId: "k-1" }), "contract_signed", NOW)).toEqual({ ok: true });
    expect(
      missing(
        canTransitionListing(
          listing({ contractId: "k-1", contractExpiresAt: "2026-09-01T00:00:00.000Z" }),
          "contract_signed",
          NOW,
        ),
      ),
    ).toEqual([{ code: "contract_expired", params: { expiredAt: "2026-09-01T00:00:00.000Z" } }]);
  });

  it("refuses shortcuts and suggests the main-path step", () => {
    expect(canTransitionListing(listing(), "active_mls", NOW)).toEqual({
      ok: false,
      missing: [{ code: "transition_not_allowed", params: { from: "draft", to: "active_mls", next: "contract_signed" } }],
    });
  });

  it("verified needs confirmed ownership and consent; unavailable is not confirmed (§16.4)", () => {
    const pending = listing({
      status: "verification_pending",
      contractId: "k-1",
      verifications: [verificationItem("ownership", "unavailable")],
    });
    expect(missing(canTransitionListing(pending, "verified", NOW))).toEqual([
      { code: "verification_missing", params: { subject: "ownership", status: "unavailable" } },
      { code: "owner_consent_missing", params: { status: "none" } },
    ]);
    const confirmed = {
      ...pending,
      verifications: [verificationItem("ownership", "confirmed"), verificationItem("owner_consent", "confirmed")],
    };
    expect(canTransitionListing(confirmed, "verified", NOW)).toEqual({ ok: true });
  });

  it("active_mls re-checks consent, problems, contract and price", () => {
    const verified = listing({
      status: "verified",
      contractId: "k-1",
      verifications: [verificationItem("owner_consent", "confirmed"), verificationItem("ownership", "confirmed")],
    });
    expect(canTransitionListing(verified, "active_mls", NOW)).toEqual({ ok: true });
    expect(
      missing(
        canTransitionListing(
          {
            ...verified,
            price: { amountMinor: 0, currency: "USD" },
            contractExpiresAt: "2026-09-29T00:00:00.000Z",
            verifications: [verificationItem("owner_consent", "pending"), verificationItem("utility_debts", "problem")],
          },
          "active_mls",
          NOW,
        ),
      ),
    ).toEqual([
      { code: "owner_consent_missing", params: { status: "pending" } },
      { code: "verification_problem", params: { subject: "utility_debts" } },
      { code: "contract_expired", params: { expiredAt: "2026-09-29T00:00:00.000Z" } },
      { code: "price_missing" },
    ]);
  });

  it("verification_failed needs a recorded problem", () => {
    const pending = listing({ status: "verification_pending", contractId: "k-1" });
    expect(codes(canTransitionListing(pending, "verification_failed", NOW))).toEqual(["no_verification_problem"]);
    expect(
      canTransitionListing(
        { ...pending, verifications: [verificationItem("ownership", "problem")] },
        "verification_failed",
        NOW,
      ),
    ).toEqual({ ok: true });
  });

  it("expired needs a passed expiry date", () => {
    const active = listing({ status: "active_mls", contractId: "k-1", expiresAt: "2026-10-15T00:00:00.000Z" });
    expect(missing(canTransitionListing(active, "expired", NOW))).toEqual([
      { code: "not_expired_yet", params: { expiresAt: "2026-10-15T00:00:00.000Z" } },
    ]);
    expect(canTransitionListing(active, "expired", new Date("2026-10-15T00:00:00.000Z"))).toEqual({ ok: true });
  });

  it("side outcomes need no extra facts and archived is terminal", () => {
    expect(canTransitionListing(listing({ status: "active_mls" }), "withdrawn", NOW)).toEqual({ ok: true });
    expect(canTransitionListing(listing({ status: "active_mls" }), "disputed", NOW)).toEqual({ ok: true });
    expect(canTransitionListing(listing({ status: "archived" }), "active_mls", NOW)).toEqual({
      ok: false,
      missing: [{ code: "transition_not_allowed", params: { from: "archived", to: "active_mls" } }],
    });
  });

  it("every transition target is a known status", () => {
    const statuses = Object.keys(listingTransitions);
    for (const targets of Object.values(listingTransitions)) {
      for (const target of targets) expect(statuses).toContain(target);
    }
  });
});

describe("cooperation and offer maps", () => {
  it("locks accepted cooperation terms except for a dispute", () => {
    expect(canTransitionCooperation("accepted", "negotiation").ok).toBe(false);
    expect(canTransitionCooperation("accepted", "disputed")).toEqual({ ok: true });
    expect(canTransitionCooperation("negotiation", "negotiation")).toEqual({ ok: true });
    expect(canTransitionCooperation("draft", "accepted")).toEqual({
      ok: false,
      missing: [{ code: "transition_not_allowed", params: { from: "draft", to: "accepted", next: "sent" } }],
    });
    for (const terminal of ["declined", "expired", "cancelled"] as const) {
      expect(cooperationTransitions[terminal]).toEqual([]);
    }
  });

  it("keeps offer acceptance final and allows successive counters", () => {
    expect(canTransitionOffer("countered", "countered")).toEqual({ ok: true });
    expect(canTransitionOffer("open", "accepted")).toEqual({ ok: true });
    expect(canTransitionOffer("accepted", "countered").ok).toBe(false);
    expect(offerTransitions.withdrawn).toEqual([]);
  });
});
