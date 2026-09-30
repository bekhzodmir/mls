import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { listCooperation, listListings, listRequirements } from "@/lib/data/repository";
import { acceptTerms, declineRequest, presetTerms, proposeTerms, validateTerms } from "@/lib/domain/commission";
import type { CommissionTerms } from "@/lib/domain/types";
import {
  activeRequestFor,
  changedFields,
  cooperationListHref,
  deadlineState,
  draftRequest,
  exampleSplit,
  filterCooperation,
  flipShares,
  largerSide,
  parseCooperationParams,
  parseMoneyInput,
  parsePercent,
  partnerViewOf,
  presetFor,
  responseDeadline,
  sampleGross,
  sideOf,
  statusGroup,
  withBasis,
  withCurrency,
  withPayout,
  withPercent,
  withPreset,
} from "./cooperation-model";
import {
  advancedCount,
  facetOf,
  filterMls,
  matchesMls,
  mlsHref,
  parseAmount,
  parseMlsParams,
  pricePerSqm,
} from "./mls-params";

describe("MLS params", () => {
  it("parses quick and advanced filters and ignores junk", () => {
    const params = parseMlsParams({
      tab: "mine",
      dealType: "sale",
      district: "yunusabad",
      rooms: "4",
      priceMax: "120 000",
      currency: "USD",
      areaMin: "60,5",
      updated: "7",
      verified: "1",
      exclusive: "on",
      yearMin: "1650",
      floorMin: "abc",
      source: "telegram",
    });
    expect(params).toEqual({
      tab: "mine",
      dealType: "sale",
      district: "yunusabad",
      rooms: 4,
      priceMax: 120000,
      currency: "USD",
      areaMin: 60.5,
      updated: 7,
      verified: true,
      exclusive: true,
      source: "telegram",
    });
    expect(parseMlsParams({ tab: "public", rooms: "9", updated: "5" })).toEqual({ tab: "base" });
    expect(advancedCount(params)).toBe(5);
  });

  it("round-trips through a canonical URL", () => {
    const params = parseMlsParams({ tab: "base", q: "Ц-5", priceMax: "90000", currency: "UZS", cadastre: "1" });
    const href = mlsHref("ru", params);
    expect(href).toBe("/ru/app/mls?q=%D0%A6-5&priceMax=90000&currency=UZS&cadastre=1");
    const url = new URL(href, "https://binor.test");
    expect(parseMlsParams(Object.fromEntries(url.searchParams))).toEqual(params);
    // A currency without a price filter is noise and is dropped.
    expect(mlsHref("uz", { tab: "requests", currency: "UZS" })).toBe("/uz/app/mls?tab=requests");
  });

  it("parses amounts strictly", () => {
    expect(parseAmount("1 250,50")).toBe(1250.5);
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("1e5")).toBeUndefined();
  });
});

