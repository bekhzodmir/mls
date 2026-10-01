import { describe, expect, it } from "vitest";
import { plural } from "./define-messages";
import {
  compareText,
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatDay,
  formatList,
  formatNumber,
  formatRelative,
  formatTime,
} from "./format";

/*
 * Node ships full ICU, so it is the reference: the hand-written Uzbek
 * formatting must print exactly what `Intl` with Uzbek data prints, because
 * browsers without that data (Chromium) must render the same text as the
 * server did.
 */

const tz = { timeZone: "Asia/Tashkent" } as const;
const instants = [
  "2026-09-30T06:00:00Z",
  "2026-01-04T21:05:00Z", // already 5 January in Tashkent
  "2026-05-17T19:59:00Z",
  "2026-12-31T23:30:00Z",
];
const dateOptions: Intl.DateTimeFormatOptions[] = [
  { day: "numeric", month: "short", year: "numeric" },
  { day: "numeric", month: "short" },
  { day: "numeric", month: "long" },
  { day: "numeric", month: "long", year: "numeric" },
  { weekday: "long", day: "numeric", month: "long" },
  { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  { weekday: "short", day: "numeric", month: "short" },
  { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  { hour: "2-digit", minute: "2-digit" },
];

describe("Uzbek dates without runtime Uzbek data", () => {
  it.each(dateOptions)("matches full-ICU output for %o", (options) => {
    for (const iso of instants) {
      const reference = new Intl.DateTimeFormat("uz-Latn-UZ", { ...tz, ...options }).format(new Date(iso));
      expect(formatDate("uz", iso, options)).toBe(reference);
    }
  });

  it("has date-time, time and agenda-day shorthands", () => {
    expect(formatDateTime("uz", "2026-09-30T06:00:00Z")).toBe("30-sen, 11:00");
    expect(formatTime("uz", "2026-09-30T06:00:00Z")).toBe("11:00");
    expect(formatDay("uz", "2026-09-30T06:00:00Z")).toBe("chorshanba, 30-sentabr");
    expect(formatDay("ru", "2026-09-30T06:00:00Z")).toBe("среда, 30 сентября");
    expect(formatDay("ru", "2026-09-30T06:00:00Z", { year: true })).toBe("среда, 30 сентября 2026 г.");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-30T06:00:00Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

  it("matches full-ICU Uzbek output", () => {
    const reference = new Intl.RelativeTimeFormat("uz-Latn-UZ", { numeric: "auto" });
    const cases: [number, Intl.RelativeTimeFormatUnit, number][] = [
      [0, "minute", 0],
      [-5, "minute", -5],
      [5, "minute", 5],
      [-3, "hour", -180],
      [3, "hour", 180],
      [-1, "day", -24 * 60],
      [1, "day", 24 * 60],
      [-3, "day", -3 * 24 * 60],
      [3, "day", 3 * 24 * 60],
      [-2, "month", -60 * 24 * 60],
    ];
    for (const [value, unit, minutes] of cases) {
      // CLDR spells o‘ with U+02BB in places; Binor's orthography uses U+2018.
      expect(formatRelative("uz", at(minutes), now)).toBe(reference.format(value, unit).replace(/ʻ/g, "‘"));
    }
    expect(formatRelative("uz", at(-30 * 24 * 60), now)).toBe("o‘tgan oy");
  });

  it("uses Intl for Russian", () => {
    expect(formatRelative("ru", at(-3 * 24 * 60), now)).toBe("3 дня назад");
  });

  it("counts Tashkent calendar days, not 24-hour blocks", () => {
    // 30 Sep 11:00 Tashkent; 28 Sep 23:30 Tashkent is two dates back.
    expect(formatRelative("ru", "2026-09-28T18:30:00Z", now)).toBe("позавчера");
    // 30 Sep 01:00 Tashkent; 28 Sep 20:00 Tashkent.
    const lateNight = new Date("2026-09-29T20:00:00Z");
    expect(formatRelative("ru", "2026-09-28T15:00:00Z", lateNight)).toBe("позавчера");
    expect(formatRelative("uz", "2026-09-28T15:00:00Z", lateNight)).toBe("2 kun oldin");
    // 29 Sep 05:30 Tashkent is one date back from 30 Sep 11:00, though 29.5 hours have passed.
    expect(formatRelative("ru", "2026-09-29T00:30:00Z", now)).toBe("вчера");
  });
});

describe("numbers and lists", () => {
  it("groups digits the same way in both languages", () => {
    expect(formatNumber("uz", 1_234_567.5)).toBe(new Intl.NumberFormat("uz-Latn-UZ").format(1_234_567.5));
    expect(formatNumber("ru", 1234)).toBe("1 234");
    expect(formatNumber("uz", 64.25, { maximumFractionDigits: 1 })).toBe("64,3");
  });

  it("has compact forms", () => {
    for (const value of [950, 1500, 85_000, 1_200_000, 4_500_000_000]) {
      for (const [locale, tag] of [
        ["uz", "uz-Latn-UZ"],
        ["ru", "ru-RU"],
      ] as const) {
        const reference = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 }).format(value);
        expect(formatCompactNumber(locale, value)).toBe(reference);
      }
    }
    expect(formatCompactNumber("ru", 999_990)).toBe("1 млн");
  });

  it("joins lists with «и» / «va» and «или» / «yoki»", () => {
    expect(formatList("uz", ["a", "b", "c"])).toBe("a, b va c");
    expect(formatList("uz", ["a", "b"], "disjunction")).toBe("a yoki b");
    expect(formatList("uz", ["a"])).toBe("a");
    expect(formatList("uz", [])).toBe("");
    expect(formatList("ru", ["a", "b", "c"])).toBe("a, b и c");
  });

  it("picks Uzbek plural forms without runtime data", () => {
    const forms = { one: "one", many: "many" };
    expect(plural("uz", 1, forms)).toBe("one");
    expect(plural("uz", 0, forms)).toBe("many");
    expect(plural("uz", 21, forms)).toBe("many");
  });
});

describe("compareText", () => {
  it("sorts Uzbek names in alphabet order (Oʻ, Gʻ, Sh, Ch after Z)", () => {
    const names = ["Chilonzor", "Shayxontohur", "Yunusobod", "Olmazor", "Bektemir", "Mirzo Ulug‘bek", "Mirobod", "O‘rikzor"];
    expect([...names].sort((a, b) => compareText("uz", a, b))).toEqual([
      "Bektemir",
      "Mirobod",
      "Mirzo Ulug‘bek",
      "Olmazor",
      "Yunusobod",
      "O‘rikzor",
      "Shayxontohur",
      "Chilonzor",
    ]);
  });

  it("uses Russian collation for Russian", () => {
    expect(["Яккасарай", "Алмазар", "Ёшлик", "Чиланзар"].sort((a, b) => compareText("ru", a, b))).toEqual([
      "Алмазар",
      "Ёшлик",
      "Чиланзар",
      "Яккасарай",
    ]);
  });
});
