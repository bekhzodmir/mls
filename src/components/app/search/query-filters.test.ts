import { describe, expect, it } from "vitest";
import { interpretQuery, isPhoneLikeQuery, withCurrency } from "./query-filters";

function kinds(query: string) {
  return interpretQuery(query)?.criteria.map(({ criterion, applied }) => [criterion.kind, applied]);
}

describe("isPhoneLikeQuery", () => {
  it("recognizes phone fragments of four digits or more", () => {
    expect(isPhoneLikeQuery("+998 90")).toBe(true);
    expect(isPhoneLikeQuery("(90) 000-01")).toBe(true);
    expect(isPhoneLikeQuery("123")).toBe(false);
    expect(isPhoneLikeQuery("до 70 000")).toBe(false);
  });
});

describe("interpretQuery", () => {
  it("returns nothing for empty, name, id and phone queries", () => {
    expect(interpretQuery("")).toBeUndefined();
    expect(interpretQuery("   ")).toBeUndefined();
    expect(interpretQuery("Гульнара")).toBeUndefined();
    expect(interpretQuery("lst-01")).toBeUndefined();
    // A phone fragment is not a budget of 99 890.
    expect(interpretQuery("+998 90")).toBeUndefined();
  });

  it("does not throw on an amount too large to be a budget", () => {
    expect(() => interpretQuery("до 100000 млрд")).not.toThrow();
    expect(interpretQuery("до 100000 млрд")).toBeUndefined();
    expect(kinds("2 комнаты до 100000000000000 сум")).toEqual([["rooms", true]]);
  });

  it("never guesses the currency: the amount waits for an explicit choice (§35.5)", () => {
    const result = interpretQuery("Чиланзар 2 комнаты до 70 000");
    expect(result?.params).toEqual({ district: "chilanzar", roomsMin: "2", roomsMax: "2" });
    expect(result?.currencyChoice).toEqual({ maxMinor: 7_000_000 });
    expect(kinds("Чиланзар 2 комнаты до 70 000")).toEqual([
      ["district", true],
      ["rooms", true],
      ["amount", false],
    ]);
    // "2 комнаты" alone only hints at an apartment (confidence 0.5): no type filter.
    expect(result?.params.propertyType).toBeUndefined();
  });

  it("applies the price ceiling when the currency is named", () => {
    const result = interpretQuery("аренда 2 комнаты Мирабад до 6 млн сум");
    expect(result?.params).toEqual({
      dealType: "rent",
      district: "mirabad",
      roomsMin: "2",
      roomsMax: "2",
      priceMax: "6000000",
      currency: "UZS",
    });
    expect(result?.currencyChoice).toBeUndefined();
  });

  it("reads Uzbek queries the same way", () => {
    expect(interpretQuery("Mirobodda ijara 2 xonali 6 mln so‘mgacha")?.params).toEqual({
      dealType: "rent",
      district: "mirabad",
      roomsMin: "2",
      roomsMax: "2",
      priceMax: "6000000",
      currency: "UZS",
    });
    expect(interpretQuery("Yunusobod yangi bino 3 xonali")?.params).toEqual({
      propertyType: "apartment",
      district: "yunusabad",
      roomsMin: "3",
      roomsMax: "3",
    });
  });

  it("shows criteria the list cannot filter by as not applied", () => {
    expect(kinds("новостройка 3 комнаты Юнусабад")).toEqual([
      ["propertyType", true],
      ["district", true],
      ["rooms", true],
      ["buildingKind", false],
    ]);
    expect(kinds("квартира у метро Космонавтов")).toEqual([
      ["propertyType", true],
      ["extras", false],
    ]);
    expect(kinds("ипотека 3 комнаты 70-90 м2 не первый этаж")).toEqual([
      ["dealType", true],
      ["rooms", true],
      ["area", false],
      ["floor", false],
      ["mortgage", false],
    ]);
  });

  it("does not filter by one district when the client named several", () => {
    const result = interpretQuery("Юнусабад или Мирабад");
    expect(result?.params.district).toBeUndefined();
    expect(result?.criteria).toEqual([{ criterion: { kind: "district", value: ["yunusabad", "mirabad"] }, applied: false }]);
  });

  it("keeps a lower bound visible but unapplied: the list has no minimum price filter", () => {
    const result = interpretQuery("от 50 000$ 2-3 комнаты");
    expect(result?.params).toEqual({ roomsMin: "2", roomsMax: "3" });
    expect(kinds("от 50 000$ 2-3 комнаты")).toEqual([
      ["rooms", true],
      ["budget", false],
    ]);
  });
});

describe("withCurrency", () => {
  it("adds the chosen currency and ceiling without touching the other filters", () => {
    const params = { district: "chilanzar", roomsMin: "2" };
    expect(withCurrency(params, { maxMinor: 7_000_000 }, "USD")).toEqual({ ...params, priceMax: "70000", currency: "USD" });
    expect(params).toEqual({ district: "chilanzar", roomsMin: "2" });
  });
});
