import { describe, expect, it } from "vitest";
import { parseAmount } from "./amount";
import {
  activeFilters,
  parsePropertyListParams,
  pendingPrice,
  propertyListHref,
  roomsChoiceActive,
  toListingFilter,
  withoutAllFilters,
  withoutFilter,
  withRoomsChoice,
} from "./filters";

describe("parseAmount", () => {
  it("accepts amounts as people type them", () => {
    expect(parseAmount("70000")).toBe(70000);
    expect(parseAmount("70 000")).toBe(70000);
    expect(parseAmount("70 000")).toBe(70000);
    expect(parseAmount("70000,5")).toBe(70000.5);
    expect(parseAmount("70000.25")).toBe(70000.25);
  });

  it("rejects anything it would have to guess", () => {
    expect(parseAmount(undefined)).toBeUndefined();
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("0")).toBeUndefined();
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("70k")).toBeUndefined();
    expect(parseAmount("1.234")).toBeUndefined();
    expect(parseAmount("1e6")).toBeUndefined();
  });
});

describe("parsePropertyListParams", () => {
  it("defaults to all listings as a list", () => {
    expect(parsePropertyListParams({})).toEqual({ scope: "all", view: "list" });
  });

  it("keeps valid values and drops invalid ones instead of guessing", () => {
    const params = parsePropertyListParams({
      scope: "mine",
      dealType: "sale",
      propertyType: "villa",
      district: "chilanzar",
      roomsMin: "2",
      roomsMax: "abc",
      priceMax: "80 000",
      currency: "EUR",
      freshness: "needs_confirmation",
      source: "telegram",
      status: "active_mls",
      view: "map",
      q: "  Новза ",
    });
    expect(params).toEqual({
      scope: "mine",
      view: "list",
      dealType: "sale",
      district: "chilanzar",
      roomsMin: 2,
      priceMax: 80000,
      freshness: "needs_confirmation",
      source: "telegram",
      status: "active_mls",
      q: "Новза",
    });
  });

  it("takes the first value of repeated params and swaps a reversed room range", () => {
    const params = parsePropertyListParams({ dealType: ["rent", "sale"], roomsMin: "4", roomsMax: "2" });
    expect(params.dealType).toBe("rent");
    expect(params.roomsMin).toBe(2);
    expect(params.roomsMax).toBe(4);
  });
});

describe("price and currency", () => {
  it("applies a price ceiling only with an explicit currency", () => {
    const withoutCurrency = parsePropertyListParams({ priceMax: "80000" });
    expect(pendingPrice(withoutCurrency)).toBe(80000);
    expect(toListingFilter(withoutCurrency).priceMax).toBeUndefined();
    expect(activeFilters(withoutCurrency)).toEqual([]);

    const withCurrency = parsePropertyListParams({ priceMax: "80000", currency: "USD" });
    expect(pendingPrice(withCurrency)).toBeUndefined();
    expect(toListingFilter(withCurrency)).toMatchObject({ priceMax: 80000, currency: "USD" });
    expect(activeFilters(withCurrency)).toEqual(["price"]);
  });

  it("treats a currency on its own as its own filter", () => {
    const params = parsePropertyListParams({ currency: "UZS" });
    expect(activeFilters(params)).toEqual(["currency"]);
    expect(toListingFilter(params)).toEqual({ scope: "all", currency: "UZS" });
  });
});

describe("filter editing", () => {
  const base = parsePropertyListParams({
    scope: "mls",
    view: "districts",
    dealType: "sale",
    roomsMin: "2",
    roomsMax: "3",
    priceMax: "90000",
    currency: "USD",
    freshness: "fresh",
  });

  it("lists active filters in a stable order, without scope and view", () => {
    expect(activeFilters(base)).toEqual(["dealType", "rooms", "price", "freshness"]);
  });

  it("removes one filter group at a time", () => {
    expect(withoutFilter(base, "rooms")).not.toHaveProperty("roomsMin");
    expect(withoutFilter(base, "rooms")).not.toHaveProperty("roomsMax");
    const noPrice = withoutFilter(base, "price");
    expect(noPrice).not.toHaveProperty("priceMax");
    expect(noPrice).not.toHaveProperty("currency");
    expect(withoutFilter(base, "dealType").dealType).toBeUndefined();
  });

  it("keeps scope and view when resetting all filters", () => {
    expect(withoutAllFilters(base)).toEqual({ scope: "mls", view: "districts" });
  });

  it("toggles quick room chips", () => {
    const two = withRoomsChoice(base, 2);
    expect([two.roomsMin, two.roomsMax]).toEqual([2, 2]);
    expect(roomsChoiceActive(two, 2)).toBe(true);
    expect(withRoomsChoice(two, 2).roomsMin).toBeUndefined();
    const four = withRoomsChoice(base, 4);
    expect([four.roomsMin, four.roomsMax]).toEqual([4, undefined]);
    expect(roomsChoiceActive(four, 4)).toBe(true);
  });
});

describe("propertyListHref", () => {
  it("omits defaults and keeps a stable key order", () => {
    expect(propertyListHref("ru", { scope: "all", view: "list" })).toBe("/ru/app/properties");
    expect(
      propertyListHref("uz", {
        scope: "mine",
        view: "districts",
        district: "yunusabad",
        priceMax: 80000,
        currency: "USD",
        dealType: "sale",
      }),
    ).toBe("/uz/app/properties?scope=mine&dealType=sale&district=yunusabad&priceMax=80000&currency=USD&view=districts");
  });

  it("round-trips through the parser", () => {
    const params = parsePropertyListParams({ scope: "agency", q: "ЖК Demo", roomsMin: "4", status: "expired" });
    const url = new URL(propertyListHref("ru", params), "https://binor.test");
    expect(parsePropertyListParams(Object.fromEntries(url.searchParams))).toEqual(params);
  });
});
