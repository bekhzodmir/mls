import { describe, expect, it } from "vitest";
import deals from "@/i18n/messages/deals";
import viewings from "@/i18n/messages/viewings";

/**
 * RU/UZ parity for the W5 namespaces beyond what the types check: the same
 * placeholders in both languages, no empty strings, and Uzbek Latin
 * orthography (o‘ g‘ with U+2018, tutuq belgisi ’ with U+2019).
 */

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe.each([
  ["viewings", viewings],
  ["deals", deals],
] as const)("%s messages", (_name, messages) => {
  const ru = new Map(leaves(messages.ru as unknown as Tree));
  const uz = new Map(leaves(messages.uz as unknown as Tree));

  it("have the same keys and placeholders in both languages", () => {
    expect([...uz.keys()].sort()).toEqual([...ru.keys()].sort());
    for (const [key, text] of ru) {
      expect(placeholders(uz.get(key) ?? ""), key).toEqual(placeholders(text));
    }
  });

  it("have no empty strings", () => {
    for (const [key, text] of [...ru, ...uz]) expect(text.trim(), key).not.toBe("");
  });

  it("use Uzbek Latin apostrophes correctly", () => {
    for (const [key, text] of uz) {
      // o‘ / g‘ take U+2018; a plain ASCII apostrophe or the modifier letter is a typo here.
      expect(text, key).not.toMatch(/[oOgG]['ʻ’`]/);
      expect(text, key).not.toMatch(/'/);
      // No Cyrillic in the Uzbek (Latin) copy.
      expect(text, key).not.toMatch(/[Ѐ-ӿ]/);
    }
  });
});
