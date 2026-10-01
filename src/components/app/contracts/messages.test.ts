import { describe, expect, it } from "vitest";
import consents from "@/i18n/messages/consents";
import contracts from "@/i18n/messages/contracts";
import offers from "@/i18n/messages/offers";

/**
 * RU/UZ parity for the offers, contracts and consents namespaces beyond what
 * the types check: the same placeholders in both languages, no empty
 * strings, and Uzbek Latin orthography (o‘ g‘ with U+2018, tutuq belgisi ’
 * with U+2019, no Cyrillic).
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
  ["offers", offers],
  ["contracts", contracts],
  ["consents", consents],
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