describe("MLS filtering", () => {
  it("never lets an unknown value through a filter on that value", async () => {
    const views = await listListings({ scope: "mls" });
    const at = now();
    const unknownArea = views.map(facetOf).filter((facet) => facet.areaTotal === undefined);
    for (const facet of unknownArea) {
      expect(matchesMls(facet, { tab: "base", areaMin: 1 }, at)).toBe(false);
    }
    const unknownYear = views.map(facetOf).filter((facet) => facet.yearBuilt === undefined);
    expect(unknownYear.length).toBeGreaterThan(0);
    for (const facet of unknownYear) expect(matchesMls(facet, { tab: "base", yearMin: 1900 }, at)).toBe(false);
  });

  it("compares prices only in the chosen currency", async () => {
    const views = await listListings({ scope: "mls" });
    const at = now();
    const usd = filterMls(views, { tab: "base", priceMax: 1_000_000_000, finished: true }, at);
    expect(usd.every((view) => view.listing.price.currency === "USD")).toBe(true);
    const uzs = filterMls(views, { tab: "base", priceMax: 1_000_000_000_000, currency: "UZS", finished: true }, at);
    expect(uzs.length).toBeGreaterThan(0);
    expect(uzs.every((view) => view.listing.price.currency === "UZS")).toBe(true);
  });

  it("hides finished listings from the shared base unless asked, but not from 'mine'", async () => {
    const base = await listListings({ scope: "mls" });
    const at = now();
    const finished = base.filter((view) =>
      ["closed", "withdrawn", "expired", "archived"].includes(view.listing.status),
    );
    expect(finished.length).toBeGreaterThan(0);
    expect(filterMls(base, { tab: "base" }, at)).toHaveLength(base.length - finished.length);
    expect(filterMls(base, { tab: "base", finished: true }, at)).toHaveLength(base.length);
    const mine = await listListings({ scope: "mine" });
    expect(filterMls(mine, { tab: "mine" }, at)).toHaveLength(mine.length);
  });

  it("treats 'verified' as one concrete fact: confirmed ownership", async () => {
    const views = await listListings({ scope: "all" });
    const verified = filterMls(views, { tab: "mine", verified: true }, now());
    expect(verified.length).toBeGreaterThan(0);
    for (const view of verified) {
      expect(
        view.listing.verifications.some((item) => item.subject === "ownership" && item.status === "confirmed"),
      ).toBe(true);
    }
    // lst-03 has encumbrance "unavailable": it never counts as a confirmed fact.
    const lst03 = views.find((view) => view.listing.id === "lst-03");
    expect(lst03 && facetOf(lst03).ownershipConfirmed).toBe(true);
    expect(lst03 && facetOf(lst03).cadastreConfirmed).toBe(false);
  });

  it("filters by '4+' rooms and by price per m²", async () => {
    const views = await listListings({ scope: "all" });
    const at = now();
    const big = filterMls(views, { tab: "mine", rooms: 4 }, at);
    expect(big.every((view) => (view.property.rooms ?? 0) >= 4)).toBe(true);
    const cheap = filterMls(views, { tab: "mine", ppsqmMax: 1_200 }, at);
    for (const view of cheap) {
      const perSqm = pricePerSqm(view.listing.price, view.property.areaTotal);
      expect(perSqm && perSqm.amountMinor <= 120_000).toBe(true);
    }
    expect(pricePerSqm({ amountMinor: 10_000_000, currency: "USD" }, undefined)).toBeUndefined();
  });
});

describe("cooperation list", () => {
  it("parses params and links", () => {
    expect(parseCooperationParams({ direction: "incoming", status: "open" })).toEqual({
      direction: "incoming",
      status: "open",
    });
    expect(parseCooperationParams({ direction: "sideways", status: "sent" })).toEqual({});
    expect(cooperationListHref("ru", { direction: "outgoing" })).toBe("/ru/app/mls/cooperation?direction=outgoing");
  });

  it("puts requests waiting for the viewer first", async () => {
    const views = await listCooperation();
    const sorted = filterCooperation(views, {});
    const firstNotWaiting = sorted.findIndex((view) => !view.awaitingViewer);
    expect(sorted.slice(firstNotWaiting).some((view) => view.awaitingViewer)).toBe(false);
    expect(sorted[0].awaitingViewer).toBe(true);
    const closed = filterCooperation(views, { status: "closed" });
    expect(closed.map((view) => statusGroup(view.request.status))).toEqual(closed.map(() => "closed"));
  });

  it("finds the existing request on a listing to avoid competing ones", async () => {
    const views = await listCooperation();
    expect(activeRequestFor(views, "lst-23")?.request.id).toBe("coop-02");
    // coop-05 on lst-26 was declined: a new request is allowed.
    expect(activeRequestFor(views, "lst-26")).toBeUndefined();
  });

  it("knows which side each agent is on", () => {
    const request = { fromAgentId: "agent-01", toAgentId: "agent-06" };
    expect(sideOf(request, "agent-06")).toBe("listing");
    expect(sideOf(request, "agent-01")).toBe("buyer");
    expect(sideOf(request, "agent-99")).toBeUndefined();
  });

  it("reports deadlines only for open requests", () => {
    const at = new Date("2026-09-30T06:00:00.000Z");
    expect(deadlineState({ status: "sent", respondBy: "2026-09-30T15:00:00.000Z" }, at)).toEqual({
      kind: "open",
      msLeft: 9 * 3_600_000,
    });
    expect(deadlineState({ status: "viewed", respondBy: "2026-09-30T05:00:00.000Z" }, at).kind).toBe("overdue");
    expect(deadlineState({ status: "accepted", respondBy: "2026-09-30T05:00:00.000Z" }, at).kind).toBe("closed");
    expect(responseDeadline(at, 48)).toBe("2026-10-02T06:00:00.000Z");
  });
});

