import { describe, expect, it } from "vitest";
import {
  bandFor,
  candidateFromListing,
  candidateFromTelegram,
  defaultMatchingConfig,
  evaluateMatch,
  findMatches,
  matchedCriteria,
  reverseMatch,
  sortMatches,
  type MatchCandidate,
  type MatchEvaluation,
} from "./matching";
import { money } from "./money";
import type {
  Listing,
  MatchCriterion,
  MatchReason,
  ParsedField,
  ParsedListingFields,
  Property,
  Requirement,
  TelegramListing,
} from "./types";

const NOW = new Date("2026-09-30T06:00:00.000Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function requirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "req-1",
    clientId: "client-1",
    agentId: "agent-1",
    dealType: "sale",
    propertyTypes: ["apartment"],
    city: "tashkent",
    districts: ["chilanzar"],
    rooms: { min: 2, max: 3 },
    area: { min: 50, max: 80 },
    budget: { max: money(100_000, "USD"), currency: "USD" },
    extras: [],
    hardCriteria: [],
    status: "active",
    version: 1,
    createdAt: ago(10),
    updatedAt: ago(10),
    ...overrides,
  };
}

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    target: { kind: "listing", id: "listing-1" },
    dealType: "sale",
    propertyType: "apartment",
    city: "tashkent",
    district: "chilanzar",
    rooms: 2,
    areaTotal: 60,
    floor: 3,
    floorsTotal: 9,
    price: money(95_000, "USD"),
    source: "realtor_confirmed",
    active: true,
    publishedAt: ago(1),
    ...overrides,
  };
}

function eligible(result: MatchEvaluation) {
  if (!result.eligible) throw new Error(`Expected eligible, got ${result.failures.join(", ")}`);
  return result;
}

function failures(result: MatchEvaluation) {
  return result.eligible ? [] : result.failures;
}

function reasonFor(result: MatchEvaluation, criterion: MatchCriterion): MatchReason {
  const found = eligible(result).reasons.find((reason) => reason.criterion === criterion);
  if (!found) throw new Error(`No reason for ${criterion}`);
  return found;
}

const evaluate = (req: Requirement, cand: MatchCandidate) => evaluateMatch(req, cand, NOW);

