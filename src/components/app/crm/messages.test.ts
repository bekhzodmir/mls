import { describe, expect, it } from "vitest";
import clients from "@/i18n/messages/clients";
import leads from "@/i18n/messages/leads";
import editor from "@/i18n/messages/requirement-editor";

/** Every string leaf with its dotted path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const namespaces = { leads, clients, "requirement-editor": editor };

describe.each(Object.entries(namespaces))("%s messages", (_name, messages) => {
  const uz = leaves(messages.uz);
  const ru = leaves(messages.ru);

  it("has the same keys and placeholders in both languages", () => {
    expect(uz.map(([path]) => path)).toEqual(ru.map(([path]) => path));
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const ruByPath = new Map(ru);
    for (const [path, text] of uz)
      expect([path, placeholders(text)]).toEqual([path, placeholders(ruByPath.get(path)!)]);
  });

  it("uses Uzbek Latin orthography: o‘ g‘ with U+2018 and the tutuq belgisi U+2019", () => {
    for (const [path, text] of uz) {
      expect([path, /['`ʻʼ]/.test(text)]).toEqual([path, false]);
      expect([path, /[oOgG]’/.test(text)]).toEqual([path, false]);
      expect([path, /\p{Script=Cyrillic}/u.test(text)]).toEqual([path, false]);
    }
  });

  it("keeps Russian strings free of typographic slips", () => {
    for (const [path, text] of ru) {
      expect([path, /\s{2,}|\.\./.test(text)]).toEqual([path, false]);
    }
  });
});