describe("terms editing", () => {
  const base = presetTerms("50/50", "USD");

  it("names presets in either direction and falls back to custom", () => {
    expect(presetFor(70, 30)).toBe("70/30");
    expect(presetFor(20, 80)).toBe("80/20");
    expect(presetFor(60, 40)).toBe("custom");
  });

  it("keeps percents summing to 100 and the preset honest", () => {
    const edited = withPercent(base, "listing", 62.5);
    expect(edited).toMatchObject({ listingSidePercent: 62.5, buyerSidePercent: 37.5, preset: "custom" });
    expect(validateTerms(edited)).toEqual([]);
    expect(withPercent(base, "buyer", 30)).toMatchObject({ listingSidePercent: 70, preset: "70/30" });
  });

  it("switches presets without losing basis or payout, and can flip the direction (§41 D2)", () => {
    const fixed = withBasis(base, "fixed_amount", { amountMinor: 150_000, currency: "USD" });
    const seventy = withPreset(fixed, "70/30", "buyer");
    expect(seventy).toMatchObject({
      preset: "70/30",
      listingSidePercent: 30,
      buyerSidePercent: 70,
      basis: "fixed_amount",
    });
    expect(largerSide(seventy)).toBe("buyer");
    expect(largerSide(flipShares(seventy))).toBe("listing");
    expect(validateTerms(flipShares(seventy))).toEqual([]);
    expect(withPreset(seventy, "custom", "listing")).toMatchObject({ preset: "custom", listingSidePercent: 30 });
  });

  it("moves the fixed amount to the new currency and drops it for a gross basis", () => {
    const fixed = withBasis(base, "fixed_amount", { amountMinor: 150_000, currency: "USD" });
    expect(withCurrency(fixed, "UZS").fixedAmount).toEqual({ amountMinor: 150_000, currency: "UZS" });
    expect(withBasis(fixed, "gross_commission").fixedAmount).toBeUndefined();
  });

  it("requires a note only for a custom payout", () => {
    const custom = withPayout(base, "custom", "  ");
    expect(custom.payoutNote).toBeUndefined();
    expect(validateTerms(custom).map((issue) => issue.code)).toEqual(["custom_payout_note_missing"]);
    expect(validateTerms(withPayout(base, "custom", "50% при задатке"))).toEqual([]);
  });

  it("parses user input strictly", () => {
    expect(parsePercent("62,5")).toBe(62.5);
    expect(parsePercent("101")).toBeUndefined();
    expect(parsePercent("")).toBeUndefined();
    expect(parseMoneyInput("1 500", "USD")).toEqual({ amountMinor: 150_000, currency: "USD" });
    expect(parseMoneyInput("0", "USD")).toBeUndefined();
    expect(parseMoneyInput("abc", "UZS")).toBeUndefined();
  });

  it("gives an exact example split, or nothing while terms are invalid", () => {
    const seventy = presetTerms("70/30", "USD");
    const split = exampleSplit(seventy, sampleGross("USD"));
    expect(split?.listingSide.amountMinor).toBe(140_000);
    expect(split?.buyerSide.amountMinor).toBe(60_000);
    expect(exampleSplit({ ...seventy, buyerSidePercent: 40 }, sampleGross("USD"))).toBeUndefined();
    expect(exampleSplit(seventy, sampleGross("UZS"))).toBeUndefined();
    const fixed = withBasis(presetTerms("50/50", "UZS"), "fixed_amount", { amountMinor: 1_000_001, currency: "UZS" });
    const fixedSplit = exampleSplit(fixed);
    expect(fixedSplit && fixedSplit.listingSide.amountMinor + fixedSplit.buyerSide.amountMinor).toBe(1_000_001);
  });
});

