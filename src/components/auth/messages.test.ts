import { describe, expect, it } from "vitest";
import auth from "@/i18n/messages/auth";
import onboarding from "@/i18n/messages/onboarding";

/** Every string leaf with its dotted path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const namespaces = { auth, onboarding };

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
      expect([path, /\s{2,}|\.\./.test(text)]).toEqual([path, false]);
    }
  });

  it("states no internal metrics or prices (§41 D3, D4)", () => {
    for (const [path, text] of [...ru, ...uz]) {
      expect([path, /500\+|120 сдел|\$150|75\s?%|\$29/.test(text)]).toEqual([path, false]);
    }
  });
});

describe("honesty of the demo copy", () => {
  it("says on the phone screens that SMS is not connected and any six digits pass", () => {
    expect(auth.ru.phone.demoTitle).toMatch(/SMS/);
    expect(auth.ru.phone.demoText).toMatch(/6 цифр/);
    expect(auth.uz.phone.demoText).toMatch(/6 ta raqam/);
  });

  it("explains that a verified Telegram account still gets no session", () => {
    expect(auth.ru.telegram.successText).toMatch(/сесси/);
    expect(auth.uz.telegram.successText).toMatch(/sessiya/);
  });

  it("never calls a self-declared status verified", () => {
    expect(onboarding.ru.profile.certificateTag).toBe("введено вами, не проверено");
    expect(onboarding.ru.work.statusNote).toMatch(/ЗРУ-1163/);
    expect(onboarding.uz.work.statusNote).toMatch(/O‘RQ-1163/);
  });
});
