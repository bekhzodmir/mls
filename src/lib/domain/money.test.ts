import { describe, expect, it } from "vitest";
import {
  addMoney,
  compareMoney,
  convertMoney,
  formatMoney,
  formatMoneyRange,
  money,
  percentOf,
  subtractMoney,
  toMajor,
  toMinor,
  type FxRates,
} from "./money";

/** Intl uses no-break spaces as group separators; compare on plain spaces. */
const plain = (text: string | undefined) => text?.replace(/\s/g, " ");

describe("toMinor", () => {
  it("converts decimal strings exactly", () => {
    expect(toMinor("85000")).toBe(8_500_000);
    expect(toMinor("1234.5")).toBe(123_450);
    expect(toMinor("1234,56")).toBe(123_456);
    expect(toMinor(" 12.34 ")).toBe(1_234);
    expect(toMinor("0.1")).toBe(10);
  });

  it("is free of float drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in floating point.
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(0.1) + toMinor(0.2)).toBe(toMinor("0.3"));
    expect(toMinor(1.1 * 3)).toBe(330);
    expect(toMinor(19.99)).toBe(1_999);
    expect(toMinor(1234567.89)).toBe(123_456_789);
  });

  it("rounds a third decimal half-up (away from zero for negatives)", () => {
    expect(toMinor("0.004")).toBe(0);
    expect(toMinor("0.005")).toBe(1);
    expect(toMinor("0.995")).toBe(100);
    expect(toMinor("2.3449")).toBe(234);
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor("-1.005")).toBe(-101);
    expect(toMinor(-12.5)).toBe(-1_250);
  });

  it("rejects anything that is not a plain decimal amount", () => {
    for (const bad of ["", "abc", "1e5", "12.", ".5", "1 000", "$85", "1.2.3"]) {
      expect(() => toMinor(bad), bad).toThrow(RangeError);
    }
    expect(() => toMinor(Number.NaN)).toThrow(RangeError);
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => toMinor(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });
});

describe("money / arithmetic", () => {
  it("keeps the raw text only when given", () => {
    expect(money("85000", "USD")).toEqual({ amountMinor: 8_500_000, currency: "USD" });
    expect(money(85_000, "USD", "85 000$")).toEqual({ amountMinor: 8_500_000, currency: "USD", raw: "85 000$" });
    expect(toMajor(money("1234.5", "UZS"))).toBe(1234.5);
  });

  it("adds, subtracts and compares within one currency only", () => {
    expect(addMoney(money(0.1, "USD"), money(0.2, "USD"))).toEqual(money("0.3", "USD"));
    expect(subtractMoney(money(100, "USD"), money(0.01, "USD"))).toEqual({ amountMinor: 9_999, currency: "USD" });
    expect(compareMoney(money(1, "USD"), money(2, "USD"))).toBe(-1);
    expect(compareMoney(money(2, "USD"), money(2, "USD"))).toBe(0);
    expect(compareMoney(money(3, "USD"), money(2, "USD"))).toBe(1);
    expect(() => addMoney(money(1, "USD"), money(1, "UZS"))).toThrow(TypeError);
    expect(() => compareMoney(money(1, "USD"), money(1, "UZS"))).toThrow(TypeError);
  });
});

describe("percentOf", () => {
  it("rounds half-up to the minor unit", () => {
    expect(percentOf(money(85_000, "USD"), 3)).toEqual(money(2_550, "USD"));
    expect(percentOf({ amountMinor: 12_345, currency: "USD" }, 12.5)).toEqual({ amountMinor: 1_543, currency: "USD" });
    expect(percentOf({ amountMinor: 1, currency: "USD" }, 50)).toEqual({ amountMinor: 1, currency: "USD" });
    expect(percentOf(money(1_000, "UZS"), 0)).toEqual({ amountMinor: 0, currency: "UZS" });
  });

  it("handles two-decimal percentages", () => {
    expect(percentOf(money(10_000, "USD"), 1.25)).toEqual(money(125, "USD"));
  });
});

describe("convertMoney", () => {
  const rates: FxRates = { uzsPerUsd: 12_700, asOf: "test" };

  it("converts with an explicit rate and returns the same object for the same currency", () => {
    expect(convertMoney(money(100, "USD"), "UZS", rates)).toEqual(money(1_270_000, "UZS"));
    expect(convertMoney(money(1_270_000, "UZS"), "USD", rates)).toEqual(money(100, "USD"));
    const usd = money(5, "USD");
    expect(convertMoney(usd, "USD", rates)).toBe(usd);
  });

  it("rounds to the nearest minor unit", () => {
    // 1 000 so‘m / 12 700 = $0.0787… → 8 cents.
    expect(convertMoney(money(1_000, "UZS"), "USD", rates)).toEqual({ amountMinor: 8, currency: "USD" });
  });
});

describe("formatMoney", () => {
  it("formats USD with a leading $ and grouped digits", () => {
    expect(plain(formatMoney("ru", money(85_000, "USD")))).toBe("$85 000");
    expect(plain(formatMoney("uz", money(85_000, "USD")))).toBe("$85 000");
  });

  it("formats UZS with a localized suffix (so‘m with U+2018)", () => {
    expect(plain(formatMoney("ru", money(4_500_000, "UZS")))).toBe("4 500 000 сум");
    expect(plain(formatMoney("uz", money(4_500_000, "UZS")))).toBe("4 500 000 so‘m");
  });

  it("shows fractions only when present", () => {
    expect(plain(formatMoney("ru", money("1234.5", "USD")))).toBe("$1 234,5");
    expect(plain(formatMoney("ru", money("1234.56", "USD")))).toBe("$1 234,56");
    expect(plain(formatMoney("uz", money(1234, "USD")))).toBe("$1 234");
  });

  it("uses a real minus sign and an optional plus sign", () => {
    expect(plain(formatMoney("ru", money(-8_000, "USD")))).toBe("−$8 000");
    expect(plain(formatMoney("ru", money(8_000, "USD"), { signed: true }))).toBe("+$8 000");
    expect(plain(formatMoney("ru", money(0, "USD"), { signed: true }))).toBe("$0");
  });

  it("has compact forms for chips", () => {
    expect(plain(formatMoney("ru", money(85_000, "USD"), { compact: true }))).toBe("$85 тыс.");
    expect(plain(formatMoney("uz", money(85_000, "USD"), { compact: true }))).toBe("$85 ming");
  });

  it("formats ranges with templates for open ends", () => {
    const words = { from: "от {amount}", to: "до {amount}" };
    expect(plain(formatMoneyRange("ru", { min: money(70_000, "USD"), max: money(95_000, "USD") }, words))).toBe(
      "$70 000 – $95 000",
    );
    expect(plain(formatMoneyRange("ru", { max: money(95_000, "USD") }, words))).toBe("до $95 000");
    expect(plain(formatMoneyRange("ru", { min: money(70_000, "USD") }, words))).toBe("от $70 000");
    expect(formatMoneyRange("ru", {}, words)).toBeUndefined();
  });

  it("puts the Uzbek postposition after the amount", () => {
    const words = { from: "kamida {amount}", to: "{amount} gacha" };
    expect(plain(formatMoneyRange("uz", { max: money(95_000, "USD") }, words))).toBe("$95 000 gacha");
    expect(plain(formatMoneyRange("uz", { min: money(70_000, "USD") }, words))).toBe("kamida $70 000");
  });
});
