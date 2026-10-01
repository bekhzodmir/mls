import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "@/lib/data/seed";

/**
 * Page-level smoke tests for the offer routes: each async page is called
 * with URL params and rendered to HTML in both languages — list filters and
 * empty states, the detail page's timeline, whose turn it is, the demo
 * answer actions, links to property, client and deal, and not-found.
 * `getLocale` and the navigation hooks are doubles.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => `/${state.locale}/app/offers`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: OffersPage, generateMetadata: listMetadata } = await import("@/app/[locale]/app/offers/(list)/page");
const { default: OfferPage, generateMetadata: offerMetadata } = await import("@/app/[locale]/app/offers/[id]/page");
const { default: OfferLayout } = await import("@/app/[locale]/app/offers/[id]/layout");
const { default: OfferNotFound } = await import("@/app/[locale]/app/offers/not-found");

type Search = Record<string, string | string[] | undefined>;

async function render(page: Promise<ReactElement> | ReactElement): Promise<string> {
  return renderToStaticMarkup(await page).replace(/[  ]/g, " ");
}

// The page props are typed by Next's generated PageProps; tests only pass what the pages read.
const props = (params: Record<string, string>, searchParams: Search = {}) =>
  ({ params: Promise.resolve({ locale: state.locale, ...params }), searchParams: Promise.resolve(searchParams) }) as never;

/** Owner names and phones must never reach an offer page (§18.2). */
const ownerSecrets = seed.owners.flatMap((owner) => [owner.name, owner.phone]);

function expectNoLeftovers(html: string) {
  expect(html).not.toMatch(/\{[a-z]\w*\}/i);
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("NaN");
}

beforeEach(() => {
  state.locale = "ru";
});

describe("/app/offers", () => {
  it("lists every offer with the gap in money, whose turn it is, the status and the deal", async () => {
    const html = await render(OffersPage(props({})));
    expect(html).toContain("Ждут ответа: 2 · срок ответа истёк: 0");
    expect(html).toContain("6 предложений");
    // offer-01: $225 000 against $235 000 asking.
    expect(html).toContain("Ниже цены объекта на $10 000");
    expect(html).toContain("Цена объекта: $235 000");
    expect(html).toContain("Ответ за стороной «Собственник»");
    expect(html).toContain("Ответ за стороной «Покупатель»");
    expect(html).toContain("Равно цене объекта"); // offer-03 accepted at the asking price
    expect(html).toContain("/ru/app/offers/offer-01");
    expect(html).toContain("/ru/app/deals/deal-02");
    expect(html).toContain("Сделки по этому предложению ещё нет"); // offer-05
    expect(html).toContain('aria-current="true"');
    for (const secret of ownerSecrets) expect(html).not.toContain(secret);
    expectNoLeftovers(html);
    // Waiting offers come before decided ones.
    expect(html.indexOf("/ru/app/offers/offer-05")).toBeLessThan(html.indexOf("/ru/app/offers/offer-04"));
  });

  it("filters by status from the URL and explains an empty result", async () => {
    const accepted = await render(OffersPage(props({}, { status: "accepted" })));
    expect(accepted).toContain("Принято · 4 предложения");
    expect(accepted).not.toContain("/ru/app/offers/offer-01");
    const declined = await render(OffersPage(props({}, { status: "declined" })));
    expect(declined).toContain("Нет предложений со статусом «Отклонено»");
    expect(declined).toContain('href="/ru/app/offers"');
    // An unknown status is ignored.
    expect(await render(OffersPage(props({}, { status: "bogus" })))).toContain("6 предложений");
  });

  it("renders in Uzbek with metadata", async () => {
    state.locale = "uz";
    const html = await render(OffersPage(props({})));
    expect(html).toContain("Takliflar");
    expect(html).toContain("Ob’yekt narxidan $10 000 past");
    expect(html).toContain("Javob «Mulkdor» tomonida");
    expectNoLeftovers(html);
    expect((await listMetadata()).title).toBe("Takliflar");
  });
});

describe("/app/offers/[id]", () => {
  it("shows the full timeline, the current state and the answer actions on the viewer's own listing", async () => {
    const html = await render(OfferPage(props({ id: "offer-01" })));
    for (const amount of ["$215 000", "$232 000", "$225 000"]) expect(html).toContain(amount);
    expect(html).toContain("Версия 3");
    expect(html).toContain("«Собственник готов уступить, но не ниже $230 000.»");
    expect(html).toContain("Ответ до 2 окт., 18:00");
    expect(html).toContain("Ниже цены объекта на $10 000");
    expect(html).toContain("Ответ за стороной «Собственник»");
    // The viewer is the listing agent: they record the owner's answer.
    expect(html).toContain("Принять $225 000");
    expect(html).toContain("Встречное предложение");
    expect(html).toContain("Отклонить");
    expect(html).toContain("data-sticky-actions");
    expect(html).toContain("/ru/app/properties/lst-05");
    expect(html).toContain("/ru/app/clients/cl-06");
    expect(html).toContain("/ru/app/deals/deal-02");
    for (const secret of ownerSecrets) expect(html).not.toContain(secret);
    expectNoLeftovers(html);
    expect((await offerMetadata(props({ id: "offer-01" }))).title).toMatch(/^Предложение: /);
  });

  it("closes a decided offer and says why there is no deal link", async () => {
    const accepted = await render(OfferPage(props({ id: "offer-03" })));
    expect(accepted).toContain("Предложение закрыто (Принято)");
    expect(accepted).not.toContain("data-sticky-actions");
    expect(accepted).toContain("/ru/app/deals/deal-04");
    const noDeal = await render(OfferPage(props({ id: "offer-05" })));
    expect(noDeal).toContain("Сделки по этому предложению ещё нет. Её открывают");
    // A colleague's listing: the viewer answers for the buyer, whose turn it is.
    expect(noDeal).toContain("Ответ за стороной «Покупатель»");
    expect(noDeal).toContain("Агент объекта: Нигора Юсупова");
  });

  it("answers an unknown id with not-found from the layout and the page", async () => {
    await expect(OfferLayout({ children: null, params: Promise.resolve({ locale: "ru", id: "offer-404" }) } as never)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(OfferPage(props({ id: "offer-404" }))).rejects.toThrow("NEXT_NOT_FOUND");
    const html = await render(OfferNotFound());
    expect(html).toContain("Предложение не найдено");
    expect(html).toContain('href="/ru/app/offers"');
  });

  it("renders in Uzbek", async () => {
    state.locale = "uz";
    const html = await render(OfferPage(props({ id: "offer-01" })));
    expect(html).toContain("Muzokaralar tarixi");
    expect(html).toContain("3-versiya");
    expect(html).toContain("$225 000 ni qabul qilish");
    expect(html).toContain("Qarshi taklif");
    expectNoLeftovers(html);
  });
});
