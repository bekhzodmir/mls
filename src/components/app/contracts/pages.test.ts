import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Page-level smoke tests for the contract routes, in both languages: list
 * filters (display status incl. "expiring", kind, search) and empty states;
 * the workspace's clauses, right holders, signatures, activation check,
 * links, related contracts, permission-limited and stale states, the legal
 * disclaimer; lookup by number; not-found. `getLocale` and the navigation
 * hooks are doubles.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => `/${state.locale}/app/contracts`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: ContractsPage, generateMetadata: listMetadata } = await import("@/app/[locale]/app/contracts/(list)/page");
const { default: ContractPage, generateMetadata: contractMetadata } = await import("@/app/[locale]/app/contracts/[id]/page");
const { default: ContractLayout } = await import("@/app/[locale]/app/contracts/[id]/layout");
const { default: ContractNotFound } = await import("@/app/[locale]/app/contracts/not-found");

type Search = Record<string, string | string[] | undefined>;

async function render(page: Promise<ReactElement> | ReactElement): Promise<string> {
  return renderToStaticMarkup(await page).replace(/[  ]/g, " ");
}

// The page props are typed by Next's generated PageProps; tests only pass what the pages read.
const props = (params: Record<string, string>, searchParams: Search = {}) =>
  ({ params: Promise.resolve({ locale: state.locale, ...params }), searchParams: Promise.resolve(searchParams) }) as never;

/** Visible text only: tags and React's text separators removed. */
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
}

function expectNoLeftovers(html: string) {
  expect(html).not.toMatch(/\{[a-z]\w*\}/i);
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("NaN");
}

const PHONE = /\+?998\d{9}/;

beforeEach(() => {
  state.locale = "ru";
});

describe("/app/contracts", () => {
  it("lists the organization's contracts, expiring first, with status, kind, customer and issues", async () => {
    const html = await render(ContractsPage(props({})));
    const text = textOf(html);
    expect(text).toContain("Истекают в ближайшие 14 дней: 3 · ждут подписи: 2");
    expect(text).toContain("Договор DR-2026-055");
    expect(text).toContain("Истекает через 5 дней");
    expect(text).toContain("Собственник: Ильдар Гафуров");
    expect(text).toContain("Партнёрское соглашение");
    expect(text).toContain("Нет 1 согласия"); // DR-2026-061
    expect(text).toContain("Простая ЭП"); // DR-2026-052
    expect(text).toContain("Истёк 3 дня назад"); // DR-2026-019
    expect(text).toContain("Не привязан к объекту"); // buyer contracts
    expect(html).toContain("/ru/app/contracts/ctr-dr-2026-055");
    expect(html).toContain("/ru/app/consents");
    expect(html.indexOf("ctr-dr-2026-055")).toBeLessThan(html.indexOf("ctr-dr-2026-041"));
    expect(html.indexOf("ctr-dr-2026-052")).toBeLessThan(html.indexOf("ctr-co-2026-005"));
    expectNoLeftovers(html);
  });

  it("filters by display status, kind and search", async () => {
    const expiring = textOf(await render(ContractsPage(props({}, { status: "expiring" }))));
    expect(expiring).toContain("3 договора");
    expect(expiring).toContain("Истекают 3");
    expect(expiring).not.toContain("DR-2026-044");
    const buyer = await render(ContractsPage(props({}, { kind: "buyer_service", status: "terminated" })));
    expect(textOf(buyer)).toContain("1 договор");
    expect(buyer).toContain("ctr-drb-2026-003");
    const search = textOf(await render(ContractsPage(props({}, { q: "DR-2026-043" }))));
    expect(search).toContain("Поиск: «DR-2026-043» · 1 договор");
    expect(search).toContain("Сбросить поиск");
  });

  it("explains an empty filtered result and how to reset it", async () => {
    const html = await render(ContractsPage(props({}, { kind: "cooperation", status: "expired" })));
    expect(textOf(html)).toContain("По выбранным условиям договоров нет");
    expect(html).toContain('href="/ru/app/contracts"');
  });

  it("renders in Uzbek", async () => {
    state.locale = "uz";
    const html = await render(ContractsPage(props({})));
    const text = textOf(html);
    expect(text).toContain("Shartnomalar");
    expect(text).toContain("5 kundan keyin tugaydi");
    expect(text).toContain("Hamkorlik kelishuvi");
    expectNoLeftovers(html);
    expect((await listMetadata()).title).toBe("Shartnomalar");
  });
});

