import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Server-render smoke test for the CRM screens (Lead Inbox, lead profile,
 * new lead, client list, client profile, new client, Requirement Editor) in
 * both locales: every seeded record renders, unknown or foreign ids 404, and
 * the key states (SLA, duplicate warning, revoked consent, unconfirmed
 * currency) reach the markup.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${state.locale}/app/clients`,
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
  leads: () => import("@/app/[locale]/app/leads/(list)/page") as Promise<PageModule>,
  lead: () => import("@/app/[locale]/app/leads/[id]/page") as Promise<PageModule>,
  newLead: () => import("@/app/[locale]/app/leads/new/page") as Promise<PageModule>,
  clients: () => import("@/app/[locale]/app/clients/(list)/page") as Promise<PageModule>,
  client: () => import("@/app/[locale]/app/clients/[id]/page") as Promise<PageModule>,
  newClient: () => import("@/app/[locale]/app/clients/new/page") as Promise<PageModule>,
  newRequirement: () => import("@/app/[locale]/app/requirements/new/page") as Promise<PageModule>,
};

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);

describe.each(["ru", "uz"] as const)("CRM pages (%s)", (locale) => {
  it("renders every seeded lead and the inbox filters", async () => {
    state.locale = locale;
    const inbox = await render(await pages.leads(), query());
    expect(inbox).toContain(locale === "ru" ? "Просрочен на" : "oldin o‘tgan");
    expect(inbox).toContain(locale === "ru" ? "Похоже, этот человек уже есть в CRM" : "CRM’da allaqachon bor");
    const empty = await render(await pages.leads(), query({ status: "lost", source: "website" }));
    expect(empty).toContain(locale === "ru" ? "По этому фильтру лидов нет" : "Bu filtr bo‘yicha lidlar yo‘q");
    for (const id of ids("lead", 12)) await render(await pages.lead(), withId(id));
    await expect(render(await pages.lead(), withId("lead-99"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the verbatim message and the duplicate comparison on a lead", async () => {
    state.locale = locale;
    const html = await render(await pages.lead(), withId("lead-06"));
    expect(html).toContain("Хочу посмотреть ещё варианты в Мирзо-Улугбеке, 3 комнаты с ремонтом.");
    expect(html).toContain(locale === "ru" ? "Сравнение с карточкой клиента" : "Mijoz kartochkasi bilan solishtirish");
    expect(html).toContain(`/${locale}/app/clients/new?leadId=lead-06`);
  });

  it("renders client profiles and hides partners' clients", async () => {
    state.locale = locale;
    for (const id of ids("cl", 14)) await render(await pages.client(), withId(id));
    await expect(render(await pages.client(), withId("cl-15"))).rejects.toThrow("NEXT_NOT_FOUND");
    const revoked = await render(await pages.client(), withId("cl-11"));
    expect(revoked).toContain(locale === "ru" ? "Клиент отозвал согласие на связь" : "roziligini qaytarib olgan");
  });

  it("searches clients by a phone fragment", async () => {
    state.locale = locale;
    const html = await render(await pages.clients(), query({ q: "0000302" }));
    expect(html).toContain("Гульнара Сафарова");
    expect(html).not.toContain("Санжар Ибрагимов");
  });

  it("prefills a new client from a lead and warns about the duplicate", async () => {
    state.locale = locale;
    const html = await render(await pages.newClient(), query({ leadId: "lead-06" }));
    expect(html).toContain("Гульнара Сафарова");
    expect(html).toContain(locale === "ru" ? "Похоже, этот человек уже есть в CRM" : "CRM’da allaqachon bor");
    await render(await pages.newLead());
  });

  it("asks for the currency when the lead's sentence has none", async () => {
    state.locale = locale;
    const html = await render(await pages.newRequirement(), query({ leadId: "lead-01" }));
    expect(html).toContain(locale === "ru" ? "Выберите валюту" : "Valyutani tanlang");
    const forClient = await render(await pages.newRequirement(), query({ clientId: "cl-01" }));
    expect(forClient).toContain(locale === "ru" ? "уже есть активный запрос" : "allaqachon faol so‘rov bor");
    const foreign = await render(await pages.newRequirement(), query({ clientId: "cl-15" }));
    expect(foreign).toContain(locale === "ru" ? "не найден или недоступен" : "topilmadi yoki unga kirish yo‘q");
  });

  it("gives every screen a localized title", async () => {
    state.locale = locale;
    for (const load of Object.values(pages)) {
      const metadata = await (await load()).generateMetadata(withId("cl-01") as never);
      expect(typeof metadata.title).toBe("string");
    }
  });
});
