import { describe, expect, it } from "vitest";
import audit from "@/i18n/messages/audit";
import deals from "@/i18n/messages/deals";
import partners from "@/i18n/messages/partners";
import team from "@/i18n/messages/team";
import { ORG_AUDIT_ACTIONS, ORG_AUDIT_TARGET_KINDS } from "@/lib/data/views";
import { ALL_AREAS, ALL_OWNERSHIPS, SCOPE_REACH } from "@/lib/domain/permissions";

/** Every string leaf with its dotted path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const namespaces = { team, partners, audit };

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
      expect([path, text.trim() === text && text !== ""]).toEqual([path, true]);
    }
  });

  it("never states internal metrics, market shares or pricing (§41 D3, D4, D9)", () => {
    for (const [path, text] of [...ru, ...uz]) {
      expect([path, /\b(500\+|120 сдел|75%|\$150|\$29|10%)/.test(text)]).toEqual([path, false]);
    }
  });
});

describe("coverage of domain codes", () => {
  it("labels every organization audit action and target kind", () => {
    for (const locale of ["ru", "uz"] as const) {
      expect(Object.keys(audit[locale].actions).sort()).toEqual([...ORG_AUDIT_ACTIONS].sort());
      for (const kind of ORG_AUDIT_TARGET_KINDS) {
        const labelled = kind in audit[locale].targetKinds || kind in deals[locale].audit.kinds;
        expect([kind, labelled]).toEqual([kind, true]);
      }
      // Kinds the deals namespace already labels are reused, not duplicated.
      for (const kind of Object.keys(audit[locale].targetKinds)) {
        expect([kind, kind in deals[locale].audit.kinds]).toEqual([kind, false]);
      }
    }
  });

  it("names every permission area, scope and record relation", () => {
    for (const locale of ["ru", "uz"] as const) {
      expect(Object.keys(team[locale].access.areas).sort()).toEqual([...ALL_AREAS].sort());
      expect(Object.keys(team[locale].access.scopes).sort()).toEqual(Object.keys(SCOPE_REACH).sort());
      expect(Object.keys(team[locale].access.ownership).sort()).toEqual([...ALL_OWNERSHIPS].sort());
    }
  });

  it("says assignments need a reason and the journal is append-only", () => {
    expect(team.ru.routing.assign.reasonRequired).toMatch(/журнал действий/);
    expect(team.uz.routing.assign.reasonRequired).toMatch(/harakatlar jurnaliga/);
    expect(audit.ru.appendOnly.title).toMatch(/нельзя изменить или удалить/);
    expect(audit.ru.export.logged).toMatch(/сам попадает в журнал/);
    expect(team.ru.demoRole.banner).toBe(
      "Демо: просмотр с правами «{role}». В рабочей версии роль определяется учётной записью.",
    );
  });

  it("describes the split as between realtors, not a Binor fee (§41 D10)", () => {
    expect(partners.ru.detail.requestPath).toMatch(/между риэлторами/);
    expect(partners.uz.detail.requestPath).toMatch(/rieltorlar o‘rtasida/);
  });
});
