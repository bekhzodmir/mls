import { describe, expect, it } from "vitest";
import domain from "@/i18n/messages/domain";
import radar from "@/i18n/messages/radar";
import { findDuplicateCandidates } from "@/lib/domain/dedup";
import { analyzeTelegramPost } from "@/lib/domain/post-parser";
import type { ParsedListingFields, TelegramListing } from "@/lib/domain/types";
import { seed } from "@/lib/data/seed";
import type { TelegramListingView } from "@/lib/data/views";
import {
  confidenceLevel,
  draftDedupRecord,
  excerpt,
  formatParsedValue,
  looksLikeLink,
  parseQuality,
  parseTelegramLink,
  postFacts,
  relevantFields,
  subscriptionFacts,
} from "./parse-view";
import {
  convertHref,
  hasRadarFilters,
  keepByStatus,
  parseRadarParams,
  radarHref,
  toTelegramFilter,
} from "./radar-params";

function post(id: string): TelegramListing {
  const found = seed.telegramListings.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

const labels = {
  value: radar.ru.value,
  dealType: domain.ru.dealType,
  propertyType: domain.ru.propertyType,
};

describe("radar URL params", () => {
  it("parses known values and ignores unknown ones", () => {
    expect(parseRadarParams({ district: "chilanzar", dealType: "rent", status: "saved", q: "  метро " })).toEqual({
      district: "chilanzar",
      dealType: "rent",
      status: "saved",
      q: "метро",
    });
    expect(parseRadarParams({ district: "atlantis", dealType: "swap", status: "deleted" })).toEqual({
      status: "active",
    });
    expect(parseRadarParams({ district: ["yunusabad", "chilanzar"] }).district).toBe("yunusabad");
  });

  it("builds canonical links without defaults", () => {
    expect(radarHref("ru")).toBe("/ru/app/radar");
    expect(radarHref("uz", { status: "active", district: "sergeli", q: "2 xonali" })).toBe(
      "/uz/app/radar?district=sergeli&q=2+xonali",
    );
    expect(convertHref("ru", "tg-01")).toBe("/ru/app/properties/new?fromTelegram=tg-01");
  });

  it("round-trips through the URL", () => {
    const params = parseRadarParams({ district: "mirabad", dealType: "sale", status: "hidden", q: "дом" });
    const url = new URL(radarHref("ru", params), "https://binor.test");
    expect(parseRadarParams(Object.fromEntries(url.searchParams))).toEqual(params);
    expect(hasRadarFilters(params)).toBe(true);
    expect(hasRadarFilters(parseRadarParams({}))).toBe(false);
  });

  it("keeps hidden posts out of the default view and passes real statuses to the repository", () => {
    const view = { post: post("tg-10") } as TelegramListingView;
    expect(view.post.status).toBe("hidden");
    expect(keepByStatus(view, "active")).toBe(false);
    expect(keepByStatus(view, "hidden")).toBe(true);
    expect(toTelegramFilter(parseRadarParams({}))).toEqual({});
    expect(toTelegramFilter(parseRadarParams({ status: "saved", district: "chilanzar" }))).toEqual({
      status: "saved",
      district: "chilanzar",
    });
  });
});

describe("parse confidence", () => {
  it("grades single fields and treats low confidence as not usable", () => {
    const p = post("tg-04").parsed;
    expect(confidenceLevel(p.dealType)).toBe("high");
    expect(confidenceLevel(p.rooms)).toBe("medium");
    // "Госпиталка" is a colloquial name read as Mirabad with 0.4: shown, but Unknown for work.
    expect(confidenceLevel(p.district)).toBe("low");
    expect(confidenceLevel(p.price)).toBe("none");
    expect(postFacts(p).district).toBeUndefined();
  });

  it("summarizes a well-formed post as high and an ambiguous one as low", () => {
    expect(parseQuality(post("tg-01").parsed)).toMatchObject({ recognized: 9, total: 9, level: "high" });
    const vague = parseQuality(post("tg-04").parsed);
    expect(vague.recognized).toBe(4);
    expect(vague.level).toBe("low");
  });

  it("does not penalize a house for having no floor, or an office for having no rooms", () => {
    expect(relevantFields(post("tg-06").parsed)).not.toContain("floor");
    expect(relevantFields(post("tg-11").parsed)).not.toContain("rooms");
    expect(parseQuality(post("tg-06").parsed).level).toBe("high");
  });

  it("reports nothing recognized for empty text", () => {
    const { parsed } = analyzeTelegramPost("");
    expect(parseQuality(parsed)).toMatchObject({ recognized: 0, level: "none" });
  });
});

describe("values and facts", () => {
  it("formats values in both languages without inventing missing ones", () => {
    const p = post("tg-02").parsed;
    expect(formatParsedValue("ru", p, "district", labels)).toBe("Юнусабад");
    expect(formatParsedValue("uz", p, "district", { ...labels, dealType: domain.uz.dealType })).toBe("Yunusobod");
    expect(formatParsedValue("ru", p, "price", labels)).toBe("$102 000".replace(" ", " "));
    expect(formatParsedValue("ru", p, "phone", labels)).toBe("+998 90 000 52 02");
    expect(formatParsedValue("ru", p, "floor", labels)).toBe("5 этаж");
    expect(formatParsedValue("ru", post("tg-03").parsed, "areaTotal", labels)).toBeUndefined();
  });

  it("builds a subscription only from confident facts", () => {
    expect(subscriptionFacts(postFacts(post("tg-01").parsed))).toEqual({
      dealType: "sale",
      propertyType: "apartment",
      district: "chilanzar",
      rooms: 2,
    });
    // tg-20: the deal type is only 0.5 — not part of the subscription.
    expect(subscriptionFacts(postFacts(post("tg-20").parsed)).dealType).toBeUndefined();
  });

  it("cuts long text on a word boundary", () => {
    const text = post("tg-01").rawText;
    const short = excerpt(text, 60);
    expect(short.endsWith("…")).toBe(true);
    expect(short.length).toBeLessThanOrEqual(61);
    expect(short).not.toMatch(/\n/);
    expect(excerpt("Коротко")).toBe("Коротко");
  });
});

describe("Copilot helpers", () => {
  it("recognizes public post links only", () => {
    expect(parseTelegramLink("https://t.me/tashkent_kvartiry_demo/4812")).toEqual({
      handle: "tashkent_kvartiry_demo",
      messageId: 4812,
      url: "https://t.me/tashkent_kvartiry_demo/4812",
    });
    expect(parseTelegramLink("t.me/toshkent_uyjoy_demo/2231?single")?.url).toBe(
      "https://t.me/toshkent_uyjoy_demo/2231",
    );
    expect(parseTelegramLink("https://t.me/c/123456/78")).toBeUndefined();
    expect(parseTelegramLink("Продаётся квартира")).toBeUndefined();
    expect(looksLikeLink(" https://t.me/x/1 ")).toBe(true);
    expect(looksLikeLink("Продаётся t.me/x/1")).toBe(false);
  });

  it("finds the original of a pasted repost as a duplicate candidate, using confident fields only", () => {
    const text =
      "Продаётся 2-комн. квартира, Чиланзар-6, рядом с метро Новза. 3/4 этаж, 54 м², с ремонтом. 67 500 $. Тел: +998 97 000 51 01";
    const draft = draftDedupRecord(analyzeTelegramPost(text).parsed, text);
    expect(draft).toMatchObject({ district: "chilanzar", rooms: 2, floor: 3, areaTotal: 54, dealType: "sale" });
    const pool = seed.telegramListings.map((item) => ({
      id: item.id,
      phone: item.parsed.phone.value,
      district: item.parsed.district.confidence >= 0.6 ? item.parsed.district.value : undefined,
      rooms: item.parsed.rooms.value,
      areaTotal: item.parsed.areaTotal.value,
      floor: item.parsed.floor.value,
      price: item.parsed.price.value,
      text: item.rawText,
    }));
    const candidates = findDuplicateCandidates(draft, pool);
    expect(
      candidates
        .slice(0, 2)
        .map((candidate) => candidate.id)
        .sort(),
    ).toEqual(["tg-01", "tg-07"]);
    expect(candidates[0].signals).toContain("same_phone");
  });

  it("never lets a low-confidence field into the dedup record", () => {
    const parsed = post("tg-04").parsed as ParsedListingFields;
    expect(draftDedupRecord(parsed, "x").district).toBeUndefined();
  });
});
