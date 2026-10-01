import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import calls from "@/i18n/messages/calls";
import { now } from "@/lib/clock";
import { getCall, listCalls } from "@/lib/data/repository";
import { CallCard } from "./call-list-view";

/**
 * Server-render smoke test for the call screens (call log, call detail,
 * communication timeline) in both locales: every visible call renders,
 * unknown or colleagues' ids 404, and the key states — missed first, unknown
 * number, phone-match suggestion, refused recording, AI draft vs confirmed,
 * revoked consent, stale timeline — reach the markup.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${state.locale}/app/calls`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type PageModule = {
  default: (props: never) => Promise<ReactElement>;
  generateMetadata: (props: never) => Promise<{ title?: unknown }>;
};

async function render(module: PageModule, props: object = {}): Promise<string> {
  return renderToString(await module.default(props as never));
}

const query = (searchParams: Record<string, string> = {}) => ({
  searchParams: Promise.resolve(searchParams),
  params: Promise.resolve({}),
});
const withId = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

const pages = {
  list: () => import("@/app/[locale]/app/calls/(list)/page") as Promise<PageModule>,
  call: () => import("@/app/[locale]/app/calls/[id]/page") as Promise<PageModule>,
  timeline: () => import("@/app/[locale]/app/calls/timeline/page") as Promise<PageModule>,
};

/** Unreplaced `{placeholder}`, a leaked `undefined`/`NaN`, or an object printed as text. */
const BROKEN = /undefined|NaN|\{[a-zA-Z]+\}|\[object Object\]/;
const decode = (html: string) => html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");

