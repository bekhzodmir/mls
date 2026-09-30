import { describe, expect, it } from "vitest";
import matchesScreen from "@/i18n/messages/matches-screen";
import properties from "@/i18n/messages/properties";
import requirementDetail from "@/i18n/messages/requirement-detail";

/**
 * The W3 namespaces (property search/profile/new, match screens, requirement
 * detail): RU and UZ must say the same things with the same placeholders,
 * and Uzbek must use the typographic apostrophes (o‘ g‘ with U+2018,
 * tutuq belgisi ’ with U+2019), never ASCII ' or modifier letters.
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

const namespaces = { properties, matchesScreen, requirementDetail } as const;

describe.each(Object.entries(namespaces))("%s messages", (_name, messages) => {
  const ru = new Map(leaves(messages.ru as unknown as Tree));
  const uz = new Map(leaves(messages.uz as unknown as Tree));

  it("has the same keys in RU and UZ", () => {
    expect([...uz.keys()].sort()).toEqual([...ru.keys()].sort());
  });

  it("uses the same placeholders in both languages", () => {
    for (const [key, text] of ru) {
      expect(placeholders(uz.get(key) ?? ""), key).toEqual(placeholders(text));
    }
  });

  it("has no empty strings", () => {
    for (const [key, text] of [...ru, ...uz]) expect(text.trim(), key).not.toBe("");
  });

  it("writes Uzbek with typographic apostrophes", () => {
    for (const [key, text] of uz) {
      expect(text, key).not.toMatch(/['`ʻʼ]/);
      // o‘ / g‘ take U+2018; a U+2019 right after o or g is almost always a typo.
      expect(text, key).not.toMatch(/[oOgG]’/);
    }
  });

  it("does not mention internal metrics or a Binor share of the commission", () => {
    for (const [key, text] of [...ru, ...uz]) {
      expect(text, key).not.toMatch(/500\+|120 сделок|\$150|75%|доля рынка|market share/i);
    }
  });
});
