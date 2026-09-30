import { describe, expect, it } from "vitest";
import {
  draftToRequirementFields,
  MIN_APPLY_CONFIDENCE,
  parseRequirementText,
  REQUIREMENT_PARSER_VERSION,
  type RequirementDraft,
} from "./requirement-parser";
import type { DistrictId } from "./types";

const usd = (major: number) => major * 100;

describe("spec examples (§9.3, §14.4)", () => {
  it("«2–3 комнаты, Мирзо-Улугбек, ремонт, до 100 тысяч» — currency stays unknown", () => {
    const draft = parseRequirementText("2–3 комнаты, Мирзо-Улугбек, ремонт, до 100 тысяч");
    expect(draft.rooms).toMatchObject({ value: { min: 2, max: 3 }, evidence: "2–3 комнаты" });
    expect(draft.rooms.confidence).toBeGreaterThanOrEqual(0.9);
    expect(draft.districts).toMatchObject({ value: ["mirzo_ulugbek"], evidence: "Мирзо-Улугбек" });
    expect(draft.renovation.value).toEqual(["renovated", "designer"]);

    // §35.5: the amount is kept, the currency is not guessed.
    const budget = draft.budget.value;
    expect(budget?.amountsMinor).toEqual({ max: usd(100_000) });
    expect(budget?.currency).toBeUndefined();
    expect(budget?.max).toBeUndefined();
    expect(budget?.suggestedCurrency).toMatchObject({ value: "USD", confidence: 0.3 });
    expect(draft.budget.confidence).toBeLessThan(MIN_APPLY_CONFIDENCE);
    expect(draft.warnings).toContain("currency_unknown");
  });

  it("«Чиланзар 2 комнаты до 70 000»", () => {
    const draft = parseRequirementText("Чиланзар 2 комнаты до 70 000");
    expect(draft.districts.value).toEqual(["chilanzar"]);
    expect(draft.rooms.value).toEqual({ min: 2, max: 2 });
    expect(draft.budget.value?.amountsMinor).toEqual({ max: usd(70_000) });
    expect(draft.budget.value?.currency).toBeUndefined();
    expect(draft.warnings).toEqual(["currency_unknown"]);
    // "2 комнаты" only hints at an apartment; not confident enough to apply.
    expect(draft.propertyTypes.value).toEqual(["apartment"]);
    expect(draft.propertyTypes.confidence).toBeLessThan(MIN_APPLY_CONFIDENCE);
  });

  it("«квартира у метро Космонавтов» — the station is an extra, not a district", () => {
    const draft = parseRequirementText("квартира у метро Космонавтов");
    expect(draft.propertyTypes.value).toEqual(["apartment"]);
    expect(draft.extras.value).toEqual(["метро Космонавтов"]);
    expect(draft.districts).toEqual({ confidence: 0 });
    expect(draft.warnings).toEqual([]);
  });

  it("«новостройка 3 комнаты Юнусабад»", () => {
    const draft = parseRequirementText("новостройка 3 комнаты Юнусабад");
    expect(draft.buildingKind).toMatchObject({ value: "new_building", evidence: "новостройка" });
    expect(draft.rooms.value).toEqual({ min: 3, max: 3 });
    expect(draft.districts.value).toEqual(["yunusabad"]);
    expect(draft.propertyTypes.value).toEqual(["apartment"]);
  });

  it("«Yunusobodda 3 xonali kvartira 90 ming dollargacha»", () => {
    const draft = parseRequirementText("Yunusobodda 3 xonali kvartira 90 ming dollargacha");
    expect(draft.districts).toMatchObject({ value: ["yunusabad"], evidence: "Yunusobodda" });
    expect(draft.rooms.value).toEqual({ min: 3, max: 3 });
    expect(draft.propertyTypes.value).toEqual(["apartment"]);
    expect(draft.budget.value).toMatchObject({
      currency: "USD",
      max: { amountMinor: usd(90_000), currency: "USD", raw: "90 ming dollargacha" },
    });
    expect(draft.budget.value?.min).toBeUndefined();
    expect(draft.warnings).toEqual([]);
  });

  it("«Chilonzor 2 xonali ijaraga 500$ gacha»", () => {
    const draft = parseRequirementText("Chilonzor 2 xonali ijaraga 500$ gacha");
    expect(draft.dealType).toMatchObject({ value: "rent", evidence: "ijaraga" });
    expect(draft.districts.value).toEqual(["chilanzar"]);
    expect(draft.rooms.value).toEqual({ min: 2, max: 2 });
    expect(draft.budget.value?.max).toEqual({ amountMinor: usd(500), currency: "USD", raw: "500$" });
  });
});

