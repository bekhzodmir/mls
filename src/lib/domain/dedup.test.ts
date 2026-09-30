import { describe, expect, it } from "vitest";
import {
  compareForDuplicates,
  dedupRecordFromListing,
  dedupRecordFromTelegram,
  defaultDedupConfig,
  findDuplicateCandidates,
  textSimilarity,
  type DedupRecord,
} from "./dedup";
import { money } from "./money";
import { parseTelegramPost, POST_PARSER_VERSION } from "./post-parser";
import type { Listing, Property, TelegramListing } from "./types";

const POST =
  "Продаётся 3-комн. квартира, Юнусабад-19, 4/9 этаж, 78 м², евроремонт, 85 000 $. Тел: +998 90 123 45 67";
const REPOST =
  "🔥 Продаётся 3-комн квартира! Юнусабад 19, 4/9 этаж, 78 м2, евроремонт, 85000$. Тел: 90 123 45 67";
const SAME_AGENT_OTHER_FLAT =
  "Продаётся 3-комн. квартира, Юнусабад-4, 7/9 этаж, 81 м², евроремонт, 90 000 $. Тел: +998 90 123 45 67";
const OTHER_POST = "Sotiladi! Chilonzor 9-kvartal, 2 xonali, 3/4 qavat, 54 m², 58 000 $, tel 90 555 12 34";

const base: DedupRecord = {
  id: "tg-1",
  phone: "+998901234567",
  district: "yunusabad",
  rooms: 3,
  areaTotal: 78,
  floor: 4,
  price: money(85_000, "USD"),
  text: POST,
  mediaHashes: ["img-a", "img-b"],
  dealType: "sale",
};

describe("textSimilarity", () => {
  it("is 1 for identical texts and 0 for empty ones", () => {
    expect(textSimilarity(POST, POST)).toBe(1);
    expect(textSimilarity("", POST)).toBe(0);
    expect(textSimilarity("🔥🔥", "!!!")).toBe(0);
  });

  it("is symmetric", () => {
    expect(textSimilarity(POST, REPOST)).toBe(textSimilarity(REPOST, POST));
  });

  it("ignores case, ё/е, apostrophes, dashes, punctuation and emoji", () => {
    expect(textSimilarity("ПРОДАЁТСЯ ta’mirli — 2–3", "продается ta'mirli - 2-3 🔥")).toBe(1);
  });

  it("keeps a reformatted repost close and a different listing far", () => {
    expect(textSimilarity(POST, REPOST)).toBeGreaterThanOrEqual(0.8);
    expect(textSimilarity(POST, OTHER_POST)).toBeLessThan(0.2);
    expect(textSimilarity(POST, "Сдаю офис в центре")).toBeLessThan(0.1);
  });

  it("scores the same agent's template high — which is why text is only one signal", () => {
    expect(textSimilarity(POST, SAME_AGENT_OTHER_FLAT)).toBeGreaterThanOrEqual(defaultDedupConfig.textThreshold);
  });
});

