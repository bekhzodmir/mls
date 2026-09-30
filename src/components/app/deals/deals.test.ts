import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getDeal, listDeals } from "@/lib/data/repository";
import { VIEWER_AGENT_ID } from "@/lib/data/seed";
import { CHECKLIST_LABEL_KEYS, AUDIT_ACTIONS, type DealDetailView } from "@/lib/data/views";
import deals from "@/i18n/messages/deals";
import { canAdvanceDeal, dealStageRules, type Prerequisite, type PrerequisiteCode } from "@/lib/domain/lifecycle";
import { money } from "@/lib/domain/money";
import { dealStages, type Offer } from "@/lib/domain/types";
import { summarizeCommission } from "./commission-view";
import { initialDealDemoState, reduceDealDemo, type DealDemoContext, type DealDemoState } from "./demo-state";
import { acceptOffer, answeringSide, counterOffer, parseAmount, representsSide, versionExpired } from "./offers";
import { commissionSides, dealParties } from "./parties";
import { dealHref, dealListHref, groupByStage, headlinePrice, parseDealStage, stageSteps } from "./pipeline";
import {
  auditActionText,
  auditReasonText,
  auditTargetText,
  checklistLabel,
  describePrerequisite,
  prerequisiteSection,
  termsIssueText,
} from "./rules-text";

const NOW = now();

async function detail(id: string): Promise<DealDetailView> {
  const view = await getDeal(id);
  if (!view) throw new Error(`missing ${id}`);
  return view;
}

function demoContext(view: DealDetailView): DealDemoContext {
  return {
    viewerId: VIEWER_AGENT_ID,
    nowIso: NOW.toISOString(),
    viewings: view.viewings.map((item) => item.viewing),
    listing: view.listing.listing,
  };
}

