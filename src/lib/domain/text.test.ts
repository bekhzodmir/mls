import { describe, expect, it } from "vitest";
import {
  decimalString,
  evidenceOf,
  foldText,
  maskSpans,
  MASK_CHAR,
  parseDecimal,
  scaleDecimal,
  scanDistricts,
  scanLandmarks,
  scanMoney,
  scanPhones,
  scanRooms,
} from "./text";

describe("foldText", () => {
  it("is length-preserving so spans map onto the original", () => {
    const original = "Ёлки — Mirzo Ulug‘bek, ta’mirli\u00a02–3 КОМНАТЫ";
    const folded = foldText(original);
    expect(folded).toHaveLength(original.length);
    expect(folded).toBe("елки - mirzo ulug'bek, ta'mirli 2-3 комнаты");
  });

  it("unifies every apostrophe variant used for o‘ / g‘ / tutuq belgisi", () => {
    for (const variant of ["so‘m", "so’m", "soʻm", "soʼm", "so`m", "so'm"]) {
      expect(foldText(variant)).toBe("so'm");
    }
  });
});

describe("parseDecimal / scaleDecimal", () => {
  it.each([
    ["85 000", "85000"],
    ["85.000", "85000"],
    ["85,000", "85000"],
    ["1 200 000", "1200000"],
    ["1,5", "1.5"],
    ["54.50", "54.5"],
    ["007", "7"],
  ])("%s → %s", (raw, expected) => {
    const parsed = parseDecimal(raw);
    expect(parsed && decimalString(parsed)).toBe(expected);
  });

  it("moves the decimal point exactly instead of multiplying floats", () => {
    expect(decimalString(scaleDecimal({ int: "1", frac: "2" }, 9))).toBe("1200000000");
    expect(decimalString(scaleDecimal({ int: "0", frac: "07" }, 3))).toBe("70");
    expect(decimalString(scaleDecimal({ int: "1", frac: "2345" }, 3))).toBe("1234.5");
  });

  it("rejects malformed numbers", () => {
    expect(parseDecimal("1.2.3")).toBeUndefined();
  });
});

describe("maskSpans / evidenceOf", () => {
  it("masks without changing length and keeps evidence verbatim", () => {
    const text = "до 100 000 $ и 2 комнаты";
    const masked = maskSpans(text, [{ start: 3, end: 12 }]);
    expect(masked).toHaveLength(text.length);
    expect(masked.slice(3, 12)).toBe(MASK_CHAR.repeat(9));
    expect(evidenceOf(text, [{ start: 15, end: 24 }, { start: 3, end: 12 }, { start: 3, end: 12 }])).toBe(
      "100 000 $ | 2 комнаты",
    );
    expect(evidenceOf(text, [])).toBeUndefined();
  });
});

describe("scanMoney", () => {
  const one = (text: string) => {
    const hits = scanMoney(foldText(text));
    expect(hits).toHaveLength(1);
    return hits[0];
  };

  it.each([
    ["85 000 $", "85000", "USD"],
    ["$85 000", "85000", "USD"],
    ["85 000 у.е.", "85000", "USD"],
    ["32 000 долларов", "32000", "USD"],
    ["90 ming dollar", "90000", "USD"],
    ["85k$", "85000", "USD"],
    ["100 тыс. долл.", "100000", "USD"],
    ["850 млн сум", "850000000", "UZS"],
    ["1,2 млрд сум", "1200000000", "UZS"],
    ["4 500 000 so‘m", "4500000", "UZS"],
    ["5 mln so'm", "5000000", "UZS"],
    ["500 минг сўм", "500000", "UZS"],
  ])("%s → %s %s", (text, amount, currency) => {
    const hit = one(text);
    expect(decimalString(hit.amount)).toBe(amount);
    expect(hit.currency).toBe(currency);
  });

  it("reads thousands separated by no-break or narrow spaces", () => {
    expect(decimalString(one("85 000 $").amount)).toBe("85000");
    expect(decimalString(one("1 200 000 сум").amount)).toBe("1200000");
  });

  it("never invents a currency", () => {
    const hit = one("до 70 000");
    expect(hit.currency).toBeUndefined();
    expect(hit.bound).toBe("max");
  });

  it("reads bound words and Uzbek suffixes", () => {
    expect(one("не дороже 100к").bound).toBe("max");
    expect(one("от 50 000 $").bound).toBe("min");
    expect(one("500$ gacha").bound).toBe("max");
    expect(one("90 ming dollargacha").bound).toBe("max");
    expect(one("50 ming dollardan").bound).toBe("min");
    expect(one("70 000 dollardan oshmasin").bound).toBe("max");
  });

  it("shares the multiplier and currency across a range", () => {
    const [min, max] = scanMoney(foldText("от 80 до 100 тыс $"));
    expect(decimalString(min.amount)).toBe("80000");
    expect(min.currency).toBe("USD");
    expect(min.bound).toBe("min");
    expect(max.bound).toBe("max");
    expect(min.range).toEqual(max.range);
  });

  it("ignores numbers that are not money", () => {
    expect(scanMoney(foldText("Юнусабад-19, 5 минут до метро, сдача 2025, 3 этаж"))).toEqual([]);
  });

  it("flags per-m² and auxiliary amounts", () => {
    expect(one("от 700$ за м²").perUnit).toBe(true);
    expect(one("депозит 1000$").auxiliary).toBe(true);
    expect(one("150$/мес").perUnit).toBe(false);
  });
});

describe("scanPhones", () => {
  it.each([
    ["+998 90 123 45 67", "+998901234567"],
    ["+998901234567", "+998901234567"],
    ["998 (93) 111-22-33", "+998931112233"],
    ["(90) 123-45-67", "+998901234567"],
    ["tel 90 555 12 34", "+998905551234"],
    ["901234567", "+998901234567"],
  ])("%s → %s", (text, e164) => {
    expect(scanPhones(foldText(text)).map((hit) => hit.e164)).toEqual([e164]);
  });

  it("does not read 9-digit prices as phones", () => {
    expect(scanPhones(foldText("850000000 сум"))).toEqual([]);
    expect(scanPhones(foldText("901234567 сум"))).toEqual([]);
  });
});

describe("scanDistricts", () => {
  it("skips a district name used as a metro station", () => {
    const text = "у метро Чиланзар";
    const folded = foldText(text);
    expect(scanLandmarks(text, folded).map((hit) => hit.text)).toEqual(["метро Чиланзар"]);
    expect(scanDistricts(folded)).toEqual([]);
  });
});

describe("scanRooms", () => {
  it("marks colloquial names as apartments", () => {
    const [hit] = scanRooms(foldText("трёшка"));
    expect(hit).toMatchObject({ min: 3, max: 3, apartment: true });
  });

  it("rejects implausible counts and quarter numbers", () => {
    expect(scanRooms(foldText("Юнусабад-19, 3 комнаты"))).toEqual([
      expect.objectContaining({ min: 3, max: 3 }),
    ]);
    expect(scanRooms(foldText("25 комнат"))).toEqual([]);
  });
});