describe("/app/contracts/[id]", () => {
  it("blocks a contract whose co-owner has not consented (art. 37) and lists every unmet condition", async () => {
    const html = await render(ContractPage(props({ id: "ctr-dr-2026-061" })));
    const text = textOf(html);
    expect(text).toContain("Договор DR-2026-061");
    expect(text).toContain("Ждёт подписи");
    expect(text).toContain("Не выполнены условия вступления в силу:");
    expect(text).toContain("Нет согласия правообладателя: Дилноза Норматова (ст. 37).");
    expect(text).toContain("Нет подписи заказчика.");
    expect(text).toContain("Согласие одного правообладателя не считается согласием остальных");
    expect(text).toContain("Согласия: 1 из 2");
    expect(text).toContain("Согласия нет");
    expect(text).toContain("Другой правообладатель");
    expect(text).toContain("Шаблоны и юридическая сила требуют проверки юриста");
    expect(text).toContain("Отправить на подпись повторно");
    expect(html).toContain("/ru/app/owners/owner-34");
    expect(html).toContain("data-sticky-actions");
    expectNoLeftovers(html);
  });

  it("shows the §38.5 checklist with the missing insurance clause", async () => {
    const text = textOf(await render(ContractPage(props({ id: "ctr-dr-2026-043" }))));
    expect(text).toContain("Есть 9 из 10 условий");
    expect(text).toContain("Сведения о страхованииНет в тексте");
    expect(text).toContain("Договор действует, но есть замечания:");
    expect(text).toContain("В тексте нет обязательного условия: Сведения о страховании.");
  });

  it("warns neutrally about a simple electronic signature and never calls it qualified", async () => {
    const text = textOf(await render(ContractPage(props({ id: "ctr-dr-2026-052" }))));
    expect(text).toContain("Простая электронная подпись · ");
    expect(text).toContain("должен подтвердить юрист. Это не квалифицированная электронная подпись.");
    expect(text).toContain("Нажатие кнопки в Binor не является квалифицированной электронной подписью.");
    expect(text).toContain("Истекает через 13 дней");
  });

  it("points an expiring contract to its prepared renewal and opens by document number", async () => {
    const html = await render(ContractPage(props({ id: "DR-2026-055" })));
    const text = textOf(html);
    expect(text).toContain("Черновик продления уже подготовлен: DR-2026-062");
    expect(html).toContain("/ru/app/contracts/ctr-dr-2026-062");
    expect(text).toContain("Продление");
    expect(text).toContain("Расторгнуть");
    expect((await contractMetadata(props({ id: "DR-2026-055" }))).title).toBe("Договор DR-2026-055");
  });

  it("links a co-broking agreement to its request and deal and says the split is not a Binor fee", async () => {
    const html = await render(ContractPage(props({ id: "ctr-co-2026-004" })));
    const text = textOf(html);
    expect(text).toContain("Сторона — партнёр-риэлтор");
    expect(text).toContain("не плата Binor");
    expect(text).toContain("Это не договор по конкретному объекту");
    expect(html).toContain("/ru/app/mls/cooperation/coop-01");
    expect(html).toContain("/ru/app/deals/deal-06");
    expect(html).toContain("/ru/app/partners/agent-04");
  });

  it("asks the partner, not a customer, to sign a co-broking agreement", async () => {
    const text = textOf(await render(ContractPage(props({ id: "ctr-co-2026-005" }))));
    expect(text).toContain("Нет подписи партнёра.");
    expect(text).toContain("Нет подписи партнёра");
    expect(text).not.toContain("Нет подписи заказчика");
    expect(text).toContain("Квалифицированная электронная подпись · ");
  });

  it("limits a colleague's contract: no owner phone, no actions, and says who can act", async () => {
    const html = await render(ContractPage(props({ id: "ctr-dr-2026-047" })));
    const text = textOf(html);
    expect(text).toContain("Договор коллеги: Нигора Юсупова");
    expect(text).toContain("Договор ведёт Нигора Юсупова.");
    expect(text).toContain("Контакт скрыт");
    expect(html).not.toMatch(PHONE);
    expect(html).not.toContain("data-sticky-actions");
  });

  it("shows an expired contract as stale: days ago and a newer template", async () => {
    const text = textOf(await render(ContractPage(props({ id: "ctr-dr-2026-019" }))));
    expect(text).toContain("Истёк 3 дня назад");
    expect(text).toContain("более новая версия шаблона: owner-service@2026-08");
    expect(text).toContain("Договор закрыт");
    expect(text).toContain("Продлить");
  });

  it("shows a terminated contract's reason without actions", async () => {
    const html = await render(ContractPage(props({ id: "ctr-drb-2026-003" })));
    const text = textOf(html);
    expect(text).toContain("Расторгнут");
    expect(text).toContain("Причина расторжения: Расторгнут по просьбе клиентки");
    expect(text).toContain("Для договора в этом статусе действий нет.");
    expect(html).toContain("/ru/app/requirements/req-12");
  });

  it("answers an unknown or partner contract with not-found", async () => {
    for (const id of ["ctr-404", "ctr-tm-2026-074", "TM-2026-074"]) {
      await expect(ContractLayout({ children: null, params: Promise.resolve({ locale: "ru", id }) } as never)).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      await expect(ContractPage(props({ id }))).rejects.toThrow("NEXT_NOT_FOUND");
    }
    const html = await render(ContractNotFound());
    expect(html).toContain("Договор не найден");
    expect(html).toContain('href="/ru/app/contracts"');
  });

  it("renders in Uzbek", async () => {
    state.locale = "uz";
    const html = await render(ContractPage(props({ id: "ctr-dr-2026-061" })));
    const text = textOf(html);
    expect(text).toContain("Shartnoma DR-2026-061");
    expect(text).toContain("Huquq egasining roziligi yo‘q: Дилноза Норматова (37-modda).");
    expect(text).toContain("Majburiy shartlar");
    expectNoLeftovers(html);
  });
});
