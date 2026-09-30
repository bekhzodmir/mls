import { describe, expect, it } from "vitest";
import cooperation from "@/i18n/messages/cooperation";
import mls from "@/i18n/messages/mls";
import radar from "@/i18n/messages/radar";

/** Every string leaf with its dotted path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const namespaces = { radar, mls, cooperation };

describe.each(Object.entries(namespaces))("%s messages", (_name, messages) => {
  const uz = leaves(messages.uz);
  const ru = leaves(messages.ru);

  it("has the same keys and placeholders in both languages", () => {
    expect(uz.map(([path]) => path)).toEqual(ru.map(([path]) => path));
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const ruByPath = new Map(ru);
    for (const [path, text] of uz) {
      expect([path, placeholders(text)]).toEqual([path, placeholders(ruByPath.get(path)!)]);
    }
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
      expect([path, /\s{2,}|\.\.|'/.test(text)]).toEqual([path, false]);
    }
  });

  it("never states a Telegram channel count or internal metrics (§7.2, §41 D1/D3/D4)", () => {
    for (const [path, text] of [...ru, ...uz]) {
      expect([path, /\b(77|100\+|500\+|120 сдел|75%|\$29)/.test(text)]).toEqual([path, false]);
      expect([path, /сотни каналов|сотен каналов|yuzlab kanal/i.test(text)]).toEqual([path, false]);
    }
  });
});

describe("commission wording", () => {
  it("says the split is between realtors, not a Binor fee (§41 D10)", () => {
    expect(cooperation.ru.terms.notBinorFee).toMatch(/не комиссия Binor/);
    expect(cooperation.uz.terms.notBinorFee).toMatch(/Binor komissiyasi emas/);
  });

  it("states that Binor is not an arbiter and the contract, not the UI, is binding (§35.6)", () => {
    expect(cooperation.ru.dispute.text).toMatch(/не является арбитром/);
    expect(cooperation.ru.actions.legal).toMatch(/договор, а не интерфейс/);
    expect(cooperation.uz.dispute.text).toMatch(/hakam emas/);
  });
});
