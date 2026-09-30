import { describe, expect, it } from "vitest";
import { defineMessages, format, plural } from "./define-messages";
import domain from "./messages/domain";
import matching from "./messages/matching";
import shell from "./messages/shell";

/** Every leaf path of a message tree with the leaf's type, e.g. "reason.price_over:string". */
function shape(value: unknown, path = ""): string[] {
  if (typeof value !== "object" || value === null) return [`${path}:${typeof value}`];
  return Object.keys(value)
    .sort()
    .flatMap((key) => shape((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key));
}

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(leaves);
}

describe("defineMessages", () => {
  it("returns the namespace unchanged", () => {
    const messages = { ru: { hello: "Привет" }, uz: { hello: "Salom" } };
    expect(defineMessages(messages)).toBe(messages);
  });

  it("makes RU/UZ key drift a compile error", () => {
    // These lines are checked by `tsc` (npm run typecheck); vitest only runs them.
    // @ts-expect-error: the Uzbek object lacks a key the Russian one defines
    defineMessages({ ru: { a: "A", b: "B" }, uz: { a: "A" } });
    // @ts-expect-error: the Uzbek object has a key the Russian one does not
    defineMessages({ ru: { a: "A" }, uz: { a: "A", extra: "X" } });
    // @ts-expect-error: nested keys must match too
    defineMessages({ ru: { group: { a: "A", b: "B" } }, uz: { group: { a: "A" } } });
    // @ts-expect-error: leaf types must match
    defineMessages({ ru: { count: "N" }, uz: { count: 1 } });
    expect(true).toBe(true);
  });

  it.each([
    ["domain", domain],
    ["matching", matching],
    ["shell", shell],
  ])("keeps the %s namespace at full RU/UZ parity", (_name, messages) => {
    expect(shape(messages.uz)).toEqual(shape(messages.ru));
    for (const text of [...leaves(messages.ru), ...leaves(messages.uz)]) expect(text.trim()).not.toBe("");
  });

  it.each([
    ["domain", domain],
    ["matching", matching],
    ["shell", shell],
  ])("uses Uzbek Latin apostrophes ‘ (U+2018) and ’ (U+2019) in %s", (_name, messages) => {
    for (const text of leaves(messages.uz)) {
      // ASCII ', backtick and the modifier letters ʻ ʼ are common look-alikes.
      expect(text, text).not.toMatch(/['`ʻʼ]/);
      // o‘ and g‘ take the opening mark, never the tutuq belgisi.
      expect(text, text).not.toMatch(/[oOgG]’/);
    }
  });
});

describe("format", () => {
  it("replaces named placeholders with strings and numbers", () => {
    expect(format("Подходит по: {list}", { list: "району и бюджету" })).toBe("Подходит по: району и бюджету");
    expect(format("{n}-й этаж из {total}", { n: 3, total: 9 })).toBe("3-й этаж из 9");
    expect(format("{n} + {n}", { n: 2 })).toBe("2 + 2");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(format("{a} {b}", { a: 1 })).toBe("1 {b}");
    expect(format("Без подстановок", {})).toBe("Без подстановок");
  });

  it("does not resolve placeholders from Object.prototype", () => {
    expect(format("{constructor} {toString} {hasOwnProperty}", {})).toBe("{constructor} {toString} {hasOwnProperty}");
  });

  it("inserts values literally, including replacement patterns", () => {
    expect(format("{x}", { x: "$& $1 $$" })).toBe("$& $1 $$");
    expect(format("{x}", { x: "{y}" })).toBe("{y}");
  });
});

describe("plural", () => {
  const ru = { one: "день", few: "дня", many: "дней" };
  const uz = { one: "kun", many: "kun" };

  it("picks Russian one / few / many", () => {
    const cases: [number, string][] = [
      [0, "дней"],
      [1, "день"],
      [2, "дня"],
      [4, "дня"],
      [5, "дней"],
      [11, "дней"],
      [12, "дней"],
      [14, "дней"],
      [21, "день"],
      [22, "дня"],
      [25, "дней"],
      [101, "день"],
      [111, "дней"],
    ];
    for (const [count, form] of cases) expect(plural("ru", count, ru), String(count)).toBe(form);
  });

  it("uses the genitive singular (few form) for Russian fractions: «1,5 дня»", () => {
    expect(plural("ru", 1.5, ru)).toBe("дня");
    expect(plural("ru", 0.5, ru)).toBe("дня");
  });

  it("falls back to many when no few form is given", () => {
    expect(plural("ru", 3, { one: "раз", many: "раз" })).toBe("раз");
    expect(plural("ru", 3, { one: "a", many: "b" })).toBe("b");
  });

  it("uses one / other for Uzbek, ignoring a few form", () => {
    expect(plural("uz", 1, { one: "one", many: "other" })).toBe("one");
    expect(plural("uz", 2, { one: "one", few: "few", many: "other" })).toBe("other");
    expect(plural("uz", 1.5, { one: "one", few: "few", many: "other" })).toBe("other");
    expect(plural("uz", 5, uz)).toBe("kun");
  });
});
