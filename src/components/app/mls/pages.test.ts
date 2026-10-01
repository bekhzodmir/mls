import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "@/i18n/config";

/**
 * Server-renders the W4 pages (Radar, post, Copilot, MLS, cooperation list,
 * detail and new) to static HTML in both locales, through every state the
 * seed allows. `next/root-params` only exists inside a Next request, so the
 * locale getter is replaced; `notFound()` throws a marker error.
 */

let currentLocale: Locale = "ru";
vi.mock("@/i18n/server", () => ({ getLocale: async () => currentLocale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${currentLocale}/app/mls`,
  useParams: () => ({ locale: currentLocale }),
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type Page = (props: never) => Promise<ReactElement>;

async function render(
  load: () => Promise<{ default: unknown }>,
  searchParams: Record<string, string> = {},
  params: Record<string, string> = {},
) {
  const page = (await load()).default as Page;
  const props = {
    params: Promise.resolve({ locale: currentLocale, ...params }),
    searchParams: Promise.resolve(searchParams),
  };
  return renderToStaticMarkup(await page(props as never));
}

const pages = {
  radar: () => import("@/app/[locale]/app/radar/(list)/page"),
  post: () => import("@/app/[locale]/app/radar/[id]/page"),
  importPost: () => import("@/app/[locale]/app/radar/import/page"),
  mls: () => import("@/app/[locale]/app/mls/(home)/page"),
  cooperation: () => import("@/app/[locale]/app/mls/cooperation/(list)/page"),
  cooperationDetail: () => import("@/app/[locale]/app/mls/cooperation/[id]/page"),
  cooperationNew: () => import("@/app/[locale]/app/mls/cooperation/new/page"),
  radarNotFound: () => import("@/app/[locale]/app/radar/not-found"),
  cooperationNotFound: () => import("@/app/[locale]/app/mls/cooperation/not-found"),
  radarLoading: () => import("@/app/[locale]/app/radar/(list)/loading"),
  mlsLoading: () => import("@/app/[locale]/app/mls/(home)/loading"),
  cooperationLoading: () => import("@/app/[locale]/app/mls/cooperation/(list)/loading"),
};

/** Unreplaced `{placeholder}`, a leaked `undefined`/`NaN`, or an object printed as text. */
const BROKEN = /undefined|NaN|\{[a-zA-Z]+\}|\[object Object\]/;

describe.each(["ru", "uz"] as const)("W4 pages (%s)", (locale) => {
  beforeEach(() => {
    currentLocale = locale;
  });

  it("render every list, filter and empty state without broken text", async () => {
    const html = [
      await render(pages.radar),
      await render(pages.radar, { status: "hidden" }),
      await render(pages.radar, { district: "chilanzar", dealType: "rent" }),
      await render(pages.radar, { q: "zzzqqq" }),
      await render(pages.radar, { status: "converted" }),
      await render(pages.importPost),
      await render(pages.mls),
      await render(pages.mls, { tab: "mine" }),
      await render(pages.mls, { tab: "requests" }),
      await render(pages.mls, { dealType: "sale", rooms: "4", priceMax: "150000", verified: "1", updated: "30" }),
      await render(pages.mls, { priceMax: "1", currency: "UZS" }),
      await render(pages.mls, { q: "zzzqqq" }),
      await render(pages.cooperation),
      await render(pages.cooperation, { direction: "incoming", status: "open" }),
      await render(pages.cooperation, { direction: "outgoing", status: "closed" }),
      await render(pages.cooperation, { direction: "incoming", status: "accepted" }),
      await render(pages.radarNotFound),
      await render(pages.cooperationNotFound),
      await render(pages.radarLoading),
      await render(pages.mlsLoading),
      await render(pages.cooperationLoading),
    ];
    for (const page of html) expect(page).not.toMatch(BROKEN);
  });

  it("renders every Telegram post, raw text next to parsed fields", async () => {
    for (let n = 1; n <= 20; n += 1) {
      const id = `tg-${String(n).padStart(2, "0")}`;
      const html = await render(pages.post, {}, { id });
      expect(html).not.toMatch(BROKEN);
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain(`/${locale}/app/properties/new?fromTelegram=${id}`);
    }
  });

  it("names Unknown explicitly and never guesses a price without a currency", async () => {
    const html = await render(pages.post, {}, { id: "tg-04" });
    expect(html).toContain(locale === "ru" ? "Неизвестно" : "Noma’lum");
    // "700" is only evidence; no money value is rendered for it.
    expect(html).not.toContain("$700");
  });

  it("describes coverage canonically without a channel count", async () => {
    const html = await render(pages.radar);
    expect(html).toContain(locale === "ru" ? "более 10 000 объявлений" : "10 000 dan ortiq e’lon");
    expect(html).toContain("tashkent_kvartiry_demo");
  });

  it("renders every cooperation request with both roles named", async () => {
    for (let n = 1; n <= 7; n += 1) {
      const html = await render(pages.cooperationDetail, {}, { id: `coop-0${n}` });
      expect(html).not.toMatch(BROKEN);
      expect(html).toContain(locale === "ru" ? "Сторона объекта" : "Ob’yekt tomoni");
      expect(html).toContain(locale === "ru" ? "Сторона клиента" : "Mijoz tomoni");
    }
  });

  it("keeps a partner's client and contacts hidden before acceptance", async () => {
    const incoming = await render(pages.cooperationDetail, {}, { id: "coop-03" });
    expect(incoming).toContain("*** **");
    expect(incoming).toContain(
      locale === "ru" ? "Клиент скрыт до принятия условий" : "Mijoz shartlar qabul qilinguncha yashirin",
    );
    const accepted = await render(pages.cooperationDetail, {}, { id: "coop-07" });
    expect(accepted).toContain('href="tel:+998');
  });

  it("walks the new-request states", async () => {
    const html = [
      await render(pages.cooperationNew),
      await render(pages.cooperationNew, { listingId: "lst-16", requirementId: "req-03" }),
      await render(pages.cooperationNew, { listingId: "lst-16", requirementId: "req-99" }),
      await render(pages.cooperationNew, { listingId: "lst-01" }),
      await render(pages.cooperationNew, { listingId: "lst-14" }),
      await render(pages.cooperationNew, { listingId: "lst-23" }),
    ];
    for (const page of html) expect(page).not.toMatch(BROKEN);
    expect(html[1]).toContain(locale === "ru" ? "Что увидит партнёр" : "Hamkor nimani ko‘radi");
    expect(html[3]).toContain(locale === "ru" ? "Это ваш листинг" : "Bu sizning e’loningiz");
    expect(html[5]).toContain(`/${locale}/app/mls/cooperation/coop-02`);
  });

  it("returns not found for unknown or invisible ids", async () => {
    await expect(render(pages.post, {}, { id: "tg-99" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(pages.cooperationDetail, {}, { id: "coop-99" })).rejects.toThrow("NEXT_NOT_FOUND");
    // lst-21 is a partner's restricted listing: indistinguishable from a missing one.
    await expect(render(pages.cooperationNew, { listingId: "lst-21" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("MLS never shows a partner's full address or owner", async () => {
    const html = await render(pages.mls);
    expect(html).toContain(locale === "ru" ? "Запросить сотрудничество" : "Hamkorlik so‘rash");
    expect(html).not.toMatch(/cadastral|кадастровый номер/i);
  });

  it("MLS gives partners the result of a check, not its source (§19)", async () => {
    const { seed } = await import("@/lib/data/seed");
    const html = await render(pages.mls);
    const partnerSources = seed.listings
      .filter((listing) => listing.organizationId !== "org-01" && listing.agentId !== "agent-01")
      .flatMap((listing) => listing.verifications.map((item) => item.source))
      .filter((source) => /№/.test(source));
    expect(partnerSources.length).toBeGreaterThan(0);
    for (const source of partnerSources) expect(html).not.toContain(source);
  });

  it("MLS lists only listings published to partners (§11.1)", async () => {
    const html = await render(pages.mls);
    // lst-28 is a partner's listing that has passed verification but is not yet Active MLS.
    expect(html).not.toContain("/app/properties/lst-28");
    expect(html).toContain("/app/properties/lst-32");
  });

  it("does not call a realtor certified while the certificate check is not confirmed", async () => {
    // agent-05's registry did not answer: the incoming request names no certificate.
    const incoming = await render(pages.cooperationDetail, {}, { id: "coop-03" });
    const { default: domain } = await import("@/i18n/messages/domain");
    // His side of the page runs from his name to his (masked) phone.
    const side = incoming.slice(incoming.indexOf("Jasur Tursunov"), incoming.indexOf("*** **"));
    expect(side).toContain(domain[locale].professionalStatus.unconfirmed);
    expect(side).not.toContain(domain[locale].professionalStatus.certified_realtor);
  });
});
