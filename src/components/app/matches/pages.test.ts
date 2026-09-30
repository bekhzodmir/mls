import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Page-level smoke tests for the W3 routes: each async page is called with
 * URL params and its tree is rendered to HTML, covering filters, empty
 * states, not-found and access explanations end to end. `getLocale` and the
 * Next navigation hooks are replaced with test doubles.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => `/${state.locale}/app/properties`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: PropertiesPage } = await import("@/app/[locale]/app/properties/(list)/page");
const { default: PropertyPage } = await import("@/app/[locale]/app/properties/[id]/page");
const { default: NewPropertyPage } = await import("@/app/[locale]/app/properties/new/page");
const { default: MatchesPage } = await import("@/app/[locale]/app/matches/(list)/page");
const { default: MatchPage } = await import("@/app/[locale]/app/matches/[id]/page");
const { default: RequirementPage } = await import("@/app/[locale]/app/requirements/[id]/page");

type Search = Record<string, string | string[] | undefined>;

async function render(page: Promise<ReactElement>): Promise<string> {
  return renderToStaticMarkup(await page).replace(/[  ]/g, " ");
}

// The page props are typed by Next's generated PageProps; tests only pass what the pages read.
const props = (params: Record<string, string>, searchParams: Search = {}) =>
  ({ params: Promise.resolve({ locale: state.locale, ...params }), searchParams: Promise.resolve(searchParams) }) as never;

beforeEach(() => {
  state.locale = "ru";
});

describe("/app/properties", () => {
  it("lists every visible listing by default", async () => {
    const html = await render(PropertiesPage(props({})));
    expect(html).toMatch(/Найдено \d+ объект/);
    expect(html).toContain("/ru/app/properties/lst-01");
    expect(html).not.toContain("/ru/app/properties/lst-21"); // a partner's restricted listing
  });

  it("filters by URL state and names the removable filters", async () => {
    const html = await render(
      PropertiesPage(props({}, { dealType: "sale", district: "chilanzar", priceMax: "75000", currency: "USD" })),
    );
    expect(html).toContain("/ru/app/properties/lst-17");
    expect(html).not.toContain("/ru/app/properties/lst-01");
    expect(html).toContain("Убрать фильтр: Чиланзар");
    expect(html).toContain("До $75 000");
  });

  it("asks for a currency instead of assuming one", async () => {
    const html = await render(PropertiesPage(props({}, { priceMax: "80000" })));
    expect(html).toContain("Цена без валюты не применена");
    expect(html).toContain("currency=UZS");
  });

  it("shows which filters to remove when nothing matches", async () => {
    state.locale = "uz";
    const html = await render(PropertiesPage(props({}, { propertyType: "land", district: "sergeli" })));
    expect(html).toContain("Hech narsa topilmadi");
    expect(html).toContain("Barcha filtrlarni tozalash");
  });

  it("groups by district as the map fallback", async () => {
    const html = await render(PropertiesPage(props({}, { view: "districts", scope: "mine" })));
    expect(html).toContain("Карта пока не подключена");
    expect(html).toContain('id="district-yunusabad"');
  });
});