describe("empty and unrecognized input", () => {
  it.each(["", "   ", "\n\t"])("%j → every field unknown with confidence 0", (text) => {
    const draft = parseRequirementText(text);
    expect(draft.text).toBe(text);
    expect(draft.warnings).toEqual(["empty_text"]);
    expect(draft.parserVersion).toBe(REQUIREMENT_PARSER_VERSION);
    for (const field of fieldsOf(draft)) expect(field).toEqual({ confidence: 0 });
  });

  it("keeps the original sentence verbatim and says nothing was recognized", () => {
    const text = "Привет! Перезвоните, пожалуйста, вечером";
    const draft = parseRequirementText(text);
    expect(draft.text).toBe(text);
    expect(draft.warnings).toEqual(["nothing_recognized"]);
    expect(fieldsOf(draft).every((field) => field.value === undefined && field.confidence === 0)).toBe(true);
  });
});

describe("deal type", () => {
  it.each([
    ["Куплю квартиру", "sale"],
    ["покупка двушки", "sale"],
    ["sotib olmoqchi 2 xonali", "sale"],
    ["сниму однушку", "rent"],
    ["аренда офиса", "rent"],
    ["ijaraga uy kerak", "rent"],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseRequirementText(text).dealType).toMatchObject({ value: expected, confidence: 0.9 });
  });

  it("uses weak hints only at the apply threshold", () => {
    expect(parseRequirementText("до 700 у.е в месяц").dealType).toMatchObject({ value: "rent", confidence: 0.6 });
    expect(parseRequirementText("ипотека, 3 комнаты").dealType).toMatchObject({ value: "sale", confidence: 0.6 });
  });

  it("reports contradictions instead of choosing", () => {
    const draft = parseRequirementText("куплю или сниму квартиру");
    expect(draft.dealType.value).toBeUndefined();
    expect(draft.dealType.evidence).toBe("куплю | сниму");
    expect(draft.warnings).toContain("deal_type_conflict");
  });
});

describe("property types", () => {
  it.each([
    ["двушка на Чиланзаре", ["apartment"]],
    ["квартира или дом", ["apartment", "house"]],
    ["частный дом с участком", ["house"]],
    ["дом, 6 соток", ["house"]],
    ["сниму комнату в квартире", ["room"]],
    ["коммерческое помещение под офис", ["commercial"]],
    ["земельный участок 10 соток", ["land"]],
    ["hovli uy Sergelida", ["house"]],
  ] as const)("%s → %j", (text, expected) => {
    const field = parseRequirementText(text).propertyTypes;
    expect(field.value).toEqual(expected);
    expect(field.confidence).toBeGreaterThanOrEqual(MIN_APPLY_CONFIDENCE);
  });
});

describe("districts", () => {
  it.each<[string, DistrictId]>([
    ["в Юнусабаде", "yunusabad"],
    ["на Чиланзаре", "chilanzar"],
    ["Чиланзара", "chilanzar"],
    ["Мирзо-Улугбекский район", "mirzo_ulugbek"],
    ["Мирзо Улугбек", "mirzo_ulugbek"],
    ["в Яккасарае", "yakkasaray"],
    ["Учтепинский", "uchtepa"],
    ["в Учтепе", "uchtepa"],
    ["в Алмазаре", "olmazor"],
    ["Сергелийский район", "sergeli"],
    ["Yunusoboddan", "yunusabad"],
    ["Chilonzorda", "chilanzar"],
    ["Chilonzordagi", "chilanzar"],
    ["Mirzo Ulug‘bekda", "mirzo_ulugbek"],
    ["Shayxontohurda", "shaykhantahur"],
    ["Yashnobodga", "yashnabad"],
    ["Юнусобод", "yunusabad"],
  ])("%s → %s", (text, id) => {
    expect(parseRequirementText(text).districts.value).toEqual([id]);
  });

  it("collects alternatives in order of mention", () => {
    const draft = parseRequirementText("Юнусабад или Мирабад, можно Яшнабад");
    expect(draft.districts).toMatchObject({
      value: ["yunusabad", "mirabad", "yashnabad"],
      evidence: "Юнусабад | Мирабад | Яшнабад",
    });
  });

  it("does not match district names inside other words", () => {
    expect(parseRequirementText("мираж, сергелиум").districts.value).toBeUndefined();
  });

  it("never maps metro stations to districts", () => {
    const draft = parseRequirementText("у метро Мирзо Улугбек, Kosmonavtlar metrosi yaqinida");
    expect(draft.districts.value).toBeUndefined();
    expect(draft.extras.value).toEqual(["метро Мирзо Улугбек", "Kosmonavtlar metrosi"]);
  });
});