describe("compareForDuplicates", () => {
  it("lists every signal of an exact repost in canonical order", () => {
    const result = compareForDuplicates(base, { ...base, id: "tg-2" });
    expect(result).toEqual({
      id: "tg-2",
      score: 100,
      signals: [
        "same_phone",
        "same_district",
        "same_rooms",
        "similar_area",
        "similar_price",
        "same_floor",
        "similar_text",
        "same_media",
      ],
      conflicts: [],
      recommendation: "likely_duplicate",
    });
  });

  it("compares phones after +998 normalization", () => {
    const result = compareForDuplicates({ id: "a", phone: "90 123 45 67" }, { id: "b", phone: "+998 (90) 123-45-67" });
    expect(result.signals).toEqual(["same_phone"]);
    expect(compareForDuplicates({ id: "a", phone: "123" }, { id: "b", phone: "123" }).signals).toEqual([]);
  });

  it("treats area and price within ±5% as similar", () => {
    const within = compareForDuplicates(
      { id: "a", areaTotal: 100, price: money(100_000, "USD") },
      { id: "b", areaTotal: 95, price: money(95_000, "USD") },
    );
    expect(within.signals).toEqual(["similar_area", "similar_price"]);

    const outside = compareForDuplicates(
      { id: "a", areaTotal: 100, price: money(100_000, "USD") },
      { id: "b", areaTotal: 94, price: money(94_000, "USD") },
    );
    expect(outside.signals).toEqual([]);
    // 6% apart is not similar, but not a contradiction either.
    expect(outside.conflicts).toEqual([]);
  });

  it("never compares prices across currencies", () => {
    const result = compareForDuplicates(
      { id: "a", price: money(85_000, "USD") },
      { id: "b", price: money(85_000, "UZS") },
    );
    expect(result.signals).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("reports contradicting attributes and blocks likely_duplicate", () => {
    const result = compareForDuplicates(base, { ...base, id: "tg-2", floor: 7, rooms: 2 });
    expect(result.conflicts).toEqual(["rooms", "floor"]);
    expect(result.signals).not.toContain("same_floor");
    const { weights, conflictPenalty } = defaultDedupConfig;
    expect(result.score).toBe(100 - weights.same_rooms - weights.same_floor - 2 * conflictPenalty);
    expect(result.recommendation).toBe("review");
  });

  it("flags a different district, deal type or a clearly different area", () => {
    const result = compareForDuplicates(base, {
      ...base,
      id: "tg-2",
      district: "chilanzar",
      dealType: "rent",
      areaTotal: 90,
    });
    expect(result.conflicts).toEqual(["deal_type", "district", "area"]);
    expect(result.recommendation).toBe("review");
  });

  it("does not treat a price drop as a contradiction", () => {
    const result = compareForDuplicates(base, { ...base, id: "tg-2", price: money(79_000, "USD") });
    expect(result.signals).not.toContain("similar_price");
    expect(result.conflicts).toEqual([]);
    expect(result.recommendation).toBe("likely_duplicate");
  });

  it("ignores unknown values instead of counting them either way", () => {
    const result = compareForDuplicates({ id: "a", phone: base.phone }, { id: "b", phone: base.phone, rooms: 3 });
    expect(result.signals).toEqual(["same_phone"]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("recommendation rules (§34.5)", () => {
  it("a shared phone alone is below the threshold, and never likely", () => {
    const pool = [{ id: "b", phone: base.phone }];
    expect(findDuplicateCandidates({ id: "a", phone: base.phone }, pool)).toEqual([]);
    const [shown] = findDuplicateCandidates({ id: "a", phone: base.phone }, pool, { minScore: 0 });
    expect(shown).toMatchObject({ signals: ["same_phone"], recommendation: "review" });
  });

  it("shared photos alone are never likely", () => {
    const [shown] = findDuplicateCandidates(
      { id: "a", mediaHashes: ["x"] },
      [{ id: "b", mediaHashes: ["x", "y"] }],
      { minScore: 0 },
    );
    expect(shown).toMatchObject({ signals: ["same_media"], recommendation: "review" });
  });

  it("identity signals without a physical pair stay at review", () => {
    const target: DedupRecord = { id: "a", phone: base.phone, mediaHashes: ["x"], text: POST, price: base.price };
    const result = compareForDuplicates(target, { ...target, id: "b" });
    expect(result.signals).toEqual(["same_phone", "similar_price", "similar_text", "same_media"]);
    expect(result.score).toBeGreaterThanOrEqual(defaultDedupConfig.likelyScore);
    expect(result.recommendation).toBe("review");
  });

  it("physical attributes alone stay at review: identical flats exist in series buildings", () => {
    const flat: DedupRecord = { id: "a", district: "chilanzar", rooms: 2, areaTotal: 54, floor: 3 };
    const result = compareForDuplicates(flat, { ...flat, id: "b" });
    expect(result.signals).toHaveLength(4);
    expect(result.score).toBeLessThan(defaultDedupConfig.likelyScore);
    expect(result.recommendation).toBe("review");
    // Even with a matching price: no contact, text or photo ties them together.
    const priced = compareForDuplicates({ ...flat, price: base.price }, { ...flat, id: "b", price: base.price });
    expect(priced.signals).toHaveLength(5);
    expect(priced.recommendation).toBe("review");
  });

  it("needs at least four signals including district + rooms or area + floor", () => {
    const three = compareForDuplicates(
      { id: "a", phone: base.phone, district: "yunusabad", rooms: 3 },
      { id: "b", phone: base.phone, district: "yunusabad", rooms: 3 },
    );
    expect(three.recommendation).toBe("review");

    const areaFloor = compareForDuplicates(
      { id: "a", phone: base.phone, areaTotal: 78, floor: 4, text: POST },
      { id: "b", phone: base.phone, areaTotal: 77, floor: 4, text: REPOST },
    );
    expect(areaFloor.signals).toEqual(["same_phone", "similar_area", "same_floor", "similar_text"]);
    expect(areaFloor.recommendation).toBe("likely_duplicate");
  });

  it("keeps the same agent's other flat at review despite similar text", () => {
    const other: DedupRecord = {
      ...base,
      id: "tg-3",
      areaTotal: 81,
      floor: 7,
      price: money(90_000, "USD"),
      text: SAME_AGENT_OTHER_FLAT,
      mediaHashes: ["img-z"],
    };
    const result = compareForDuplicates(base, other);
    expect(result.signals).toContain("similar_text");
    expect(result.conflicts).toEqual(["floor"]);
    expect(result.recommendation).toBe("review");
  });
});

describe("findDuplicateCandidates", () => {
  const pool: DedupRecord[] = [
    base,
    { ...base, id: "tg-exact" },
    { ...base, id: "tg-price-drop", price: money(80_000, "USD"), mediaHashes: [] },
    { id: "tg-phone-only", phone: base.phone },
    { id: "tg-unrelated", district: "chilanzar", rooms: 2, text: OTHER_POST },
    { ...base, id: "tg-a-tie" },
  ];

  it("excludes the target and weak candidates, strongest first, ties by id", () => {
    const result = findDuplicateCandidates(base, pool);
    expect(result.map((candidate) => candidate.id)).toEqual(["tg-a-tie", "tg-exact", "tg-price-drop"]);
    expect(result.map((candidate) => candidate.recommendation)).toEqual([
      "likely_duplicate",
      "likely_duplicate",
      "likely_duplicate",
    ]);
    expect(result[0].score).toBeGreaterThanOrEqual(result[2].score);
  });

  it("returns nothing for an empty pool or a pool of only the target", () => {
    expect(findDuplicateCandidates(base, [])).toEqual([]);
    expect(findDuplicateCandidates(base, [base])).toEqual([]);
  });

  it("accepts partial options, including single weights", () => {
    const [candidate] = findDuplicateCandidates(
      { id: "a", phone: base.phone },
      [{ id: "b", phone: base.phone }],
      { weights: { ...defaultDedupConfig.weights, same_phone: 40 } },
    );
    expect(candidate).toMatchObject({ id: "b", score: 40, recommendation: "review" });
    expect(defaultDedupConfig.weights.same_phone).toBe(15);
  });

  it("uses weights that sum to 100", () => {
    const total = Object.values(defaultDedupConfig.weights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
  });
});

describe("adapters", () => {
  const telegram = (id: string, rawText: string): TelegramListing => ({
    id,
    sourceId: "src-1",
    messageId: 1,
    sourceUrl: `https://t.me/demo_channel/${id}`,
    rawText,
    mediaCount: 0,
    publishedAt: "2026-09-29T08:00:00.000Z",
    receivedAt: "2026-09-29T08:01:00.000Z",
    parsed: parseTelegramPost(rawText),
    parserVersion: POST_PARSER_VERSION,
    duplicateCandidates: [],
    status: "new",
    linkedClientIds: [],
  });

  it("builds records from confidently parsed Telegram fields only", () => {
    const record = dedupRecordFromTelegram(telegram("tg-1", POST), { mediaHashes: ["img-a"] });
    expect(record).toEqual({
      id: "tg-1",
      phone: "+998901234567",
      district: "yunusabad",
      rooms: 3,
      areaTotal: 78,
      floor: 4,
      price: { amountMinor: 8_500_000, currency: "USD", raw: "85 000 $" },
      dealType: "sale",
      text: POST,
      mediaHashes: ["img-a"],
    });
    // A currency-less price is Unknown and simply absent.
    expect(dedupRecordFromTelegram(telegram("tg-2", "Продаётся 2 комн, 65 000")).price).toBeUndefined();
  });

  it("finds a reformatted repost end to end", () => {
    const target = dedupRecordFromTelegram(telegram("tg-1", POST));
    const pool = [telegram("tg-2", REPOST), telegram("tg-3", OTHER_POST), telegram("tg-4", SAME_AGENT_OTHER_FLAT)].map(
      (post) => dedupRecordFromTelegram(post),
    );
    const result = findDuplicateCandidates(target, pool);
    expect(result[0]).toMatchObject({ id: "tg-2", recommendation: "likely_duplicate", conflicts: [] });
    expect(result.find((candidate) => candidate.id === "tg-4")?.recommendation).toBe("review");
    expect(result.some((candidate) => candidate.id === "tg-3")).toBe(false);
  });

  it("builds records from a Listing and its Property", () => {
    const property: Property = {
      id: "prop-1",
      propertyType: "apartment",
      city: "tashkent",
      district: "yunusabad",
      address: "Юнусабад-19, дом 7",
      rooms: 3,
      areaTotal: 78,
      floor: 4,
      floorsTotal: 9,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const listing: Listing = {
      id: "lst-1",
      propertyId: property.id,
      agentId: "agent-1",
      dealType: "sale",
      price: money(85_000, "USD"),
      priceHistory: [],
      status: "active_mls",
      confidentiality: "professional",
      source: "realtor_confirmed",
      exclusive: false,
      verifications: [],
      description: POST,
      photoCount: 0,
      publishedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const record = dedupRecordFromListing(listing, property);
    expect(record).toEqual({
      id: "lst-1",
      district: "yunusabad",
      rooms: 3,
      areaTotal: 78,
      floor: 4,
      price: { amountMinor: 8_500_000, currency: "USD" },
      dealType: "sale",
      text: POST,
    });
    const telegramTwin = dedupRecordFromTelegram(telegram("tg-1", POST));
    expect(compareForDuplicates(record, telegramTwin).recommendation).toBe("likely_duplicate");
  });
});