describe("negotiation in local demo state", () => {
  it("sends a draft as version 1 and keeps history on counter-proposals", () => {
    const draft = draftRequest({
      id: "draft-1",
      listingId: "lst-16",
      requirementId: "req-03",
      fromAgentId: "agent-01",
      toAgentId: "agent-05",
      respondBy: responseDeadline(now(), 24),
      createdAt: now().toISOString(),
    });
    const sent = proposeTerms(
      draft,
      presetTerms("50/50", "USD"),
      "agent-01",
      now().toISOString(),
      "Моя роль: агент клиента.",
    );
    expect(sent.ok && sent.value.status).toBe("sent");
    if (!sent.ok) return;
    const counter: CommissionTerms = withPreset(sent.value.versions[0].terms, "70/30", "listing");
    const negotiated = proposeTerms(sent.value, counter, "agent-05", now().toISOString());
    expect(negotiated.ok).toBe(true);
    if (!negotiated.ok) return;
    expect(negotiated.value.versions).toHaveLength(2);
    expect(changedFields(negotiated.value, 1)).toEqual(["preset", "listingSidePercent", "buyerSidePercent"]);
    expect(changedFields(negotiated.value, 0)).toEqual([]);
    const accepted = acceptTerms(negotiated.value, 2, "agent-01", now().toISOString());
    expect(accepted.ok && accepted.value.disclosure).toBe("contacts_shared");
    if (!accepted.ok) return;
    // Accepted terms are locked.
    expect(proposeTerms(accepted.value, presetTerms("50/50", "USD"), "agent-01", now().toISOString())).toEqual({
      ok: false,
      error: "terms_locked",
    });
    expect(declineRequest(accepted.value, "agent-05", now().toISOString())).toEqual({
      ok: false,
      error: "terms_locked",
    });
  });
});

describe("partner view of a requirement", () => {
  it("carries criteria only, never the client or the agent's sentence", async () => {
    const [view] = await listRequirements({ status: "active" });
    const summary = partnerViewOf(view.requirement);
    expect(summary.disclosed).toBe(false);
    expect(summary.clientName).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain(view.client.name);
    expect("naturalLanguageInput" in summary).toBe(false);
    expect("clientId" in summary).toBe(false);
  });
});

describe("terms editor draft", () => {
  it("keeps typed text while it does not parse, and follows the other side when it does", async () => {
    const { draftFromTerms, withPercentText, draftInputErrors, draftReady } = await import("./cooperation-model");
    const draft = draftFromTerms(presetTerms("50/50", "USD"));
    const typing = withPercentText(draft, "listing", "6");
    expect(typing).toMatchObject({ listingText: "6", buyerText: "94", terms: { preset: "custom" } });
    const broken = withPercentText(typing, "listing", "6x");
    expect(broken.listingText).toBe("6x");
    expect(broken.terms.listingSidePercent).toBe(6);
    expect(draftInputErrors(broken)).toEqual(["listingText"]);
    expect(draftReady(broken)).toBe(false);
    const seventy = withPercentText(broken, "buyer", "30");
    expect(seventy).toMatchObject({ listingText: "70", terms: { preset: "70/30" } });
    expect(draftReady(seventy)).toBe(true);
  });

  it("parses the fixed amount in the terms' currency and requires it for a fixed basis", async () => {
    const { draftFromTerms, withBasisChoice, withAmountText, withCurrencyChoice, draftInputErrors, draftReady } =
      await import("./cooperation-model");
    let draft = withBasisChoice(draftFromTerms(presetTerms("50/50", "USD")), "fixed_amount");
    expect(draftReady(draft)).toBe(false);
    draft = withAmountText(draft, "1 500");
    expect(draft.terms.fixedAmount).toEqual({ amountMinor: 150_000, currency: "USD" });
    draft = withCurrencyChoice(draft, "UZS");
    expect(draft.terms.fixedAmount).toEqual({ amountMinor: 150_000, currency: "UZS" });
    expect(draftReady(draft)).toBe(true);
    draft = withAmountText(draft, "полторы");
    expect(draftInputErrors(draft)).toEqual(["amountText"]);
  });

  it("round-trips seeded terms, including a custom payout note", async () => {
    const { draftFromTerms, withPayoutChoice, withPayoutNoteText, draftReady } = await import("./cooperation-model");
    const views = await listCooperation();
    for (const view of views) {
      const draft = draftFromTerms(view.latest.terms);
      expect(draft.terms).toEqual(view.latest.terms);
      expect(draftReady(draft)).toBe(true);
    }
    let draft = withPayoutChoice(draftFromTerms(presetTerms("50/50", "USD")), "custom");
    expect(draftReady(draft)).toBe(false);
    draft = withPayoutNoteText(draft, "После регистрации");
    expect(draftReady(draft)).toBe(true);
    expect(withPayoutChoice(draft, "on_deal_closing").terms.payoutNote).toBeUndefined();
  });
});