describe("rooms", () => {
  it.each([
    ["2–3 комнаты", { min: 2, max: 3 }],
    ["2-3 комн", { min: 2, max: 3 }],
    ["2—3 комн.", { min: 2, max: 3 }],
    ["2 или 3 комнаты", { min: 2, max: 3 }],
    ["2-3 xonali", { min: 2, max: 3 }],
    ["3 xonali", { min: 3, max: 3 }],
    ["3-х комнатная", { min: 3, max: 3 }],
    ["трёхкомнатная", { min: 3, max: 3 }],
    ["трешка", { min: 3, max: 3 }],
    ["однушку", { min: 1, max: 1 }],
    ["uch xonali", { min: 3, max: 3 }],
    ["от 2 комнат", { min: 2 }],
    ["3+ комнаты", { min: 3 }],
    ["4 комнаты и более", { min: 4 }],
    ["двушка или трешка", { min: 2, max: 3 }],
  ])("%s → %j", (text, expected) => {
    expect(parseRequirementText(text).rooms.value).toEqual(expected);
  });

  it("does not read budgets or floors as rooms", () => {
    expect(parseRequirementText("до 100 000 $, 5 этаж").rooms.value).toBeUndefined();
  });
});

describe("area", () => {
  it.each([
    ["60–80 м²", { min: 60, max: 80 }],
    ["от 50 кв.м", { min: 50 }],
    ["70 m2", { min: 70, max: 70 }],
    ["не менее 60 м2", { min: 60 }],
    ["до 100 кв. м", { max: 100 }],
    ["150 м2 и больше", { min: 150 }],
    ["от 50 м² до 80 м²", { min: 50, max: 80 }],
    ["54,5 m²", { min: 54.5, max: 54.5 }],
  ])("%s → %j", (text, expected) => {
    expect(parseRequirementText(text).area.value).toEqual(expected);
  });

  it("reports contradictory bounds as a conflict", () => {
    const draft = parseRequirementText("60–80 м², от 50 кв.м");
    expect(draft.area.value).toBeUndefined();
    expect(draft.area.evidence).toBe("60–80 м² | 50 кв.м");
    expect(draft.warnings).toContain("area_conflict");
  });

  it("does not treat distances as area", () => {
    expect(parseRequirementText("500 м до метро").area.value).toBeUndefined();
  });
});

