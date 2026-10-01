import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as repo from "@/lib/data/repository";
import type { ConsentRegistryItem } from "@/lib/data/views";
import {
  canRevoke,
  consentCounts,
  consentListHref,
  matchesConsentFilter,
  parseConsentFilters,
  revokeConsent,
  revokeConsequences,
  subjectHref,
} from "./registry";

/**
 * Consent registry: the pure filter / revocation rules, then the page in
 * both languages — filters from the URL, rows with every registry field,
 * the revoke action only on the viewer's own records (with the consequences
 * named), the permission note on a colleague's, and the empty states.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => `/${state.locale}/app/consents`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: ConsentsPage, generateMetadata } = await import("@/app/[locale]/app/consents/page");

type Search = Record<string, string | string[] | undefined>;

async function render(page: Promise<ReactElement> | ReactElement): Promise<string> {
  return renderToStaticMarkup(await page).replace(/[  ]/g, " ");
}

const props = (searchParams: Search = {}) =>
  ({ params: Promise.resolve({ locale: state.locale }), searchParams: Promise.resolve(searchParams) }) as never;

function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
}

function expectNoLeftovers(html: string) {
  expect(html).not.toMatch(/\{[a-z]\w*\}/i);
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("NaN");
}

const AT = "2026-09-30T06:00:00.000Z";

function item(overrides: Partial<ConsentRegistryItem> = {}): ConsentRegistryItem {
  return {
    subject: { kind: "client", id: "cl-x", name: "Клиент" },
    consent: { id: "c-1", purpose: "contact", channel: "written", grantedAt: "2026-09-01T07:00:00.000Z", textVersion: "v1" },
    state: "active",
    responsibleAgent: { id: "agent-01" } as ConsentRegistryItem["responsibleAgent"],
    scope: "own",
    ...overrides,
  };
}

beforeEach(() => {
  state.locale = "ru";
});

describe("registry rules", () => {
  it("reads known filters from the URL and builds stable links", () => {
    expect(parseConsentFilters({ subject: "owner", purpose: "marketing", state: "revoked" })).toEqual({
      subject: "owner",
      purpose: "marketing",
      state: "revoked",
    });
    expect(parseConsentFilters({ subject: "lead", purpose: "x", state: "" })).toEqual({});
    expect(consentListHref("ru", { state: "active", subject: "client" })).toBe("/ru/app/consents?subject=client&state=active");
    expect(consentListHref("uz")).toBe("/uz/app/consents");
    expect(subjectHref("ru", { subject: { kind: "owner", id: "owner-06" }, scope: "agency" })).toBe(
      "/ru/app/owners/owner-06",
    );
    expect(subjectHref("ru", { subject: { kind: "client", id: "cl-02" }, scope: "own" })).toBe("/ru/app/clients/cl-02");
    // A colleague's client profile is not open to the viewer, so there is no link to a 404.
    expect(subjectHref("ru", { subject: { kind: "client", id: "cl-17" }, scope: "agency" })).toBeUndefined();
  });

  it("links only to profiles the viewer can open", async () => {
    for (const item of await repo.listConsents()) {
      const href = subjectHref("ru", item);
      if (!href) continue;
      const opened =
        item.subject.kind === "client" ? await repo.getClient(item.subject.id) : await repo.getOwner(item.subject.id);
      expect(opened, href).toBeDefined();
    }
  });

  it("filters exactly like the repository", async () => {
    const all = await repo.listConsents();
    for (const filter of [{ state: "revoked" as const }, { subject: "owner" as const, purpose: "share_with_partners" as const }]) {
      const expected = (await repo.listConsents(filter)).map((entry) => entry.consent.id);
      expect(all.filter((entry) => matchesConsentFilter(entry, filter)).map((entry) => entry.consent.id)).toEqual(expected);
    }
    expect(consentCounts(all)).toEqual({ active: all.length - 2, revoked: 2 });
  });

  it("lets only the responsible agent revoke an active consent, once", () => {
    expect(canRevoke(item())).toBe(true);
    expect(canRevoke(item({ scope: "agency" }))).toBe(false);
    expect(canRevoke(item({ state: "revoked" }))).toBe(false);
    const revoked = revokeConsent(item().consent, AT);
    expect(revoked?.revokedAt).toBe(AT);
    expect(revoked && revokeConsent(revoked, "2026-10-01T00:00:00.000Z")).toBeUndefined();
  });

  it("names the purpose's consequence, the art. 37 check for owners, and that the record stays", () => {
    expect(revokeConsequences(item())).toEqual(["contact", "record_kept"]);
    expect(
      revokeConsequences(
        item({ subject: { kind: "owner", id: "o", name: "O" }, consent: { ...item().consent, purpose: "share_with_partners" } }),
      ),
    ).toEqual(["share_with_partners", "owner_contracts", "record_kept"]);
  });
});

describe("/app/consents", () => {
  it("lists every consent with subject, purpose, channel, dates, text version and responsible agent", async () => {
    const html = await render(ConsentsPage(props()));
    const text = textOf(html);
    expect(text).toContain("Реестр согласий");
    expect(text).toContain("Действуют: 46 · отозваны: 2");
    expect(text).toContain("48 согласий");
    expect(text).toContain("Равшан Норматов");
    expect(text).toContain("Версия текста:owner-consent-v1-demo");
    expect(text).toContain("Ответственный:Азиз Каримов (вы)");
    expect(text).toMatch(/Отозвано \d{1,2} [а-я]+\./);
    expect(html).toContain("/ru/app/owners/owner-33");
    expect(html).toContain("/ru/app/clients/cl-02");
    expect(html).toContain("/ru/app/contracts");
    // Own records can be revoked; a colleague's say who can.
    expect(text).toContain("Отозвать");
    expect(text).toContain("Отозвать согласие может ответственный агент (Тимур Ахмедов) или руководитель агентства.");
    expectNoLeftovers(html);
  });

  it("filters by subject, purpose and state from the URL", async () => {
    const revoked = textOf(await render(ConsentsPage(props({ state: "revoked" }))));
    expect(revoked).toContain("2 согласия");
    expect(revoked).toContain("Madina Ergasheva");
    expect(revoked).toContain("Руслан Мирзаев");
    expect(revoked).not.toContain("Равшан Норматов");
    const owners = await render(ConsentsPage(props({ subject: "owner", purpose: "contact" })));
    expect(textOf(owners)).toContain("1 согласие");
    expect(owners).toContain('href="/ru/app/consents?subject=owner&amp;purpose=contact&amp;state=active"');
  });

  it("explains an empty filtered result", async () => {
    const html = await render(ConsentsPage(props({ subject: "owner", purpose: "marketing" })));
    expect(textOf(html)).toContain("По выбранным фильтрам согласий нет");
    expect(html).toContain('href="/ru/app/consents"');
  });

  it("renders in Uzbek", async () => {
    state.locale = "uz";
    const html = await render(ConsentsPage(props()));
    const text = textOf(html);
    expect(text).toContain("Roziliklar reyestri");
    expect(text).toContain("Qaytarib olish");
    expect(text).toContain("Hamkorlarga uzatish");
    expectNoLeftovers(html);
    expect((await generateMetadata()).title).toBe("Roziliklar reyestri");
  });
});