describe("/app/properties/[id]", () => {
  it("separates the physical object from the agent's offer", async () => {
    const html = await render(PropertyPage(props({ id: "lst-17" })));
    expect(html).toContain("Объект (физический)");
    expect(html).toContain("Предложение агента");
    // prop-17 is also offered as lst-22 by another agency.
    expect(html).toContain("/ru/app/properties/lst-22");
    expect(html).toContain("Контакты собственника скрыты");
  });

  it("offers the stale confirmation to the listing agent", async () => {
    const html = await render(PropertyPage(props({ id: "lst-08" })));
    expect(html).toContain("Объект давно не подтверждали");
    expect(html).toContain("Подтвердить актуальность");
  });

  it("returns not found for unknown and invisible listings alike", async () => {
    await expect(render(PropertyPage(props({ id: "lst-999" })))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(PropertyPage(props({ id: "lst-21" })))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/app/properties/new", () => {
  it("prefills from a Telegram post and links the original", async () => {
    const html = await render(NewPropertyPage(props({}, { fromTelegram: "tg-01" })));
    expect(html).toContain("Данные из Telegram-поста");
    expect(html).toContain('href="https://t.me/');
    expect(html).toContain("Из поста");
  });

  it("explains an unknown post and keeps the form usable", async () => {
    const html = await render(NewPropertyPage(props({}, { fromTelegram: "tg-404" })));
    expect(html).toContain("Пост не найден");
    expect(html).toContain("Проверить дубли");
  });
});

describe("/app/matches", () => {
  it("groups matches by client request", async () => {
    const html = await render(MatchesPage(props({})));
    expect(html).toContain("/ru/app/requirements/req-01");
    expect(html).toContain("Подходит по ");
  });

  it("filters by band and status and offers a reset when empty", async () => {
    const html = await render(MatchesPage(props({}, { band: "possible", status: "won" })));
    expect(html).toContain("Нет совпадений с такими фильтрами");
    expect(html).toContain('href="/ru/app/matches"');
  });

  it("renders a match in full or not found", async () => {
    const html = await render(MatchPage(props({ id: "req-03--lst-16" })));
    expect(html).toContain("Запросить сотрудничество");
    expect(html).toContain("Исходная фраза запроса");
    await expect(render(MatchPage(props({ id: "req-03--lst-999" })))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/app/requirements/[id]", () => {
  it("shows hard and soft criteria, the original phrase and the internal shortlist", async () => {
    const html = await render(RequirementPage(props({ id: "req-01" })));
    expect(html).toContain("Обязательно");
    expect(html).toContain("2-3 комнаты на Чиланзаре");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Отклонённые и дубли");
  });

  it("switches to Telegram posts and sorts by price", async () => {
    state.locale = "uz";
    const html = await render(RequirementPage(props({ id: "req-01" }, { source: "telegram", sort: "price" })));
    expect(html).toContain("/uz/app/radar/tg-01");
    expect(html).not.toContain("/uz/app/properties/lst-17");
  });

  it("explains a paused request instead of showing an empty shortlist", async () => {
    const html = await render(RequirementPage(props({ id: "req-11" })));
    expect(html).toContain("Запрос на паузе");
    expect(html).not.toContain("Подборка</h2>");
  });

  it("hides other agents' requests", async () => {
    await expect(render(RequirementPage(props({ id: "req-17" })))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

/** Unreplaced `{placeholder}`, a leaked `undefined`/`NaN`, or an object printed as text. */
const BROKEN = /undefined|NaN|\{[a-zA-Z]+\}|\[object Object\]/;

describe.each(["ru", "uz"] as const)("W3 pages render without broken text (%s)", (locale) => {
  beforeEach(() => {
    state.locale = locale;
  });

  it("property list states", async () => {
    for (const search of [
      {},
      { scope: "mine" },
      { scope: "agency", view: "districts" },
      { scope: "mls", dealType: "rent", currency: "UZS" },
      { priceMax: "90 000" },
      { freshness: "needs_confirmation", source: "agency", status: "active_mls" },
      { propertyType: "land", district: "sergeli", roomsMin: "2", roomsMax: "3" },
      { q: "Новза" },
      { scope: "bogus", roomsMin: "x", priceMax: "-1" },
    ]) {
      expect(await render(PropertiesPage(props({}, search)))).not.toMatch(BROKEN);
    }
  });

  it("every visible listing profile", async () => {
    const { listListings } = await import("@/lib/data/repository");
    for (const view of await listListings()) {
      expect(await render(PropertyPage(props({ id: view.listing.id })))).not.toMatch(BROKEN);
    }
  });

  it("new property with and without a post", async () => {
    for (const search of [{}, { fromTelegram: "tg-01" }, { fromTelegram: "tg-04" }, { fromTelegram: "nope" }]) {
      expect(await render(NewPropertyPage(props({}, search)))).not.toMatch(BROKEN);
    }
  });

  it("match feed, every match and every requirement", async () => {
    const { listMatchFeed, listRequirements } = await import("@/lib/data/repository");
    for (const search of [{}, { band: "excellent" }, { status: "rejected" }, { band: "good", status: "won" }]) {
      expect(await render(MatchesPage(props({}, search)))).not.toMatch(BROKEN);
    }
    for (const match of await listMatchFeed()) {
      expect(await render(MatchPage(props({ id: match.id })))).not.toMatch(BROKEN);
    }
    for (const view of await listRequirements()) {
      for (const search of [{}, { source: "telegram", sort: "freshness" }, { sort: "price" }]) {
        expect(await render(RequirementPage(props({ id: view.requirement.id }, search)))).not.toMatch(BROKEN);
      }
    }
  });
});