describe("budget", () => {
  it.each([
    ["до 100 000$", { max: 100_000 }, "USD"],
    ["не дороже 100к$", { max: 100_000 }, "USD"],
    ["от 80 до 100 тыс $", { min: 80_000, max: 100_000 }, "USD"],
    ["80–100 тыс. долл.", { min: 80_000, max: 100_000 }, "USD"],
    ["$120 000 - 150 000", { min: 120_000, max: 150_000 }, "USD"],
    ["от 50 000 до 70 000 у.е.", { min: 50_000, max: 70_000 }, "USD"],
    ["60 dan 80 ming dollargacha", { min: 60_000, max: 80_000 }, "USD"],
    ["70 000 dollardan oshmasin", { max: 70_000 }, "USD"],
    ["бюджет 1,5 млн сум", { max: 1_500_000 }, "UZS"],
    ["до 500 000 000 сум", { max: 500_000_000 }, "UZS"],
    ["1 mlrd so‘mgacha", { max: 1_000_000_000 }, "UZS"],
  ] as const)("%s → %j %s", (text, bounds, currency) => {
    const draft = parseRequirementText(text);
    const budget = draft.budget.value;
    expect(budget?.currency).toBe(currency);
    expect(budget?.min?.amountMinor).toBe("min" in bounds ? bounds.min * 100 : undefined);
    expect(budget?.max?.amountMinor).toBe(bounds.max * 100);
    expect(draft.budget.confidence).toBeGreaterThanOrEqual(0.9);
    expect(draft.warnings).toEqual([]);
  });

  it("keeps the whole range as raw text for both bounds", () => {
    const budget = parseRequirementText("от 80 до 100 тыс $").budget;
    expect(budget.value?.min?.raw).toBe("80 до 100 тыс $");
    expect(budget.value?.max?.raw).toBe("80 до 100 тыс $");
    expect(budget.evidence).toBe("80 до 100 тыс $");
  });

  it("reads a bare amount with a currency as a ceiling at lower confidence", () => {
    const draft = parseRequirementText("3 xonali, 85 000$");
    expect(draft.budget.value?.max?.amountMinor).toBe(usd(85_000));
    expect(draft.budget.confidence).toBe(0.7);
  });

  it.each([
    ["до 70 000", "USD"],
    ["70000", "USD"],
    ["до 5 000 000", "UZS"],
    ["не дороже 100к", "USD"],
  ] as const)("%s: currency unknown, only suggested (%s)", (text, suggestion) => {
    const draft = parseRequirementText(text);
    expect(draft.budget.value?.currency).toBeUndefined();
    expect(draft.budget.value?.min).toBeUndefined();
    expect(draft.budget.value?.max).toBeUndefined();
    expect(draft.budget.value?.suggestedCurrency?.value).toBe(suggestion);
    expect(draft.warnings).toContain("currency_unknown");
  });

  it("flags two different ceilings instead of picking one", () => {
    const draft = parseRequirementText("до 100 000$, до 90 000$");
    expect(draft.budget.value).toBeUndefined();
    expect(draft.budget.confidence).toBe(0);
    expect(draft.budget.evidence).toBe("100 000$ | 90 000$");
    expect(draft.warnings).toEqual(["budget_conflict"]);
  });

  it("flags min above max", () => {
    const draft = parseRequirementText("от 120 000$, не дороже 100 000$");
    expect(draft.budget.value).toBeUndefined();
    expect(draft.warnings).toContain("budget_conflict");
  });

  it("uses the first currency when two are given and lowers confidence", () => {
    const draft = parseRequirementText("до 100 000$ или 1,2 млрд сум");
    expect(draft.budget.value?.currency).toBe("USD");
    expect(draft.budget.value?.max?.amountMinor).toBe(usd(100_000));
    expect(draft.budget.confidence).toBeLessThan(MIN_APPLY_CONFIDENCE);
    expect(draft.warnings).toEqual(["currency_conflict"]);
  });

  it("ignores phones, minutes, years, floors, per-m² prices and down payments", () => {
    const draft = parseRequirementText(
      "клиент +998 90 123 45 67, 5 минут до метро, сдача 2025, 7 этаж, 1200$ за м², первоначальный взнос 20 000$",
    );
    expect(draft.budget).toEqual({ confidence: 0 });
    expect(draft.warnings).toEqual([]);
  });

  it("ignores small bare numbers", () => {
    expect(parseRequirementText("2 комнаты 500").budget.value).toBeUndefined();
  });
});

describe("building kind, renovation, floor, mortgage", () => {
  it.each([
    ["новостройка", "new_building"],
    ["в новом доме", "new_building"],
    ["yangi bino", "new_building"],
    ["вторичка", "secondary"],
    ["ikkilamchi bozor", "secondary"],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseRequirementText(text).buildingKind.value).toBe(expected);
  });

  it("leaves «новостройка или вторичка» without a preference", () => {
    const field = parseRequirementText("новостройка или вторичка").buildingKind;
    expect(field.value).toBeUndefined();
    expect(field.evidence).toBe("новостройка | вторичка");
  });

  it.each([
    ["с ремонтом", ["renovated", "designer"]],
    ["евроремонт", ["renovated", "designer"]],
    ["ta’mirli", ["renovated", "designer"]],
    ["дизайнерский ремонт", ["designer"]],
    ["без ремонта", ["needs_repair"]],
    ["ta'mirsiz", ["needs_repair"]],
    ["коробка", ["shell"]],
    ["коробка или предчистовая", ["shell"]],
  ])("%s → %j", (text, expected) => {
    expect(parseRequirementText(text).renovation.value).toEqual(expected);
  });

  it.each([
    ["не первый этаж", { notFirst: true }],
    ["не последний", { notLast: true }],
    ["не первый и не последний этаж", { notFirst: true, notLast: true }],
    ["этаж не первый, кроме последнего", { notFirst: true, notLast: true }],
    ["birinchi qavat emas", { notFirst: true }],
    ["birinchi va oxirgi qavat emas", { notFirst: true, notLast: true }],
    ["от 3 до 7 этажа", { min: 3, max: 7 }],
    ["3-7 этаж", { min: 3, max: 7 }],
    ["не выше 10 этажа", { max: 10 }],
    ["не ниже 3 этажа", { min: 3 }],
  ])("%s → %j", (text, expected) => {
    expect(parseRequirementText(text).floor.value).toEqual(expected);
  });

  it("reads mortgage and cash", () => {
    expect(parseRequirementText("ипотека").mortgage).toMatchObject({ value: true, confidence: 0.9 });
    expect(parseRequirementText("ipotekaga").mortgage.value).toBe(true);
    expect(parseRequirementText("за наличные").mortgage).toMatchObject({ value: false, confidence: 0.7 });
    expect(parseRequirementText("без ипотеки").mortgage.value).toBe(false);
    const both = parseRequirementText("ипотека, или наличные");
    expect(both.mortgage.value).toBeUndefined();
    expect(both.warnings).toContain("mortgage_conflict");
  });
});