describe("configuration", () => {
  it("has weights that sum to 100 (§12.3)", () => {
    const total = Object.values(defaultMatchingConfig.weights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
  });

  it("maps scores to the §12.4 bands", () => {
    expect(bandFor(100)).toBe("excellent");
    expect(bandFor(90)).toBe("excellent");
    expect(bandFor(89)).toBe("good");
    expect(bandFor(75)).toBe("good");
    expect(bandFor(74)).toBe("possible");
    expect(bandFor(60)).toBe("possible");
    expect(bandFor(59)).toBe("hidden");
    expect(bandFor(0)).toBe("hidden");
  });
});

describe("hard filters (§12.2)", () => {
  it("passes a full match with score 100 and explains every criterion", () => {
    const result = eligible(evaluate(requirement(), candidate()));
    expect(result.score).toBe(100);
    expect(result.band).toBe("excellent");
    expect(result.reasons.map((reason) => reason.criterion)).toEqual([
      "location",
      "price",
      "property_type",
      "rooms",
      "area",
      "floor",
      "extras",
    ]);
    expect(matchedCriteria(result.reasons)).toEqual(["location", "price", "property_type", "rooms", "area"]);
  });

  it("removes inactive and expired sources", () => {
    expect(failures(evaluate(requirement(), candidate({ active: false })))).toEqual(["inactive_source"]);
    expect(failures(evaluate(requirement(), candidate({ expiresAt: ago(0) })))).toEqual(["inactive_source"]);
  });

  it("removes a different deal type, city or property type", () => {
    expect(failures(evaluate(requirement(), candidate({ dealType: "rent" })))).toEqual(["deal_type"]);
    expect(failures(evaluate(requirement(), candidate({ city: "tashkent_region" })))).toEqual(["city"]);
    expect(failures(evaluate(requirement(), candidate({ propertyType: "house" })))).toEqual(["property_type"]);
    expect(failures(evaluate(requirement(), candidate({ dealType: "rent", city: "tashkent_region" })))).toEqual([
      "deal_type",
      "city",
    ]);
  });

  it("does not filter on unknown deal or property type", () => {
    const result = evaluate(requirement(), candidate({ dealType: undefined, propertyType: undefined }));
    expect(reasonFor(result, "property_type")).toMatchObject({ outcome: "unknown", credit: 0.5 });
  });

  it("removes prices beyond the budget tolerance", () => {
    expect(failures(evaluate(requirement(), candidate({ price: money(111_000, "USD") })))).toEqual([
      "budget_out_of_range",
    ]);
  });

  it("removes candidates that break a must-have criterion", () => {
    const hardRooms = requirement({ hardCriteria: ["rooms"] });
    expect(failures(evaluate(hardRooms, candidate({ rooms: 4 })))).toEqual(["hard_criterion"]);
    const hardLocation = requirement({ hardCriteria: ["location"] });
    expect(failures(evaluate(hardLocation, candidate({ district: "uchtepa" })))).toEqual(["hard_criterion"]);
    const hardBuilding = requirement({ buildingKind: "new_building", hardCriteria: ["building_kind"] });
    expect(failures(evaluate(hardBuilding, candidate({ buildingKind: "secondary" })))).toEqual(["hard_criterion"]);
    const hardRenovation = requirement({ renovation: ["renovated"], hardCriteria: ["renovation"] });
    expect(failures(evaluate(hardRenovation, candidate({ renovation: "shell" })))).toEqual(["hard_criterion"]);
  });

  it("keeps unknown data visible even for must-have criteria", () => {
    const hard = requirement({ hardCriteria: ["location", "rooms"] });
    const result = eligible(evaluate(hard, candidate({ district: undefined, rooms: undefined })));
    expect(reasonFor(result, "location").outcome).toBe("unknown");
    expect(reasonFor(result, "rooms").outcome).toBe("unknown");
  });
});

describe("price reasons", () => {
  it("gives partial credit within the tolerance and says by how much", () => {
    const result = evaluate(requirement(), candidate({ price: money(105_000, "USD") }));
    expect(reasonFor(result, "price")).toEqual({
      criterion: "price",
      outcome: "partial",
      credit: 0.5,
      weight: 25,
      requested: true,
      detail: { kind: "price_over", by: money(5_000, "USD") },
    });
    expect(eligible(result).score).toBe(88); // 100 − 25 × 0.5 = 87.5 → 88
  });

  it("gives zero credit exactly at the tolerance edge but keeps the match", () => {
    const result = eligible(evaluate(requirement(), candidate({ price: money(110_000, "USD") })));
    expect(reasonFor(result, "price")).toMatchObject({ outcome: "partial", credit: 0 });
    expect(result.score).toBe(75);
  });

  it("has zero tolerance when price is a must-have", () => {
    const hard = requirement({ hardCriteria: ["price"] });
    expect(failures(evaluate(hard, candidate({ price: money("100000.01", "USD") })))).toEqual([
      "budget_out_of_range",
    ]);
    expect(evaluate(hard, candidate({ price: money(100_000, "USD") })).eligible).toBe(true);
  });

  it("reports a cheaper-than-expected price as a partial fit", () => {
    const result = evaluate(
      requirement({ budget: { min: money(90_000, "USD"), max: money(100_000, "USD"), currency: "USD" } }),
      candidate({ price: money(80_000, "USD") }),
    );
    expect(reasonFor(result, "price")).toMatchObject({
      outcome: "partial",
      credit: 0.8,
      detail: { kind: "price_under", by: money(10_000, "USD") },
    });
  });

  it("flags a currency conversion instead of hiding it", () => {
    const result = evaluate(requirement(), candidate({ price: money(1_200_000_000, "UZS") }));
    expect(reasonFor(result, "price")).toMatchObject({
      outcome: "match",
      detail: { kind: "price_converted", from: "UZS", to: "USD" },
    });
  });

  it("flags a conversion when the converted price is over or under the budget too", () => {
    const over = evaluate(
      requirement({ budget: { max: money(80_000, "USD"), currency: "USD" } }),
      candidate({ price: money(1_050_000_000, "UZS") }),
    );
    expect(reasonFor(over, "price")).toMatchObject({
      outcome: "partial",
      detail: { kind: "price_over", by: money(2_677.17, "USD"), converted: { from: "UZS", to: "USD" } },
    });
    const under = evaluate(
      requirement({ budget: { min: money(90_000, "USD"), max: money(100_000, "USD"), currency: "USD" } }),
      candidate({ price: money(1_016_000_000, "UZS") }),
    );
    expect(reasonFor(under, "price")).toMatchObject({
      outcome: "partial",
      detail: { kind: "price_under", by: money(10_000, "USD"), converted: { from: "UZS", to: "USD" } },
    });
    // Same currency: no conversion flag.
    const plain = evaluate(requirement(), candidate({ price: money(105_000, "USD") }));
    expect(reasonFor(plain, "price").detail).toEqual({ kind: "price_over", by: money(5_000, "USD") });
  });

  it("does not score price when the requirement has no budget", () => {
    const result = evaluate(requirement({ budget: { currency: "USD" } }), candidate({ price: undefined }));
    expect(reasonFor(result, "price")).toMatchObject({ outcome: "match", credit: 1, requested: false });
  });
});

describe("soft criteria", () => {
  it("gives unknown data partial credit and marks it as missing (never a match)", () => {
    const result = eligible(evaluate(requirement(), candidate({ rooms: undefined })));
    expect(reasonFor(result, "rooms")).toEqual({
      criterion: "rooms",
      outcome: "unknown",
      credit: defaultMatchingConfig.unknownCredit,
      weight: 15,
      requested: true,
      detail: { kind: "missing_data" },
    });
    expect(result.score).toBe(93); // 100 − 15 × 0.5 = 92.5 → 93
    expect(matchedCriteria(result.reasons)).not.toContain("rooms");
  });

  it("gives half credit for a neighbouring district and none for a distant one", () => {
    expect(reasonFor(evaluate(requirement(), candidate({ district: "uchtepa" })), "location")).toMatchObject({
      outcome: "partial",
      credit: 0.5,
      detail: { kind: "district_adjacent", district: "uchtepa" },
    });
    expect(reasonFor(evaluate(requirement(), candidate({ district: "bektemir" })), "location")).toMatchObject({
      outcome: "mismatch",
      credit: 0,
      detail: { kind: "district_other", district: "bektemir" },
    });
  });

  it("scores rooms and area by distance from the wanted range", () => {
    expect(reasonFor(evaluate(requirement(), candidate({ rooms: 4 })), "rooms")).toMatchObject({
      outcome: "partial",
      detail: { kind: "rooms_off_by", delta: 1 },
    });
    expect(reasonFor(evaluate(requirement(), candidate({ rooms: 5 })), "rooms").outcome).toBe("mismatch");
    expect(reasonFor(evaluate(requirement(), candidate({ areaTotal: 85 })), "area")).toMatchObject({
      credit: 0.7,
      detail: { kind: "area_off_by", deltaSqm: 5 },
    });
    expect(reasonFor(evaluate(requirement(), candidate({ areaTotal: 95 })), "area").credit).toBe(0.4);
    expect(reasonFor(evaluate(requirement(), candidate({ areaTotal: 45 })), "area")).toMatchObject({
      credit: 0.7,
      detail: { kind: "area_off_by", deltaSqm: -5 },
    });
    expect(reasonFor(evaluate(requirement(), candidate({ areaTotal: 100 })), "area").outcome).toBe("mismatch");
  });

  it("checks floor preferences and building kind", () => {
    const notFirst = requirement({ floor: { notFirst: true, notLast: true } });
    expect(reasonFor(evaluate(notFirst, candidate({ floor: 1 })), "floor").detail).toEqual({ kind: "floor_first" });
    expect(reasonFor(evaluate(notFirst, candidate({ floor: 9 })), "floor").detail).toEqual({ kind: "floor_last" });
    expect(reasonFor(evaluate(notFirst, candidate({ floor: 3 })), "floor").outcome).toBe("match");
    const newBuilding = requirement({ buildingKind: "new_building" });
    expect(reasonFor(evaluate(newBuilding, candidate({ buildingKind: "secondary" })), "floor").detail).toEqual({
      kind: "building_kind_mismatch",
      expected: "new_building",
      actual: "secondary",
    });
    expect(reasonFor(evaluate(newBuilding, candidate()), "floor").outcome).toBe("unknown");
  });

  it("leaves «не последний этаж» unknown when the building height is unknown", () => {
    const notLast = requirement({ floor: { notLast: true }, hardCriteria: ["floor"] });
    const result = eligible(evaluate(notLast, candidate({ floor: 9, floorsTotal: undefined })));
    expect(reasonFor(result, "floor")).toMatchObject({ outcome: "unknown", detail: { kind: "missing_data" } });
    expect(result.score).toBe(98); // 100 − 5 × 0.5 = 97.5 → 98
    expect(reasonFor(evaluate(notLast, candidate({ floor: 9, floorsTotal: 12 })), "floor").outcome).toBe("match");
    expect(failures(evaluate(notLast, candidate({ floor: 9, floorsTotal: 9 })))).toEqual(["hard_criterion"]);
  });

  it("reports extras not found in the text as unknown, not as a mismatch", () => {
    const req = requirement({ extras: ["парковка", "метро"] });
    expect(reasonFor(evaluate(req, candidate({ text: "Есть ПАРКОВКА во дворе" })), "extras")).toMatchObject({
      outcome: "partial",
      credit: 0.5,
      detail: { kind: "extras", matched: ["парковка"], missing: ["метро"] },
    });
    expect(reasonFor(evaluate(req, candidate({ text: "Светлая квартира" })), "extras")).toMatchObject({
      outcome: "unknown",
      credit: defaultMatchingConfig.unknownCredit,
    });
  });

  it("finds extras the parser keeps with their preposition", () => {
    const req = requirement({ extras: ["с парковкой", "рядом со школой", "с мебелью"] });
    const result = evaluate(req, candidate({ text: "Парковка во дворе, рядом школа. Мебель остаётся" }));
    expect(reasonFor(result, "extras")).toMatchObject({
      outcome: "match",
      credit: 1,
      detail: { kind: "extras", matched: ["с парковкой", "рядом со школой", "с мебелью"], missing: [] },
    });
    const uz = evaluate(requirement({ extras: ["mebel bilan", "maktab yaqinida"] }), candidate({ text: "Mebel qoladi, maktab bor" }));
    expect(reasonFor(uz, "extras").outcome).toBe("match");
    // A different amenity is still missing.
    const lift = evaluate(requirement({ extras: ["с лифтом"] }), candidate({ text: "Парковка во дворе" }));
    expect(reasonFor(lift, "extras").outcome).toBe("unknown");
  });

  it("does not let extras hide a requested renovation the candidate does not state", () => {
    const req = requirement({ renovation: ["renovated"], extras: ["парковка"] });
    const unknownRenovation = eligible(evaluate(req, candidate({ text: "Есть парковка" })));
    expect(reasonFor(unknownRenovation, "extras")).toMatchObject({
      outcome: "partial",
      credit: 0.75,
      detail: { kind: "extras", matched: ["парковка"], missing: [], renovationUnknown: true },
    });
    expect(unknownRenovation.score).toBe(99); // 100 − 5 × 0.25 = 98.75 → 99
    const known = evaluate(req, candidate({ text: "Есть парковка", renovation: "renovated" }));
    expect(reasonFor(known, "extras")).toMatchObject({ outcome: "match", credit: 1 });
  });
});

describe("determinism and ordering", () => {
  it("returns the same evaluation for the same inputs", () => {
    const cand = candidate({ rooms: 4, price: money(104_000, "USD") });
    expect(evaluate(requirement(), cand)).toEqual(evaluate(requirement(), cand));
  });

  it("sorts by score, then freshness, then target id", () => {
    const candidates = [
      candidate({ target: { kind: "listing", id: "b" } }),
      candidate({ target: { kind: "listing", id: "a" } }),
      candidate({ target: { kind: "listing", id: "stale" }, publishedAt: ago(10) }),
      candidate({ target: { kind: "listing", id: "partial" }, rooms: 4 }),
      candidate({ target: { kind: "listing", id: "far" }, district: "bektemir", rooms: 5, areaTotal: 120 }),
    ];
    const ids = findMatches(requirement(), candidates, NOW).map((match) => match.candidate.target.id);
    expect(ids).toEqual(["a", "b", "stale", "partial"]);
    // The same input in another order gives the same ranking.
    expect(findMatches(requirement(), [...candidates].reverse(), NOW).map((m) => m.candidate.target.id)).toEqual(ids);
    // Hidden-band results appear only on request.
    expect(findMatches(requirement(), candidates, NOW, { includeHidden: true })).toHaveLength(5);
  });

  it("sorts by price with unknown prices last, and by freshness", () => {
    const candidates = [
      candidate({ target: { kind: "listing", id: "unknown-price" }, price: undefined }),
      candidate({ target: { kind: "listing", id: "cheap" }, price: money(80_000, "USD"), publishedAt: ago(6) }),
      candidate({ target: { kind: "listing", id: "dear" }, price: money(99_000, "USD") }),
    ];
    const ranked = findMatches(requirement(), candidates, NOW);
    expect(sortMatches(ranked, "price", requirement()).map((m) => m.candidate.target.id)).toEqual([
      "cheap",
      "dear",
      "unknown-price",
    ]);
    expect(sortMatches(ranked, "freshness", requirement()).map((m) => m.candidate.target.id)).toEqual([
      "dear",
      "unknown-price",
      "cheap",
    ]);
  });
});

describe("reverseMatch (§12.5)", () => {
  it("returns only active, eligible and visible requirements, best first", () => {
    const requirements = [
      requirement({ id: "req-b" }),
      requirement({ id: "req-a" }),
      requirement({ id: "req-paused", status: "paused" }),
      requirement({ id: "req-rent", dealType: "rent" }),
      requirement({ id: "req-partial", rooms: { min: 3, max: 3 } }),
      requirement({ id: "req-hidden", districts: ["bektemir"], rooms: { min: 5 }, area: { min: 100 } }),
    ];
    const result = reverseMatch(candidate(), requirements, NOW);
    expect(result.map((entry) => entry.requirement.id)).toEqual(["req-a", "req-b", "req-partial"]);
    expect(result.map((entry) => entry.score)).toEqual([100, 100, 93]);
  });
});

describe("candidate adapters", () => {
  function field<T>(value: T, confidence: number): ParsedField<T> {
    return { value, confidence };
  }

  function post(overrides: Partial<TelegramListing> = {}, parsed: Partial<ParsedListingFields> = {}): TelegramListing {
    return {
      id: "tg-1",
      sourceId: "src-1",
      messageId: 101,
      sourceUrl: "https://t.me/demo_channel/101",
      rawText: "Продаётся 2-комн. квартира, Чиланзар, 60 м², $95 000",
      mediaCount: 3,
      publishedAt: ago(1),
      receivedAt: ago(1),
      parsed: {
        dealType: field("sale", 0.95),
        propertyType: field("apartment", 0.9),
        district: field("chilanzar", 0.9),
        rooms: field(2, 0.9),
        areaTotal: field(60, 0.9),
        floor: { confidence: 0 },
        floorsTotal: { confidence: 0 },
        price: field(money(95_000, "USD"), 0.9),
        phone: { confidence: 0 },
        ...parsed,
      },
      parserVersion: "test",
      duplicateCandidates: [],
      status: "new",
      linkedClientIds: [],
      ...overrides,
    };
  }

  it("treats low-confidence Telegram fields as unknown instead of trusting them", () => {
    const cand = candidateFromTelegram(post({}, { rooms: field(5, 0.4), price: field(money(1, "USD"), 0.59) }));
    expect(cand.rooms).toBeUndefined();
    expect(cand.price).toBeUndefined();
    expect(cand.source).toBe("telegram");
    const result = evaluate(requirement(), cand);
    expect(reasonFor(result, "rooms").outcome).toBe("unknown");
    expect(reasonFor(result, "price").outcome).toBe("unknown");
  });

  it("keeps confident fields and marks hidden or stale posts inactive", () => {
    expect(candidateFromTelegram(post()).rooms).toBe(2);
    expect(candidateFromTelegram(post({ status: "hidden" })).active).toBe(false);
    expect(candidateFromTelegram(post({ status: "reported_stale" })).active).toBe(false);
    expect(candidateFromTelegram(post({ status: "saved" })).active).toBe(true);
  });

  it("never offers a buyer's or tenant's request as supply", () => {
    const demand = candidateFromTelegram(post({}, { intent: field("demand", 0.9) }));
    expect(demand.active).toBe(false);
    expect(failures(evaluate(requirement(), demand))).toContain("inactive_source");
  });

  it("maps a listing and its property, active only in live statuses", () => {
    const property = {
      id: "p-1",
      propertyType: "apartment",
      city: "tashkent",
      district: "yunusabad",
      address: "—",
      rooms: 3,
      areaTotal: 75,
      createdAt: ago(30),
    } satisfies Property;
    const listing = {
      id: "l-1",
      propertyId: "p-1",
      agentId: "agent-1",
      dealType: "sale",
      price: money(120_000, "USD"),
      priceHistory: [],
      status: "active_mls",
      confidentiality: "professional",
      source: "realtor_confirmed",
      exclusive: false,
      verifications: [],
      description: "Парковка",
      photoCount: 0,
      publishedAt: ago(2),
      updatedAt: ago(2),
    } satisfies Listing;
    expect(candidateFromListing(listing, property)).toMatchObject({
      target: { kind: "listing", id: "l-1" },
      district: "yunusabad",
      rooms: 3,
      active: true,
      text: "Парковка",
    });
    expect(candidateFromListing({ ...listing, status: "withdrawn" }, property).active).toBe(false);
    expect(candidateFromListing({ ...listing, status: "closed" }, property).active).toBe(false);
  });

  it("searches the public landmark and massif name for extras", () => {
    const property = {
      id: "p-2",
      propertyType: "apartment",
      city: "tashkent",
      district: "chilanzar",
      areaName: "Ц-5",
      address: "—",
      landmark: "метро Хамид Олимжон",
      rooms: 2,
      areaTotal: 60,
      createdAt: ago(30),
    } satisfies Property;
    const listing = {
      id: "l-2",
      propertyId: "p-2",
      agentId: "agent-1",
      dealType: "sale",
      price: money(95_000, "USD"),
      priceHistory: [],
      status: "active_mls",
      confidentiality: "professional",
      source: "realtor_confirmed",
      exclusive: false,
      verifications: [],
      description: "Светлая квартира",
      photoCount: 0,
      publishedAt: ago(2),
      updatedAt: ago(2),
    } satisfies Listing;
    const cand = candidateFromListing(listing, property);
    expect(cand.text).toBe("Светлая квартира\nметро Хамид Олимжон\nЦ-5");
    const result = evaluate(requirement({ extras: ["метро Хамид Олимжон"] }), cand);
    expect(reasonFor(result, "extras")).toMatchObject({
      outcome: "match",
      detail: { kind: "extras", matched: ["метро Хамид Олимжон"], missing: [] },
    });
  });
});
