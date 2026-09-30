import { describe, expect, it } from "vitest";
import { analyzeTelegramPost, extractPhones, parseTelegramPost, POST_PARSER_VERSION } from "./post-parser";
import type { ParsedListingFields } from "./types";

const usd = (major: number) => major * 100;
const uzs = (major: number) => major * 100;

describe("reference posts (§13.2, §35.5)", () => {
  it("parses the Russian example with evidence for every field", () => {
    const text =
      "Продаётся 3-комн. квартира, Юнусабад-19, 4/9 этаж, 78 м², евроремонт, 85 000 $. Тел: +998 90 123 45 67";
    const { parsed, warnings, parserVersion } = analyzeTelegramPost(text);
    expect(parserVersion).toBe(POST_PARSER_VERSION);
    expect(warnings).toEqual([]);
    expect(parsed).toEqual({
      dealType: { value: "sale", confidence: 0.95, evidence: "Продаётся" },
      propertyType: { value: "apartment", confidence: 0.9, evidence: "квартира" },
      district: { value: "yunusabad", confidence: 0.9, evidence: "Юнусабад" },
      rooms: { value: 3, confidence: 0.9, evidence: "3-комн." },
      areaTotal: { value: 78, confidence: 0.85, evidence: "78 м²" },
      floor: { value: 4, confidence: 0.9, evidence: "4/9 этаж" },
      floorsTotal: { value: 9, confidence: 0.9, evidence: "4/9 этаж" },
      price: {
        value: { amountMinor: usd(85_000), currency: "USD", raw: "85 000 $" },
        confidence: 0.9,
        evidence: "85 000 $",
      },
      phone: { value: "+998901234567", confidence: 0.95, evidence: "+998 90 123 45 67" },
    } satisfies ParsedListingFields);
  });

  it("parses the Uzbek example", () => {
    const parsed = parseTelegramPost(
      "Sotiladi! Chilonzor 9-kvartal, 2 xonali, 3/4 qavat, 54 m², 58 000 $, tel 90 555 12 34",
    );
    expect(parsed.dealType).toMatchObject({ value: "sale", evidence: "Sotiladi" });
    expect(parsed.district).toMatchObject({ value: "chilanzar", evidence: "Chilonzor" });
    expect(parsed.rooms).toMatchObject({ value: 2, evidence: "2 xonali" });
    expect(parsed.floor).toMatchObject({ value: 3, evidence: "3/4 qavat" });
    expect(parsed.floorsTotal.value).toBe(4);
    expect(parsed.areaTotal).toMatchObject({ value: 54, evidence: "54 m²" });
    expect(parsed.price.value).toEqual({ amountMinor: usd(58_000), currency: "USD", raw: "58 000 $" });
    expect(parsed.phone).toMatchObject({ value: "+998905551234", evidence: "90 555 12 34" });
    // "2 xonali" and "3/4 qavat" only hint at an apartment.
    expect(parsed.propertyType).toMatchObject({ value: "apartment", confidence: 0.6 });
  });

  it("parses an Uzbek rent post", () => {
    const parsed = parseTelegramPost(
      "Ijaraga beriladi 2 xonali kvartira, Yunusobod 11-kvartal, 4/9 qavat, oyiga 450$, +998 99 876 54 32",
    );
    expect(parsed.dealType).toMatchObject({ value: "rent", confidence: 0.95 });
    expect(parsed.propertyType.value).toBe("apartment");
    expect(parsed.district.value).toBe("yunusabad");
    expect(parsed.price.value?.amountMinor).toBe(usd(450));
    expect(parsed.phone.value).toBe("+998998765432");
  });
});

describe("empty input", () => {
  it.each(["", "   ", "\n"])("%j → every field unknown", (text) => {
    const { parsed, warnings } = analyzeTelegramPost(text);
    expect(warnings).toEqual(["empty_text"]);
    for (const field of Object.values(parsed)) expect(field).toEqual({ confidence: 0 });
  });

  it("a post without facts stays unknown without warnings", () => {
    const { parsed, warnings } = analyzeTelegramPost("Доброе утро! Подписывайтесь на канал 👍");
    expect(warnings).toEqual([]);
    for (const field of Object.values(parsed)) expect(field.value).toBeUndefined();
  });
});

