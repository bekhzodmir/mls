import { beforeAll, describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { listListings, listTelegramListings } from "@/lib/data/repository";
import { findMatches } from "@/lib/domain/matching";
import { parseRequirementText } from "@/lib/domain/requirement-parser";
import { editorCandidates, type EditorCandidate } from "./editor-candidates";
import {
  buildDraft,
  countResults,
  emptyFormValues,
  filledCriteria,
  formValuesFromDraft,
  isAutoApplied,
  mergeFormValues,
  minorToInput,
  missingCriteria,
  parseAmount,
  parseCount,
  suggestedCurrency,
  valuesFromDraftField,
  withDealType,
  type DraftContext,
} from "./requirement-form";

const context: DraftContext = {
  id: "draft",
  clientId: "cl-01",
  agentId: "agent-01",
  organizationId: "org-01",
  text: "",
  nowIso: "2026-09-30T06:00:00.000Z",
};

describe("numbers", () => {
  it("parses amounts typed with spaces into exact minor units", () => {
    expect(parseAmount("85 000")).toEqual({ ok: true, value: 8_500_000 });
    expect(parseAmount("85000,5")).toEqual({ ok: true, value: 8_500_050 });
    expect(parseAmount("")).toEqual({ ok: true });
    expect(parseAmount("85,000")).toEqual({ ok: false });
    expect(parseAmount("0")).toEqual({ ok: false });
    expect(parseAmount("сто")).toEqual({ ok: false });
  });

  it("parses counts, allowing decimals only where they make sense", () => {
    expect(parseCount("3", true)).toEqual({ ok: true, value: 3 });
    expect(parseCount("2.5", true)).toEqual({ ok: false });
    expect(parseCount("45,5", false)).toEqual({ ok: true, value: 45.5 });
  });

  it("turns minor units back into what a person would type", () => {
    expect(minorToInput(10_000_000)).toBe("100000");
    expect(minorToInput(8_500_050)).toBe("85000.5");
    expect(minorToInput(8_500_005)).toBe("85000.05");
  });
});

describe("from the parsed sentence", () => {
  const draft = parseRequirementText("2–3 комнаты, Мирзо-Улугбек, ремонт, до 100 тысяч");

  it("prefills confident fields and the budget amount, but never the currency", () => {
    const values = formValuesFromDraft(draft);
    expect(values.districts).toEqual(["mirzo_ulugbek"]);
    expect(values.rooms).toEqual({ min: "2", max: "3" });
    expect(values.renovation).toEqual(["renovated", "designer"]);
    expect(values.budgetMax).toBe("100000");
    expect(values.currency).toBeUndefined();
    expect(suggestedCurrency(draft)).toBe("USD");
  });

  it("keeps weak guesses as suggestions the agent can apply", () => {
    expect(draft.propertyTypes.confidence).toBeLessThan(0.6);
    expect(isAutoApplied(draft, "propertyTypes")).toBe(false);
    expect(formValuesFromDraft(draft).propertyTypes).toEqual([]);
    expect(valuesFromDraftField(draft, "propertyTypes")).toEqual({ propertyTypes: ["apartment"] });
  });

  it("blocks the search until the deal type and the currency are confirmed", () => {
    const values = formValuesFromDraft(draft);
    expect(buildDraft(values, [], context).blockers).toEqual(["deal_type", "currency"]);
    const confirmed = mergeFormValues(values, { dealType: "sale", currency: "USD" });
    const build = buildDraft(confirmed, ["location", "floor"], { ...context, text: draft.text });
    expect(build.blockers).toEqual([]);
    expect(build.base?.budget).toEqual({ currency: "USD", max: { amountMinor: 10_000_000, currency: "USD" } });
    expect(build.base?.naturalLanguageInput).toBe(draft.text);
    // A must-have toggle on an empty criterion is dropped.
    expect(build.hardCriteria).toEqual(["location"]);
  });

  it("applies a currency named in the text", () => {
    const values = formValuesFromDraft(parseRequirementText("аренда 1-комнатной в Яккасарае, до 6 млн сум"));
    expect(values.currency).toBe("UZS");
    expect(values.dealType).toBe("rent");
    expect(values.budgetMax).toBe("6000000");
  });

  it("does not apply the currency when the sentence names two", () => {
    const conflicting = parseRequirementText("до 80 000$ или до 1 млрд сум, Юнусабад");
    expect(conflicting.warnings).toContain("currency_conflict");
    expect(formValuesFromDraft(conflicting).currency).toBeUndefined();
  });

  it("lets manual edits win, including clearing a value on purpose", () => {
    const merged = mergeFormValues(formValuesFromDraft(draft), { districts: [], renovation: ["shell"] });
    expect(merged.districts).toEqual([]);
    expect(merged.renovation).toEqual(["shell"]);
    expect(merged.rooms).toEqual({ min: "2", max: "3" });
  });
});

describe("buildDraft", () => {
  it("reports invalid numbers and reversed ranges without building", () => {
    const values = mergeFormValues(emptyFormValues(), {
      dealType: "sale",
      rooms: { min: "4", max: "2" },
      budgetMin: "abc",
      currency: "USD",
    });
    const build = buildDraft(values, [], context);
    expect(build.errors).toEqual({ rooms: "range", budget: "number" });
    expect(build.blockers).toEqual(["invalid"]);
    expect(build.base).toBeUndefined();
  });

  it("builds a requirement from an empty form without inventing criteria", () => {
    const build = buildDraft(emptyFormValues(), [], context);
    expect(build.blockers).toEqual(["deal_type"]);
    expect(build.base).toMatchObject({ districts: [], rooms: {}, area: {}, budget: { currency: "USD" }, extras: [] });
    expect(build.base?.floor).toBeUndefined();
    expect(build.base?.naturalLanguageInput).toBeUndefined();
    expect(withDealType(build.base!, "rent").dealType).toBe("rent");
  });

  it("lists missing criteria that make the search wider", () => {
    expect(missingCriteria(emptyFormValues())).toEqual(["property_type", "location", "price", "rooms", "area"]);
    const values = mergeFormValues(emptyFormValues(), { districts: ["chilanzar"], budgetMax: "70000" });
    expect(missingCriteria(values)).toEqual(["property_type", "rooms", "area"]);
    expect(filledCriteria(values)).toEqual(new Set(["location", "price"]));
  });
});

describe("live count with the demo inventory", () => {
  let candidates: EditorCandidate[];

  beforeAll(async () => {
    candidates = editorCandidates(await listListings(), await listTelegramListings());
  });

  it("uses only active offers the viewer may see", () => {
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((item) => item.candidate.active)).toBe(true);
    expect(candidates.some((item) => item.candidate.target.id === "lst-21")).toBe(false);
    expect(candidates.find((item) => item.candidate.target.kind === "telegram")?.path).toMatch(/^\/radar\//);
  });

  it("counts matches for a confirmed draft, split by source and band", () => {
    const values = mergeFormValues(formValuesFromDraft(parseRequirementText("2-3 комнаты на Чиланзаре до 75 тысяч")), {
      dealType: "sale",
      currency: "USD",
    });
    const build = buildDraft(values, [], context);
    const requirement = withDealType(build.base!, "sale");
    const ranked = findMatches(
      requirement,
      candidates.map((item) => item.candidate),
      now(),
    );
    const counts = countResults(ranked);
    expect(counts.total).toBe(ranked.length);
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.listings + counts.telegram).toBe(counts.total);
    expect(counts.excellent + counts.good + counts.possible).toBe(counts.total);
  });

  it("narrows the results when a criterion becomes a must-have", () => {
    const values = mergeFormValues(emptyFormValues(), {
      dealType: "sale",
      districts: ["chilanzar"],
      budgetMax: "75000",
      currency: "USD",
    });
    const soft = findMatches(
      withDealType(buildDraft(values, [], context).base!, "sale"),
      candidates.map((c) => c.candidate),
      now(),
    );
    const hard = findMatches(
      withDealType(buildDraft(values, ["location", "price"], context).base!, "sale"),
      candidates.map((c) => c.candidate),
      now(),
    );
    expect(hard.length).toBeLessThanOrEqual(soft.length);
    // Unknown districts stay visible so the agent can ask (§12.2); known ones must match.
    expect(
      hard.every((match) => match.candidate.district === undefined || match.candidate.district === "chilanzar"),
    ).toBe(true);
  });
});
