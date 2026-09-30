import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "@/lib/data/seed";

/**
 * Page-level smoke tests for the W5 routes (viewings and deals): each async
 * page is called with URL params and rendered to HTML in both languages,
 * covering filters, empty states, not-found, access rules and the demo
 * islands' initial render. `getLocale` and the navigation hooks are doubles.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => `/${state.locale}/app/deals`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: ViewingsPage } = await import("@/app/[locale]/app/viewings/(list)/page");
const { default: ViewingPage, generateMetadata: viewingMetadata } = await import("@/app/[locale]/app/viewings/[id]/page");
const { default: NewViewingPage } = await import("@/app/[locale]/app/viewings/new/page");
const { default: DealsPage } = await import("@/app/[locale]/app/deals/(list)/page");
const { default: DealPage, generateMetadata: dealMetadata } = await import("@/app/[locale]/app/deals/[id]/page");
const { default: ViewingNotFound } = await import("@/app/[locale]/app/viewings/not-found");
const { default: DealNotFound } = await import("@/app/[locale]/app/deals/not-found");

type Search = Record<string, string | string[] | undefined>;

async function render(page: Promise<ReactElement> | ReactElement): Promise<string> {
  return renderToStaticMarkup(await page).replace(/[\u00A0\u202F]/g, " ");
}

// The page props are typed by Next's generated PageProps; tests only pass what the pages read.
const props = (params: Record<string, string>, searchParams: Search = {}) =>
  ({ params: Promise.resolve({ locale: state.locale, ...params }), searchParams: Promise.resolve(searchParams) }) as never;

/** Owner names and phones must never reach a deal or viewing page (§18.2). */
const ownerSecrets = seed.owners.flatMap((owner) => [owner.name, owner.phone]);

/** Visible text only: tags and React's text separators removed. */
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
}

function expectNoLeftovers(html: string) {
  expect(html).not.toMatch(/\{[a-z]\w*\}/i);
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("NaN");
}

beforeEach(() => {
  state.locale = "ru";
});

describe("/app/viewings", () => {
  it("shows the upcoming agenda by Tashkent day with the conflict on both viewings", async () => {
    const html = await render(ViewingsPage(props({})));
    expect(html).toContain("6 просмотров");
    expect(html).toContain("Сегодня · среда, 30 сентября");
    expect(html).toContain("Завтра · четверг, 1 октября");
    expect(html).toContain("/ru/app/viewings/vw-01");
    expect(html).not.toContain("/ru/app/viewings/vw-07"); // past
    // vw-03 and vw-04 name each other.
    expect(html).toContain("Пересекается по времени: 10:30 · Елена Ковалёва");
    expect(html).toContain("Пересекается по времени: 10:00 · Санжар Ибрагимов");
    expect(html).toContain("Ждём подтверждения собственника");
    expect(html).toContain("Партнёр подтвердил");
    expect(html).toContain('aria-current="true"');
    expectNoLeftovers(html);
  });

  it("filters past and cancelled viewings from the URL", async () => {
    const past = await render(ViewingsPage(props({}, { range: "past" })));
    expect(past).toContain("/ru/app/viewings/vw-07");
    expect(past).not.toContain("/ru/app/viewings/vw-01");
    const cancelled = await render(ViewingsPage(props({}, { range: "all", status: "cancelled" })));
    expect(cancelled).toContain("1 просмотр");
    expect(cancelled).toContain("/ru/app/viewings/vw-10");
  });

  it("explains an empty result and how to widen it", async () => {
    const html = await render(ViewingsPage(props({}, { range: "today", status: "no_show" })));
    expect(html).toContain("Просмотров нет");
    expect(html).toContain("По выбранному периоду и статусу ничего не нашлось.");
    expect(html).toContain("/ru/app/viewings?range=all");
  });

  it("renders in Uzbek", async () => {
    state.locale = "uz";
    const html = await render(ViewingsPage(props({})));
    expect(html).toContain("Bugun · ");
    expect(html).toContain("Ertaga · ");
    expect(html).toContain("/uz/app/viewings/new");
    expectNoLeftovers(html);
  });
});

describe("/app/viewings/[id]", () => {
  it("shows time, place with rights, participants and the demo actions", async () => {
    const html = await render(ViewingPage(props({ id: "vw-01" })));
    expect(html).toContain("Ташкент (UTC+5)");
    expect(html).toContain("14:00–15:00");
    expect(html).toContain("Юнусабад-19, дом 7, кв. 34"); // own listing: address visible
    expect(html).toContain("/ru/app/properties/lst-01");
    expect(html).toContain("Клиент подтвердил");
    // Today's viewing: the outcome can be recorded.
    expect(html).toContain("Отметить результат");
    expect(html).toContain("Перенести");
    for (const secret of ownerSecrets) expect(html).not.toContain(secret);
    expectNoLeftovers(html);
  });

  it("warns about the overlap and shows a completed viewing's feedback and next step", async () => {
    const conflict = await render(ViewingPage(props({ id: "vw-03" })));
    expect(conflict).toContain("Время пересекается с другим просмотром");
    const done = await render(ViewingPage(props({ id: "vw-07" })));
    expect(done).toContain("4 из 5 — Понравилось");
    expect(done).toContain("Сделать предложение $108 000");
    expect(done).toContain("Назначить новый просмотр");
  });

  it("returns not found for unknown ids and titles the page safely", async () => {
    await expect(ViewingPage(props({ id: "vw-99" }))).rejects.toThrow("NEXT_NOT_FOUND");
    const html = await render(ViewingNotFound());
    expect(html).toContain("Просмотр не найден");
    const metadata = await viewingMetadata(props({ id: "vw-01" }));
    expect(String(metadata.title)).toMatch(/^Просмотр: /);
    expect(String(metadata.title)).not.toContain("кв.");
  });
});