describe("deal type", () => {
  it.each([
    ["Продаётся квартира", "sale"],
    ["Продается квартира", "sale"],
    ["Срочно продаю", "sale"],
    ["Sotiladi", "sale"],
    ["Сдаётся квартира", "rent"],
    ["Сдаю 2х комн", "rent"],
    ["Аренда офиса", "rent"],
    ["Ijaraga beriladi", "rent"],
    ["посуточно", "rent"],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseTelegramPost(text).dealType).toMatchObject({ value: expected, confidence: 0.95 });
  });

  it("uses «в месяц» only as a hint", () => {
    expect(parseTelegramPost("2 комнаты, 400$ в месяц").dealType).toMatchObject({ value: "rent", confidence: 0.6 });
  });

  it("does not read «дом сдан» (building completed) as rent", () => {
    expect(parseTelegramPost("Продаётся квартира, дом сдан в 2023").dealType.value).toBe("sale");
  });

  it("reports a post that both sells and rents out", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаётся или сдаётся квартира");
    expect(parsed.dealType).toEqual({ confidence: 0, evidence: "Продаётся | сдаётся" });
    expect(warnings).toContain("deal_type_conflict");
  });
});

describe("property type", () => {
  it.each([
    ["Продаётся дом в Сергели", "house"],
    ["Sotiladi hovli, 6 sotix", "house"],
    ["дом 150 м², 6 соток", "house"],
    ["Продаётся земельный участок 10 соток", "land"],
    ["Сдаю офис 120 м²", "commercial"],
    ["Сдаётся комната в 3-комнатной квартире", "room"],
    ["Продаётся квартира в кирпичном доме", "apartment"],
    ["Продаю 1к кв на Чиланзаре", "apartment"],
    ["Продаётся двушка", "apartment"],
  ] as const)("%s → %s", (text, expected) => {
    const field = parseTelegramPost(text).propertyType;
    expect(field.value).toBe(expected);
    expect(field.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("names the winning type with lower confidence when several are mentioned", () => {
    expect(parseTelegramPost("Сдаётся комната в квартире").propertyType).toMatchObject({
      value: "room",
      confidence: 0.75,
      evidence: "комната",
    });
  });
});

describe("district", () => {
  it.each([
    ["Юнусабад-19", "yunusabad"],
    ["в Мирабаде", "mirabad"],
    ["Mirzo Ulug‘bek tumani", "mirzo_ulugbek"],
    ["Chilonzor 9-kvartal", "chilanzar"],
    ["Yakkasaroyda", "yakkasaray"],
    ["#Яшнабад #продажа", "yashnabad"],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseTelegramPost(text).district).toMatchObject({ value: expected, confidence: 0.9 });
  });

  it("is unknown when two districts are named", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаётся 2 комн., Чиланзар и Юнусабад");
    expect(parsed.district).toEqual({ confidence: 0, evidence: "Чиланзар | Юнусабад" });
    expect(warnings).toContain("district_conflict");
  });

  it("does not take a metro station for the district", () => {
    const parsed = parseTelegramPost("Сдаётся 2х комн квартира, м. Чиланзар, 400$");
    expect(parsed.district).toEqual({ confidence: 0 });
    expect(parseTelegramPost("Yunusobod, Chilonzor metrosi yaqinida").district.value).toBe("yunusabad");
  });
});

describe("rooms", () => {
  it.each([
    ["3-комн. квартира", 3],
    ["3-х комнатная", 3],
    ["2х комн", 2],
    ["1к кв", 1],
    ["4 комнатная", 4],
    ["2 комнаты", 2],
    ["трёшка", 3],
    ["2 xonali", 2],
    ["ikki xonali", 2],
    ["4 xona", 4],
    ["Комнат: 3", 3],
  ])("%s → %d", (text, expected) => {
    expect(parseTelegramPost(text).rooms).toMatchObject({ value: expected, confidence: 0.9 });
  });

  it("reads the rooms/floor/floors shorthand with lower confidence", () => {
    const parsed = parseTelegramPost("Продаю 3/5/9 Яшнабад");
    expect(parsed.rooms).toEqual({ value: 3, confidence: 0.7, evidence: "3/5/9" });
    expect(parsed.floor).toEqual({ value: 5, confidence: 0.7, evidence: "3/5/9" });
    expect(parsed.floorsTotal).toEqual({ value: 9, confidence: 0.7, evidence: "3/5/9" });
  });

  it("is unknown on contradictory counts", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаётся квартира, 2 комнаты, 3 комнаты");
    expect(parsed.rooms).toEqual({ confidence: 0, evidence: "2 комнаты | 3 комнаты" });
    expect(warnings).toContain("rooms_conflict");
  });

  it("does not pick a count from a developer's range", () => {
    expect(parseTelegramPost("Новостройка, 1-3 комнатные квартиры").rooms).toEqual({
      confidence: 0,
      evidence: "1-3 комнатные",
    });
  });
});