describe("extras", () => {
  it("keeps landmarks and must-haves verbatim, in order, without duplicates", () => {
    const draft = parseRequirementText(
      "ЖК Tashkent City, рядом с метро, парковка, с мебелью, рядом со школой, Парковка",
    );
    expect(draft.extras.value).toEqual(["ЖК Tashkent City", "рядом с метро", "парковка", "с мебелью", "рядом со школой"]);
  });

  it.each([
    ["рядом метро", ["рядом метро"]],
    ["5 минут до метро", ["5 минут до метро"]],
    ["metro yaqinida", ["metro yaqinida"]],
    ["м. Космонавтов", ["м. Космонавтов"]],
    ["рядом с Мега Планет", ["рядом с Мега Планет"]],
  ])("%s → %j", (text, expected) => {
    expect(parseRequirementText(text).extras.value).toEqual(expected);
  });
});

describe("a full realistic request", () => {
  const text =
    "Куплю трёшку в Юнусабаде или на Чиланзаре, не первый и не последний этаж, от 80 до 100 тыс $, ипотека, парковка";
  const draft = parseRequirementText(text);

  it("parses every field with evidence from the original text", () => {
    expect(draft.dealType).toMatchObject({ value: "sale", evidence: "Куплю" });
    expect(draft.propertyTypes).toMatchObject({ value: ["apartment"], evidence: "трёшку" });
    expect(draft.districts).toMatchObject({ value: ["yunusabad", "chilanzar"], evidence: "Юнусабаде | Чиланзаре" });
    expect(draft.rooms.value).toEqual({ min: 3, max: 3 });
    expect(draft.floor.value).toEqual({ notFirst: true, notLast: true });
    expect(draft.budget.value).toMatchObject({ currency: "USD", amountsMinor: { min: usd(80_000), max: usd(100_000) } });
    expect(draft.mortgage.value).toBe(true);
    expect(draft.extras.value).toEqual(["парковка"]);
    expect(draft.warnings).toEqual([]);
  });

  it("draftToRequirementFields applies confident fields and keeps the sentence", () => {
    expect(draftToRequirementFields(draft)).toEqual({
      dealType: "sale",
      propertyTypes: ["apartment"],
      districts: ["yunusabad", "chilanzar"],
      rooms: { min: 3, max: 3 },
      budget: {
        currency: "USD",
        min: { amountMinor: usd(80_000), currency: "USD", raw: "80 до 100 тыс $" },
        max: { amountMinor: usd(100_000), currency: "USD", raw: "80 до 100 тыс $" },
      },
      floor: { notFirst: true, notLast: true },
      mortgage: true,
      extras: ["парковка"],
      naturalLanguageInput: text,
    });
  });
});

describe("draftToRequirementFields", () => {
  it("never applies a budget without a currency", () => {
    const fields = draftToRequirementFields(parseRequirementText("Чиланзар 2 комнаты до 70 000"));
    expect(fields).toEqual({
      districts: ["chilanzar"],
      rooms: { min: 2, max: 2 },
      naturalLanguageInput: "Чиланзар 2 комнаты до 70 000",
    });
    expect(fields.budget).toBeUndefined();
    expect(fields.propertyTypes).toBeUndefined();
  });

  it("respects a custom confidence threshold", () => {
    const draft = parseRequirementText("Чиланзар 2 комнаты");
    expect(draftToRequirementFields(draft, 0.4).propertyTypes).toEqual(["apartment"]);
    expect(draftToRequirementFields(draft, 0.95)).toEqual({ naturalLanguageInput: "Чиланзар 2 комнаты" });
  });

  it("returns nothing for an empty draft", () => {
    expect(draftToRequirementFields(parseRequirementText(""))).toEqual({});
  });

  it("does not share arrays with the draft", () => {
    const draft = parseRequirementText("Юнусабад, парковка");
    const fields = draftToRequirementFields(draft);
    fields.districts?.push("sergeli");
    fields.extras?.push("лифт");
    expect(draft.districts.value).toEqual(["yunusabad"]);
    expect(draft.extras.value).toEqual(["парковка"]);
  });
});

function fieldsOf(draft: RequirementDraft) {
  return [
    draft.dealType,
    draft.propertyTypes,
    draft.districts,
    draft.rooms,
    draft.area,
    draft.budget,
    draft.buildingKind,
    draft.renovation,
    draft.floor,
    draft.mortgage,
    draft.extras,
  ];
}