describe("/app/viewings/new", () => {
  it("preselects client and listing from the URL", async () => {
    const html = await render(NewViewingPage(props({}, { clientId: "cl-02", listingId: "lst-01" })));
    expect(html).toMatch(/<option value="cl-02" selected="">/);
    expect(html).toMatch(/<option value="lst-01" selected="">/);
    expect(html).toContain("По времени Ташкента (UTC+5)");
    expect(html).not.toContain("не найден или недоступен");
    // Listing labels never carry the address.
    expect(html).not.toContain("Юнусабад-19, дом 7");
    expectNoLeftovers(html);
  });

  it("explains ids it cannot use instead of failing", async () => {
    const html = await render(NewViewingPage(props({}, { clientId: "cl-15", listingId: "lst-21" })));
    expect(html).toContain("Клиент из ссылки не найден или недоступен");
    expect(html).toContain("Объект из ссылки не найден или недоступен");
  });

  it("masks a partner listing and points to cooperation first", async () => {
    const html = await render(NewViewingPage(props({}, { listingId: "lst-16" })));
    expect(html).toContain("Точный адрес и контакты собственника партнёр раскроет");
    expect(html).toContain("/ru/app/mls/cooperation/new?listingId=lst-16");
  });
});

describe("/app/deals", () => {
  it("shows every stage with counts and the board", async () => {
    const html = await render(DealsPage(props({})));
    expect(html).toContain("6 сделок");
    expect(html).toContain("/ru/app/deals?stage=act");
    expect(html).toContain("Нет сделок на этом этапе");
    for (const id of ["deal-01", "deal-02", "deal-03", "deal-04", "deal-05", "deal-06"]) {
      expect(html).toContain(`/ru/app/deals/${id}`);
    }
    expect(html).toContain("Согласовано");
    expect(html).toContain("Цена объекта");
    expect(html).toContain("MLS: осталось 1 раб. дн.");
    expect(html).toContain("Просрочено");
    expectNoLeftovers(html);
  });

  it("narrows to one stage and explains an empty one", async () => {
    const act = await render(DealsPage(props({}, { stage: "act" })));
    expect(act).toContain("Акт · 1 сделка");
    expect(act).toContain("/ru/app/deals/deal-06");
    expect(act).not.toContain("/ru/app/deals/deal-01");
    const empty = await render(DealsPage(props({}, { stage: "qualification" })));
    expect(empty).toContain("На этапе «Квалификация» сделок нет");
    const bogus = await render(DealsPage(props({}, { stage: "won" })));
    expect(bogus).toContain("6 сделок");
  });
});

describe("/app/deals/[id]", () => {
  it("renders the MLS deal: stepper, commission split, accrued ≠ paid, MLS window, audit", async () => {
    const html = await render(DealPage(props({ id: "deal-06" })));
    expect(html).toMatch(/<li aria-current="step"[^>]*>.*?Акт/);
    expect(html).toContain("Перейти к этапу «Комиссия»");
    expect(html).toContain("не комиссия Binor");
    expect(textOf(html)).toContain("Дильноза Рахимова · 60% · $1 476");
    expect(textOf(html)).toContain("Азиз Каримов · 40% · $984");
    expect(textOf(html)).toContain("Начислено: да — условие «После подписания акта» выполнено");
    expect(textOf(html)).toContain("Выплачено: нет — выплата не зафиксирована");
    expect(html).toContain("осталось рабочих дней — 1");
    expect(html).toContain("Закрытие → Акт"); // stage codes in the audit reason are localized
    expect(html).toContain("Журнал только дополняется");
    expect(html).toContain("/ru/app/mls/cooperation/coop-01");
    for (const secret of ownerSecrets) expect(html).not.toContain(secret);
    expectNoLeftovers(html);
  });

  it("shows negotiation versions with sides and the restricted documents explanation", async () => {
    const html = await render(DealPage(props({ id: "deal-02" })));
    expect(html).toContain("Версия 3");
    expect(html).toContain("Собственник");
    expect(html).toContain("«Собственник готов уступить, но не ниже $230 000.»");
    expect(html).toContain("Ещё не согласована");
    expect(html).toContain("Доступ по правам");
    expect(html).toContain("Загрузить");
    expect(html).toContain("Сделка без партнёра по MLS");
    expect(html).toContain("Сделка не через MLS");
  });

  it("renders every deal in Uzbek without leftovers", async () => {
    state.locale = "uz";
    for (const id of ["deal-01", "deal-02", "deal-03", "deal-04", "deal-05", "deal-06"]) {
      const html = await render(DealPage(props({ id })));
      expect(html).toContain("Harakatlar jurnali");
      expectNoLeftovers(html);
    }
  });

  it("returns not found for unknown ids", async () => {
    await expect(DealPage(props({ id: "deal-99" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await render(DealNotFound())).toContain("Сделка не найдена");
    const metadata = await dealMetadata(props({ id: "deal-06" }));
    expect(String(metadata.title)).toMatch(/^Сделка: /);
  });
});