describe("floor and floors total — never guessed", () => {
  it.each([
    ["4/9 этаж", 4, 9],
    ["этаж 4/9", 4, 9],
    ["3/4 qavat", 3, 4],
    ["qavat: 3/4", 3, 4],
    ["4 этаж из 9", 4, 9],
    ["4-й этаж из 9", 4, 9],
    ["1/4 эт", 1, 4],
    ["этаж 7, этажность 9", 7, 9],
    ["4 этаж, 9-этажный дом", 4, 9],
    ["на 4-м этаже 9-ти этажного дома", 4, 9],
    ["9 qavatli uyning 4-qavatida", 4, 9],
  ])("%s → %d of %d", (text, floor, total) => {
    const parsed = parseTelegramPost(text);
    expect(parsed.floor.value).toBe(floor);
    expect(parsed.floorsTotal.value).toBe(total);
    expect(parsed.floor.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("reads a bare fraction as floor/floors at the lowest usable confidence", () => {
    const parsed = parseTelegramPost("Продаётся квартира 2/5, 45 м²");
    expect(parsed.floor).toEqual({ value: 2, confidence: 0.6, evidence: "2/5" });
    expect(parsed.floorsTotal).toEqual({ value: 5, confidence: 0.6, evidence: "2/5" });
  });

  it("ignores fractions that cannot be floors", () => {
    const parsed = parseTelegramPost("охрана 24/7, дом 5/2");
    expect(parsed.floor.value).toBeUndefined();
    expect(parsed.floorsTotal.value).toBeUndefined();
  });

  it("keeps only the floor when the building height is not given", () => {
    const parsed = parseTelegramPost("5 этаж");
    expect(parsed.floor.value).toBe(5);
    expect(parsed.floorsTotal).toEqual({ confidence: 0 });
  });

  it("is unknown when the floor is above the building", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаю квартиру, 5 этаж, 3 этажный дом");
    expect(parsed.floor).toEqual({ confidence: 0, evidence: "5 этаж" });
    expect(parsed.floorsTotal).toEqual({ confidence: 0, evidence: "3 этажный" });
    expect(warnings).toContain("floor_conflict");
  });

  it("is unknown when two floors are given", () => {
    const { parsed, warnings } = analyzeTelegramPost("3 этаж … 4 этаж");
    expect(parsed.floor.value).toBeUndefined();
    expect(warnings).toContain("floor_conflict");
  });

  it("is unknown when absent", () => {
    expect(parseTelegramPost("Продаётся квартира, 78 м², 85 000 $").floor).toEqual({ confidence: 0 });
  });
});

describe("area — never guessed", () => {
  it.each([
    ["78 м²", 78],
    ["78 м2", 78],
    ["36 кв.м", 36],
    ["54 m²", 54],
    ["64,5 кв. м", 64.5],
    ["площадь 110, цена 120 000 $", 110],
    ["S=78", 78],
    ["umumiy maydoni 80 m²", 80],
  ])("%s → %d", (text, expected) => {
    expect(parseTelegramPost(text).areaTotal.value).toBe(expected);
  });

  it("takes the total, not the kitchen or living area", () => {
    const parsed = parseTelegramPost("общая 78 м², жилая 45 м², кухня 12 м²");
    expect(parsed.areaTotal).toEqual({ value: 78, confidence: 0.95, evidence: "78 м²" });
    expect(parseTelegramPost("Площадь 78/45/12 м²").areaTotal.value).toBe(78);
  });

  it("is unknown on two different totals", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаётся квартира 58 м², 65 м²");
    expect(parsed.areaTotal).toEqual({ confidence: 0, evidence: "58 м² | 65 м²" });
    expect(warnings).toContain("area_conflict");
  });

  it("is unknown for «от 45 м²» in a developer post", () => {
    expect(parseTelegramPost("квартиры от 45 м²").areaTotal).toEqual({ confidence: 0, evidence: "45 м²" });
  });

  it("does not read distances, land or absent units as area", () => {
    expect(parseTelegramPost("500 м до метро").areaTotal.value).toBeUndefined();
    expect(parseTelegramPost("участок 600 м²").areaTotal.value).toBeUndefined();
    expect(parseTelegramPost("Чиланзар, 78").areaTotal.value).toBeUndefined();
  });
});

describe("price — the currency is never guessed", () => {
  it.each([
    ["85 000 $", usd(85_000), "USD"],
    ["$85 000", usd(85_000), "USD"],
    ["85000$", usd(85_000), "USD"],
    ["85 000 у.е.", usd(85_000), "USD"],
    ["32 000 долларов", usd(32_000), "USD"],
    ["85k$", usd(85_000), "USD"],
    ["narxi 75 000 $", usd(75_000), "USD"],
    ["850 млн сум", uzs(850_000_000), "UZS"],
    ["1,2 млрд сум", uzs(1_200_000_000), "UZS"],
    ["850 000 000 сум", uzs(850_000_000), "UZS"],
    ["4 500 000 so‘m", uzs(4_500_000), "UZS"],
    ["Narxi: 950 mln so'm", uzs(950_000_000), "UZS"],
  ] as const)("%s → %d %s", (text, amountMinor, currency) => {
    const price = parseTelegramPost(text).price;
    expect(price.value).toMatchObject({ amountMinor, currency });
    expect(price.value?.raw).toBe(price.evidence);
    expect(price.confidence).toBe(0.9);
  });

  it("leaves a currency-less price unknown and warns", () => {
    const { parsed, warnings } = analyzeTelegramPost("Продаётся 2 комн, Чиланзар, 5 этаж, 65 000");
    expect(parsed.price).toEqual({ confidence: 0, evidence: "65 000" });
    expect(warnings).toEqual(["currency_unknown"]);
  });

  it("takes the first currency when a conversion is given", () => {
    const price = parseTelegramPost("60 000$ (760 млн сум)").price;
    expect(price.value).toEqual({ amountMinor: usd(60_000), currency: "USD", raw: "60 000$" });
    expect(price.confidence).toBe(0.8);
  });

  it("is unknown on two different prices in one currency", () => {
    const { parsed, warnings } = analyzeTelegramPost("было 90 000$, сейчас 85 000$");
    expect(parsed.price).toEqual({ confidence: 0, evidence: "90 000$ | 85 000$" });
    expect(warnings).toContain("price_conflict");
  });

  it("ignores prices per m², deposits and commissions", () => {
    expect(parseTelegramPost("цена от 700$ за м²").price).toEqual({ confidence: 0 });
    const parsed = parseTelegramPost("Сдаю, 500$ в месяц, депозит 500$, комиссия 50%");
    expect(parsed.price.value).toEqual({ amountMinor: usd(500), currency: "USD", raw: "500$" });
    expect(parseTelegramPost("1 200 000 000 сум, депозит 1000$").price.value?.currency).toBe("UZS");
  });

  it("keeps rent per month as the price", () => {
    expect(parseTelegramPost("150$/мес").price.value?.amountMinor).toBe(usd(150));
  });

  it("does not take the phone, years or quarter numbers for a price", () => {
    const { parsed, warnings } = analyzeTelegramPost("Юнусабад-19, сдан в 2019, тел 90 123 45 67");
    expect(parsed.price).toEqual({ confidence: 0 });
    expect(warnings).toEqual([]);
  });
});

describe("phones", () => {
  it.each([
    ["+998 90 123 45 67", "+998901234567"],
    ["+998901234567", "+998901234567"],
    ["+998 (97) 111-22-33", "+998971112233"],
    ["90-123-45-67", "+998901234567"],
    ["тел 901234567", "+998901234567"],
  ])("%s → %s", (text, e164) => {
    expect(parseTelegramPost(text).phone).toMatchObject({ value: e164, confidence: 0.95 });
  });

  it("takes the first of several numbers with lower confidence", () => {
    const phone = parseTelegramPost("тел: 93 111 22 33, 97 222 33 44").phone;
    expect(phone).toEqual({ value: "+998931112233", confidence: 0.85, evidence: "93 111 22 33 | 97 222 33 44" });
  });

  it("does not confuse a 9-digit price with a phone", () => {
    const parsed = parseTelegramPost("Продаётся квартира 850000000 сум, тел 901234567");
    expect(parsed.price.value?.amountMinor).toBe(uzs(850_000_000));
    expect(parsed.phone.value).toBe("+998901234567");
  });

  it("extractPhones lists every distinct number with its original spelling", () => {
    expect(extractPhones("Тел: +998 90 123 45 67, 90 123-45-67, (93) 555 12 34")).toEqual([
      { e164: "+998901234567", raw: "+998 90 123 45 67" },
      { e164: "+998935551234", raw: "(93) 555 12 34" },
    ]);
    expect(extractPhones("без телефона")).toEqual([]);
  });
});

describe("a realistic noisy post", () => {
  it("flags a post whose shorthand contradicts its room count", () => {
    const { parsed, warnings } = analyzeTelegramPost("2-комнатная, 3/9/9");
    expect(parsed.rooms).toEqual({ confidence: 0, evidence: "2-комнатная | 3/9/9" });
    expect(parsed.floor.value).toBe(9);
    expect(warnings).toEqual(["rooms_conflict"]);
  });

  it("parses emoji-heavy formatting with hashtags", () => {
    const text = [
      "🔥🔥 СРОЧНО ПРОДАЁТСЯ 🔥🔥",
      "📍 Мирзо-Улугбекский р-н, ориентир Корзинка",
      "🏠 2-комнатная, 2/9/9",
      "📐 Площадь: 64 м²",
      "🛠 Евроремонт, мебель остаётся",
      "💰 Цена: 72 000 у.е. (торг)",
      "📞 +998 (99) 765-43-21",
      "#МирзоУлугбек #продажа",
    ].join("\n");
    const { parsed, warnings } = analyzeTelegramPost(text);
    expect(warnings).toEqual([]);
    expect(parsed.dealType.value).toBe("sale");
    expect(parsed.district.value).toBe("mirzo_ulugbek");
    expect(parsed.rooms.value).toBe(2);
    expect(parsed.floor.value).toBe(9);
    expect(parsed.floorsTotal.value).toBe(9);
    expect(parsed.areaTotal.value).toBe(64);
    expect(parsed.price.value).toEqual({ amountMinor: usd(72_000), currency: "USD", raw: "72 000 у.е." });
    expect(parsed.phone.value).toBe("+998997654321");
  });
});
