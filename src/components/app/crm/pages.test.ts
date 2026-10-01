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

  it("links the client's communication history, offers and the consent registry", async () => {
    state.locale = locale;
    const html = await render(await pages.client(), withId("cl-06"));
    expect(html).toContain(`href="/${locale}/app/calls/timeline?clientId=cl-06"`);
    expect(html).toContain(`href="/${locale}/app/offers/offer-01"`);
    expect(html).toContain(`href="/${locale}/app/consents?subject=client"`);
  });

  it("links a lead's communication history and the routing simulator, and asks for an assignment reason", async () => {
    state.locale = locale;
    const html = await render(await pages.lead(), withId("lead-12"));
    expect(html).toContain(`href="/${locale}/app/calls/timeline?leadId=lead-12"`);
    expect(html).toContain(`href="/${locale}/app/team/routing#simulator"`);
    expect(html).toContain(locale === "ru" ? "Причина назначения" : "Biriktirish sababi");
    expect(html).toMatch(/<textarea[^>]*required=""/);
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
    await render(await pages.newLead(), query());
  });

  it("prefills the number of a call: new lead with source phone, new client with or without a lead", async () => {
    state.locale = locale;
    const lead = await render(await pages.newLead(), query({ phone: "+998930000311" }));
    expect(lead).toContain('value="+998 93 000 03 11"');
    expect(lead).toMatch(/<option value="phone" selected="">/);
    const blank = await render(await pages.newLead(), query());
    expect(blank).not.toContain('value="+998 93 000 03 11"');

    const client = await render(await pages.newClient(), query({ phone: "+998930000311" }));
    expect(client).toContain('value="+998 93 000 03 11"');
    expect(client).toMatch(/<option value="phone" selected="">/);
    // The lead's own number wins; its source stays the lead's.
    const fromLead = await render(await pages.newClient(), query({ leadId: "lead-06", phone: "+998900000000" }));
    expect(fromLead).not.toContain('value="+998 90 000 00 00"');
  });

  it("starts a requirement from a phrase in ?q= and parses it", async () => {
    state.locale = locale;
    const html = await render(
      await pages.newRequirement(),
      query({ leadId: "lead-01", q: "3 комнаты в Юнусабаде до 90 000 $" }),
    );
    expect(html).toContain("3 комнаты в Юнусабаде до 90 000 $</textarea>");
    expect(html).toContain(locale === "ru" ? "Юнусабад" : "Yunusobod");
    expect(html).not.toContain(locale === "ru" ? "Выберите валюту" : "Valyutani tanlang");
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

  it("opens a stored requirement for editing and falls back to a new one for unknown ids", async () => {
    state.locale = locale;
    const edit = await render(await pages.newRequirement(), query({ clientId: "cl-02", requirementId: "req-03" }));
    expect(edit).toContain(locale === "ru" ? "Изменить запрос" : "So‘rovni tahrirlash");
    expect(edit).toContain(locale === "ru" ? "Сохранить изменения" : "O‘zgarishlarni saqlash");
    // Editing the client's active requirement is not warned about as a duplicate.
    expect(edit).not.toContain(locale === "ru" ? "уже есть активный запрос" : "allaqachon faol so‘rov bor");
    const partner = await render(await pages.newRequirement(), query({ requirementId: "req-17" }));
    expect(partner).toContain(locale === "ru" ? "Запрос из ссылки не найден" : "Havoladagi so‘rov topilmadi");
    const metadata = await (await pages.newRequirement()).generateMetadata(query({ requirementId: "req-03" }) as never);
    expect(metadata.title).toBe(locale === "ru" ? "Изменить запрос клиента" : "Mijoz so‘rovini tahrirlash");
  });

  it("gives every screen a localized title", async () => {
    state.locale = locale;
    for (const load of Object.values(pages)) {
      const metadata = await (await load()).generateMetadata(withId("cl-01") as never);
      expect(typeof metadata.title).toBe("string");
    }
  });
});
