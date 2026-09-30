import { describe, expect, it } from "vitest";
import { formatUzPhone, maskUzPhone, normalizeUzPhone, telHref } from "./phone";

describe("normalizeUzPhone", () => {
  it("normalizes the spellings seen in posts and calls to E.164", () => {
    const variants = [
      "+998 90 174 54 55",
      "+998901745455",
      "998901745455",
      "+998 (90) 174-54-55",
      "90 174 54 55",
      "901745455",
      "(90) 174-54-55",
      "8 90 174 54 55",
      "8-90-174-54-55",
      " +998 90 174 54 55 ",
    ];
    for (const raw of variants) expect(normalizeUzPhone(raw), raw).toBe("+998901745455");
  });

  it("accepts landline and other operator codes", () => {
    expect(normalizeUzPhone("71 200 00 00")).toBe("+998712000000");
    expect(normalizeUzPhone("+998 33 123 45 67")).toBe("+998331234567");
  });

  it("returns null instead of guessing", () => {
    for (const raw of [
      "",
      "12345",
      "+7 912 345 67 89", // 11 digits, another country
      "+998 90 174 54 5", // too short
      "+998 90 174 54 555", // too long
      "+998 09 174 54 55", // operator code cannot start with 0
      "0901745455", // 10 digits not starting with 8
      "+1 998 901 745 455",
      "телефон в личке",
    ]) {
      expect(normalizeUzPhone(raw), raw).toBeNull();
    }
  });
});

describe("formatUzPhone / maskUzPhone / telHref", () => {
  it("formats in the local grouping", () => {
    expect(formatUzPhone("+998901745455")).toBe("+998 90 174 54 55");
    expect(formatUzPhone("90-174-54-55")).toBe("+998 90 174 54 55");
    // Unrecognised input is shown as typed, never rewritten into a wrong number.
    expect(formatUzPhone("12345")).toBe("12345");
  });

  it("masks all but the operator code and the last two digits", () => {
    expect(maskUzPhone("+998901745455")).toBe("+998 90 *** ** 55");
    expect(maskUzPhone("8 90 174 54 55")).toBe("+998 90 *** ** 55");
    expect(maskUzPhone("garbage")).toBe("••• •• ••");
    expect(maskUzPhone("+998901745455")).not.toContain("174");
  });

  it("builds tel: links", () => {
    expect(telHref("90 174 54 55")).toBe("tel:+998901745455");
    expect(telHref("+7 (912) 345-67-89")).toBe("tel:+79123456789");
  });
});