describe("pipeline", () => {
  it("parses the stage filter and builds links", () => {
    expect(parseDealStage({ stage: "act" })).toBe("act");
    expect(parseDealStage({ stage: ["closing", "act"] })).toBe("closing");
    expect(parseDealStage({ stage: "won" })).toBeUndefined();
    expect(parseDealStage({})).toBeUndefined();
    expect(dealListHref("ru")).toBe("/ru/app/deals");
    expect(dealListHref("uz", "under_contract")).toBe("/uz/app/deals?stage=under_contract");
    expect(dealHref("ru", "deal-06")).toBe("/ru/app/deals/deal-06");
  });

  it("groups every stage in pipeline order, empty ones included", async () => {
    const views = await listDeals();
    const groups = groupByStage(views);
    expect(groups.map((group) => group.stage)).toEqual([...dealStages]);
    expect(groups.reduce((sum, group) => sum + group.views.length, 0)).toBe(views.length);
    expect(groups.find((group) => group.stage === "act")!.views.map((view) => view.deal.id)).toEqual(["deal-06"]);
    expect(groups.find((group) => group.stage === "qualification")!.views).toEqual([]);
  });

  it("marks stepper states around the current stage", () => {
    const steps = stageSteps("offer");
    expect(steps).toHaveLength(dealStages.length);
    expect(steps.slice(0, 4).map((step) => step.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(steps.filter((step) => step.state === "current")).toHaveLength(1);
    expect(steps[2].position).toBe(3);
  });

  it("labels the headline price as agreed or asking", async () => {
    const views = await listDeals();
    const deal01 = views.find((view) => view.deal.id === "deal-01")!;
    const deal03 = views.find((view) => view.deal.id === "deal-03")!;
    expect(headlinePrice(deal01)).toEqual({ kind: "asking", value: deal01.listing.listing.price });
    expect(headlinePrice(deal03).kind).toBe("agreed");
  });
});

describe("rule texts", () => {
  const allCodes: PrerequisiteCode[] = [
    "transition_not_allowed",
    "viewing_not_completed",
    "offer_missing",
    "agreed_price_missing",
    "document_missing",
    "document_rejected",
    "document_unverified",
    "owner_consent_missing",
    "verification_missing",
    "verification_problem",
    "no_verification_problem",
    "checklist_required_open",
    "act_not_signed",
    "commission_terms_missing",
    "commission_terms_invalid",
    "mls_report_pending",
    "payout_not_recorded",
    "contract_missing",
    "contract_expired",
    "price_missing",
    "not_expired_yet",
  ];

  it("has a sentence for every prerequisite code in both languages", () => {
    for (const locale of ["ru", "uz"] as const) {
      for (const code of allCodes) {
        const text = describePrerequisite(locale, { code });
        expect(text, `${locale} ${code}`).not.toBe(code);
        expect(text).not.toMatch(/\{\w+\}/);
        expect(prerequisiteSection(code)).toBeTruthy();
      }
    }
  });

  it("fills parameters with localized names", () => {
    const cases: [Prerequisite, string][] = [
      [{ code: "transition_not_allowed", params: { from: "offer", to: "act", next: "negotiation" } }, "«Переговоры»"],
      [{ code: "document_missing", params: { type: "cadastre_extract" } }, "Кадастровая выписка"],
      [{ code: "owner_consent_missing", params: { status: "missing" } }, "нет документа"],
      [{ code: "verification_missing", params: { subject: "ownership", status: "unavailable" } }, "не удалось проверить"],
      [{ code: "checklist_required_open", params: { labelKey: "checklist.encumbrance_check" } }, "Проверены запреты"],
      [{ code: "commission_terms_invalid", params: { issue: "percent_sum" } }, "100%"],
      [{ code: "mls_report_pending", params: { dueAt: "2026-10-01T18:59:59.999Z", workingDaysLeft: 1 } }, "1 окт."],
    ];
    for (const [prerequisite, expected] of cases) {
      expect(describePrerequisite("ru", prerequisite)).toContain(expected);
    }
    expect(describePrerequisite("ru", { code: "transition_not_allowed", params: { from: "archived", to: "x" } })).toBe(
      deals.ru.prerequisite.transition_not_allowed_end,
    );
    expect(describePrerequisite("uz", { code: "document_missing", params: { type: "sale_agreement" } })).toContain(
      "Oldi-sotdi shartnomasi",
    );
  });

  it("labels every seeded checklist key and audit action", () => {
    for (const locale of ["ru", "uz"] as const) {
      for (const key of CHECKLIST_LABEL_KEYS) {
        expect(checklistLabel(locale, key)).not.toBe(deals[locale].checklist.unknownItem);
      }
      for (const action of AUDIT_ACTIONS) {
        expect(auditActionText(locale, action)).toBe(deals[locale].audit.actions[action]);
      }
    }
    expect(checklistLabel("ru", "checklist.unknown")).toBe(deals.ru.checklist.unknownItem);
    expect(auditActionText("ru", "deal.merged")).toContain("deal.merged");
    expect(termsIssueText("uz", "fixed_amount_missing")).toBe(deals.uz.termsIssue.fixed_amount_missing);
  });

  it("localizes recorded stage changes and leaves free text alone", () => {
    expect(auditReasonText("ru", "viewing → offer")).toBe("Просмотр → Предложение");
    expect(auditReasonText("uz", "closing → act")).toBe("Yopish → Dalolatnoma");
    expect(auditReasonText("ru", "Сверка данных покупателя")).toBe("Сверка данных покупателя");
    expect(auditReasonText("ru", "foo → bar")).toBe("foo → bar");
    expect(auditTargetText("ru", { kind: "document", id: "doc-1" })).toBe("Документ doc-1");
    expect(auditTargetText("ru", { kind: "mystery", id: "x" })).toBe("Запись x");
  });
});

describe("stage rules on the demo deals", () => {
  it("names the concrete blockers instead of a disabled button", async () => {
    const view = await detail("deal-04");
    const check = canAdvanceDeal(view.deal, "closing", NOW, {
      viewings: view.viewings.map((item) => item.viewing),
      offers: view.offers.map((item) => item.offer),
      listing: view.listing.listing,
    });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    const texts = check.missing.map((item) => describePrerequisite("ru", item));
    expect(texts.join("\n")).toContain("Кадастровая выписка");
    expect(texts.every((text) => !/\{\w+\}/.test(text))).toBe(true);
    // Every rule the engine can emit maps to a section of the workspace.
    expect(Object.keys(dealStageRules)).toEqual([...dealStages]);
  });
});

describe("offers", () => {
  const offer: Offer = {
    id: "o",
    listingId: "l",
    clientId: "c",
    status: "countered",
    versions: [
      { version: 1, amount: money(100_000, "USD"), by: "buyer", at: "2026-09-20T10:00:00.000Z" },
      {
        version: 2,
        amount: money(110_000, "USD"),
        by: "owner",
        at: "2026-09-21T10:00:00.000Z",
        expiresAt: "2026-09-25T10:00:00.000Z",
      },
    ],
  };

  it("knows whose turn it is and who may answer", () => {
    expect(answeringSide(offer)).toBe("buyer");
    expect(representsSide("buyer", "partner_masked")).toBe(true);
    expect(representsSide("owner", "agency")).toBe(false);
    expect(representsSide("owner", "owner")).toBe(true);
    expect(versionExpired(offer.versions[1], NOW)).toBe(true);
    expect(versionExpired(offer.versions[0], NOW)).toBe(false);
  });

  it("appends a counter-offer without touching history", () => {
    const result = counterOffer(offer, { amount: money(105_000, "USD"), by: "buyer", at: NOW.toISOString(), note: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer.versions).toHaveLength(3);
    expect(result.offer.versions[2]).toEqual({
      version: 3,
      amount: { amountMinor: 10_500_000, currency: "USD" },
      by: "buyer",
      at: NOW.toISOString(),
    });
    expect(offer.versions).toHaveLength(2);
    expect(result.offer.versions.slice(0, 2)).toEqual(offer.versions);
  });

  it("refuses counters out of turn, in another currency, equal or not positive", () => {
    const at = NOW.toISOString();
    expect(counterOffer(offer, { amount: money(1, "USD"), by: "owner", at })).toEqual({ ok: false, error: "wrong_side" });
    expect(counterOffer(offer, { amount: money(1, "UZS"), by: "buyer", at })).toEqual({ ok: false, error: "currency" });
    expect(counterOffer(offer, { amount: money(110_000, "USD"), by: "buyer", at })).toEqual({
      ok: false,
      error: "same_amount",
    });
    expect(counterOffer(offer, { amount: money(0, "USD"), by: "buyer", at })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    const accepted = acceptOffer(offer)!;
    expect(accepted.status).toBe("accepted");
    expect(counterOffer(accepted, { amount: money(1, "USD"), by: "owner", at })).toEqual({
      ok: false,
      error: "not_negotiable",
    });
    expect(acceptOffer(accepted)).toBeUndefined();
  });

  it("parses typed amounts exactly", () => {
    expect(parseAmount("220 000", "USD")).toEqual({ amountMinor: 22_000_000, currency: "USD" });
    expect(parseAmount("220 000,5", "USD")).toEqual({ amountMinor: 22_000_050, currency: "USD" });
    expect(parseAmount("1 500 000 000", "UZS")).toEqual({ amountMinor: 150_000_000_000, currency: "UZS" });
    expect(parseAmount("", "USD")).toBeUndefined();
    expect(parseAmount("0", "USD")).toBeUndefined();
    expect(parseAmount("-5", "USD")).toBeUndefined();
    expect(parseAmount("12k", "USD")).toBeUndefined();
  });
});

describe("commission", () => {
  it("splits the gross exactly and keeps accrued apart from paid", async () => {
    const view = await detail("deal-06");
    const summary = summarizeCommission(view.deal)!;
    expect(summary.issues).toEqual([]);
    expect(summary.base).toEqual(money(2_460, "USD"));
    expect(summary.split).toEqual({
      listingSide: { amountMinor: 147_600, currency: "USD" },
      buyerSide: { amountMinor: 98_400, currency: "USD" },
    });
    expect(summary.accrual).toBe("accrued"); // act signed, payout "on act signed"
    expect(summary.paidAt).toBeUndefined(); // accrued is not paid
  });

  it("does not compute amounts for invalid terms or without a gross", async () => {
    const view = await detail("deal-06");
    const commission = view.deal.commission!;
    const broken = summarizeCommission({
      ...view.deal,
      commission: { ...commission, terms: { ...commission.terms, buyerSidePercent: 50 } },
    })!;
    expect(broken.issues.map((issue) => issue.code)).toContain("percent_sum");
    expect(broken.split).toBeUndefined();
    const noGross = summarizeCommission({ ...view.deal, commission: { terms: commission.terms } })!;
    expect(noGross.base).toBeUndefined();
    expect(noGross.split).toBeUndefined();
    const onClosing = { ...commission.terms, payoutCondition: "on_deal_closing" as const };
    expect(summarizeCommission({ stage: "closing", commission: { terms: onClosing } })!.accrual).toBe("not_accrued");
    expect(summarizeCommission({ stage: "act", commission: { terms: onClosing } })!.accrual).toBe("accrued");
    const custom = { ...commission.terms, payoutCondition: "custom" as const, payoutNote: "по договорённости" };
    expect(summarizeCommission({ stage: "archived", commission: { terms: custom } })!.accrual).toBe("manual");
    expect(summarizeCommission({ stage: "act" })).toBeUndefined();
  });
});

describe("parties", () => {
  it("gives every professional an explicit side", async () => {
    const deal06 = await detail("deal-06");
    expect(dealParties(deal06, VIEWER_AGENT_ID).map((party) => [party.agent.id, party.side, party.isViewer])).toEqual([
      ["agent-01", "buyer", true],
      ["agent-04", "listing", false],
    ]);
    expect(commissionSides(deal06)).toMatchObject({ listing: { id: "agent-04" }, buyer: { id: "agent-01" } });
    const deal01 = await detail("deal-01");
    expect(dealParties(deal01, VIEWER_AGENT_ID).map((party) => party.side)).toEqual(["both"]);
  });
});

describe("demo state", () => {
  it("advances only when the real rules pass, and records it", async () => {
    const view = await detail("deal-03"); // under_contract → verification
    const context = demoContext(view);
    let state: DealDemoState = initialDealDemoState(view.deal, view.offers.map((item) => item.offer));
    state = reduceDealDemo(state, { type: "advance" }, context);
    expect(state.deal.stage).toBe("verification");
    expect(state.events).toEqual([
      {
        id: "demo-deal-03-1",
        at: NOW.toISOString(),
        actorId: VIEWER_AGENT_ID,
        action: "deal.stage_changed",
        target: { kind: "deal", id: "deal-03" },
        reason: "under_contract → verification",
      },
    ]);
    // verification → closing is blocked by missing title documents and open checklist items.
    state = reduceDealDemo(state, { type: "advance" }, context);
    expect(state.deal.stage).toBe("verification");
    expect(state.lastAttempt?.check.ok).toBe(false);
    expect(state.events).toHaveLength(1);
    // The seed itself is never modified.
    expect(view.deal.stage).toBe("under_contract");
  });

  it("accepting an offer records the agreed price and unblocks the contract stage", async () => {
    const view = await detail("deal-02"); // negotiation, offer-01 countered by the buyer
    const context = demoContext(view);
    let state = initialDealDemoState(view.deal, view.offers.map((item) => item.offer));
    state = reduceDealDemo(state, { type: "advance" }, context);
    expect(state.lastAttempt?.check).toEqual({ ok: false, missing: [{ code: "agreed_price_missing" }] });
    state = reduceDealDemo(state, { type: "accept", offerId: "offer-01" }, context);
    expect(state.deal.agreedPrice).toEqual({ amountMinor: 22_500_000, currency: "USD" });
    expect(state.offers[0].status).toBe("accepted");
    expect(state.lastAttempt).toBeUndefined();
    state = reduceDealDemo(state, { type: "advance" }, context);
    expect(state.deal.stage).toBe("under_contract");
    expect(state.events.map((event) => event.action)).toEqual(["offer.accepted", "deal.stage_changed"]);
  });

  it("counters and uploads append versions and audit entries", async () => {
    const view = await detail("deal-02");
    const context = demoContext(view);
    let state = initialDealDemoState(view.deal, view.offers.map((item) => item.offer));
    // The buyer made the last move; the viewer holds the owner's side on their own listing.
    state = reduceDealDemo(
      state,
      { type: "counter", offerId: "offer-01", amount: money(229_000, "USD"), by: "owner", note: "Последняя цена" },
      context,
    );
    expect(state.offers[0].versions.map((version) => version.version)).toEqual([1, 2, 3, 4]);
    expect(state.notice).toMatchObject({ kind: "countered", version: 4 });
    // A counter out of turn is ignored.
    const same = reduceDealDemo(state, { type: "counter", offerId: "offer-01", amount: money(1, "USD"), by: "owner" }, context);
    expect(same).toBe(state);
    state = reduceDealDemo(state, { type: "upload", documentId: "doc-deal-02-3" }, context);
    expect(state.deal.documents.find((doc) => doc.id === "doc-deal-02-3")).toMatchObject({
      status: "uploaded",
      uploadedAt: NOW.toISOString(),
    });
    expect(reduceDealDemo(state, { type: "upload", documentId: "doc-deal-02-3" }, context)).toBe(state);
    expect(state.events.map((event) => event.action)).toEqual(["offer.version_added", "document.uploaded"]);
  });
});