describe.each(["ru", "uz"] as const)("call screens (%s)", (locale) => {
  const t = calls[locale];

  it("lists calls by day with missed calls first and every filter", async () => {
    state.locale = locale;
    const html = await render(await pages.list(), query());
    expect(html).not.toMatch(BROKEN);
    // Today's missed calls come before the rest of today.
    expect(html.indexOf("call-10")).toBeLessThan(html.indexOf("call-12"));
    expect(html.indexOf("call-01")).toBeLessThan(html.indexOf("call-02"));
    expect(html).toContain(t.party.unknownNumber);
    expect(decode(html)).toContain(`/${locale}/app/leads/new?phone=%2B998940000451`);
    expect(html).toContain(t.summaryState.draft);
    expect(html).toContain(t.summaryState.confirmed);
    expect(html).toContain(t.recording.refusedOwner);
    expect(html).toContain(t.list.permission);
    for (const filter of ["missed", "unknown", "inbound", "outbound", "bogus"]) {
      expect(await render(await pages.list(), query({ filter }))).not.toMatch(BROKEN);
    }
    const unknown = await render(await pages.list(), query({ filter: "unknown" }));
    expect(unknown).toContain("call-03");
    expect(unknown).not.toContain("call-05");
  });

  it("renders every visible call and hides colleagues' calls", async () => {
    state.locale = locale;
    for (const view of await listCalls()) {
      expect(await render(await pages.call(), withId(view.call.id))).not.toMatch(BROKEN);
    }
    await expect(render(await pages.call(), withId("call-15"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(await pages.call(), withId("call-99"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("offers a lead or client for an unknown number and the AI draft with its request", async () => {
    state.locale = locale;
    const html = decode(await render(await pages.call(), withId("call-02")));
    expect(html).toContain(t.detail.unknownNumber.title);
    expect(html).toContain(`/${locale}/app/leads/new?phone=%2B998940000451`);
    expect(html).toContain(`/${locale}/app/clients/new?phone=%2B998940000451`);
    expect(html).toContain(t.detail.summary.draftTitle);
    expect(html).toContain(t.detail.summary.confirm);
    expect(html).toContain(`/${locale}/app/requirements/new?q=`);
    expect(html).toContain("data-sticky-actions");
    expect(html).toContain('lang="ru"');
  });

  it("suggests the matching lead without linking it, and explains a refused recording", async () => {
    state.locale = locale;
    const html = await render(await pages.call(), withId("call-03"));
    expect(html).toContain(t.detail.suggestions.title);
    expect(html).toContain(`/${locale}/app/leads/lead-04`);
    expect(html).toContain(t.detail.recording.refusedClient);
    expect(html).not.toContain(t.detail.sections.transcript);
  });

  it("warns that a matching client withdrew contact consent", async () => {
    state.locale = locale;
    const html = await render(await pages.call(), withId("call-10"));
    expect(html).toContain("Madina Ergasheva");
    expect(html).toContain(t.detail.suggestions.revoked.split("{date}")[1]);
    expect(html).toContain(t.detail.recording.noConversation);
  });

  it("marks Uzbek transcripts and shows who confirmed a summary", async () => {
    state.locale = locale;
    const uzbek = await render(await pages.call(), withId("call-04"));
    expect(uzbek).toContain('lang="uz-Latn"');
    const confirmed = await render(await pages.call(), withId("call-05"));
    expect(confirmed).toContain(t.summaryState.confirmed);
    expect(confirmed).toContain(t.party.you);
    expect(decode(confirmed)).toContain(`/${locale}/app/calls/timeline?clientId=cl-01`);
    expect(decode(confirmed)).toContain(`/${locale}/app/tasks/new?clientId=cl-01`);
  });

  it("shows a person's timeline, filters by channel and opens originals safely", async () => {
    state.locale = locale;
    const html = decode(await render(await pages.timeline(), query({ clientId: "cl-01" })));
    expect(html).not.toMatch(BROKEN);
    expect(html).toContain("Санжар Ибрагимов");
    expect(html).toContain('href="https://t.me/sanjar_demo" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(`/${locale}/app/calls/call-05`);
    const telegram = await render(await pages.timeline(), query({ clientId: "cl-01", channel: "telegram" }));
    expect(telegram).not.toContain("call-05");
    const empty = await render(await pages.timeline(), query({ clientId: "cl-01", channel: "email" }));
    expect(empty).toContain(t.timeline.emptyChannel.title);
    const lead = await render(await pages.timeline(), query({ leadId: "lead-04" }));
    expect(lead).toContain(t.timeline.empty.title);
    expect(lead).toContain(t.party.noName);
    const stale = await render(await pages.timeline(), query({ ownerId: "owner-01" }));
    expect(stale).toContain(t.timeline.stale.title);
  });

  it("explains the timeline without a person and 404s for hidden people", async () => {
    state.locale = locale;
    const html = await render(await pages.timeline(), query());
    expect(html).toContain(t.timeline.noSubject.title);
    expect(html).toContain(`/${locale}/app/owners`);
    await expect(render(await pages.timeline(), query({ clientId: "cl-17" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(await pages.timeline(), query({ ownerId: "nobody" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("masks a restricted owner's number and drops the call-back", async () => {
    state.locale = locale;
    const view = await getCall("call-13");
    const open = renderToString(createElement(CallCard, { locale, view: view!, now: now() }));
    expect(open).toContain("+998 91 000 02 08");
    expect(open).toContain("tel:+998910000208");
    const hidden = renderToString(createElement(CallCard, { locale, view: view!, now: now(), phoneHidden: true }));
    expect(hidden).toContain("+998 91 *** ** 08");
    expect(hidden).not.toContain("tel:");
  });

  it("gives every screen a localized title without the unattached number", async () => {
    state.locale = locale;
    const list = await (await pages.list()).generateMetadata(query() as never);
    expect(list.title).toBe(t.meta.list);
    const unknown = await (await pages.call()).generateMetadata(withId("call-02") as never);
    expect(unknown.title).toBe(`${t.meta.detail}: ${t.party.unknownNumber}`);
    const timeline = await (await pages.timeline()).generateMetadata(query({ clientId: "cl-01" }) as never);
    expect(timeline.title).toBe(`${t.meta.timeline}: Санжар Ибрагимов`);
  });
});

/** Every string leaf with its dotted path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

describe("calls messages", () => {
  const uz = leaves(calls.uz);
  const ru = leaves(calls.ru);

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
});
