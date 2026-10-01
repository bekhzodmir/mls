import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { listOwners } from "@/lib/data/repository";

/**
 * Server-render smoke test for the owner screens (list, profile, new owner)
 * in both locales: every owner the viewer may know renders, unknown ids 404,
 * and the key states — hidden contact with the right to ask for, a missing
 * co-owner consent, the duplicate check before saving — reach the markup.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${state.locale}/app/owners`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type PageModule = {
  default: (props: never) => Promise<ReactElement>;
  generateMetadata?: (props: never) => Promise<{ title?: unknown }>;
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
  list: () => import("@/app/[locale]/app/owners/(list)/page") as Promise<PageModule>,
  owner: () => import("@/app/[locale]/app/owners/[id]/page") as Promise<PageModule>,
  layout: () => import("@/app/[locale]/app/owners/[id]/layout") as Promise<PageModule>,
  newOwner: () => import("@/app/[locale]/app/owners/new/page") as Promise<PageModule>,
};

describe.each(["ru", "uz"] as const)("owner pages (%s)", (locale) => {
  const ru = locale === "ru";

  it("lists owners with hidden contacts explained and right holders labelled", async () => {
    state.locale = locale;
    const html = await render(await pages.list(), query());
    expect(html).toContain("Дилноза Норматова");
    expect(html).toContain(ru ? "Совладелец / правообладатель" : "Hammulkdor / huquq egasi");
    expect(html).toContain(ru ? "Контакт скрыт" : "Kontakt yashirilgan");
    expect(html).toContain("+998 91 000 02 01");
    // A hidden phone is not in the markup at all, not even masked.
    expect(html).not.toContain("000 02 13");
    expect(html).not.toContain("998910000213");
    expect(html).toContain(`/${locale}/app/owners/owner-34`);
  });

  it("searches by contract number and filters by scope; an empty result offers a reset", async () => {
    state.locale = locale;
    const found = await render(await pages.list(), query({ q: "DR-2026-061" }));
    expect(found).toContain("Равшан Норматов");
    expect(found).toContain("Дилноза Норматова");
    expect(found).not.toContain("Бахтиёр Юлдашев");
    const agency = await render(await pages.list(), query({ scope: "agency" }));
    expect(agency).toContain("Антон Ким");
    expect(agency).not.toContain("Бахтиёр Юлдашев");
    const none = await render(await pages.list(), query({ q: "nobody-here" }));
    expect(none).toContain(ru ? "Никого не нашли" : "Hech kim topilmadi");
  });

  it("renders every owner profile and 404s unknown ids", async () => {
    state.locale = locale;
    for (const item of await listOwners()) await render(await pages.owner(), withId(item.owner.id));
    await expect(render(await pages.owner(), withId("owner-99"))).rejects.toThrow("NEXT_NOT_FOUND");
    // owner-15 owns no listing of the viewer's organization: not linked, so not found.
    await expect(render(await pages.layout(), { ...withId("owner-15"), children: null })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("explains the missing co-owner consent on both right holders (art. 37)", async () => {
    state.locale = locale;
    const coOwner = await render(await pages.owner(), withId("owner-34"));
    expect(coOwner).toContain(ru ? "Нет согласия этого человека по договору DR-2026-061" : "DR-2026-061 shartnoma bo‘yicha bu shaxsning roziligi yo‘q");
    expect(coOwner).toContain(`/${locale}/app/contracts/ctr-dr-2026-061`);
    expect(coOwner).toContain(`/${locale}/app/properties/lst-35`);
    // The co-owner's profile carries the pending consent check of the contract's listing.
    expect(coOwner).toContain("Согласие второго собственника (супруги) не получено");
    const customer = await render(await pages.owner(), withId("owner-33"));
    expect(customer).toContain(ru ? "По договору DR-2026-061 нет согласия: Дилноза Норматова" : "rozilik yo‘q: Дилноза Норматова");
    expect(customer).toContain('href="tel:+998910000233"');
    expect(customer).toContain("data-sticky-actions");
  });

  it("names the right and who grants it when the owner's contact is hidden (§23.5)", async () => {
    state.locale = locale;
    const html = await render(await pages.owner(), withId("owner-13"));
    expect(html).toContain(ru ? "Нужно право: «Данные собственника»" : "Kerakli huquq: «Mulkdor ma’lumotlari»");
    expect(html).toContain(ru ? "Руководитель агентства или Администратор агентства" : "Agentlik rahbari yoki Agentlik administratori");
    expect(html).not.toContain("tel:");
    expect(html).toContain(ru ? "Только результат" : "Faqat natija");
  });

  it("warns about a stale or expired listing instead of showing it as active", async () => {
    state.locale = locale;
    const html = await render(await pages.owner(), withId("owner-07"));
    expect(html).toContain(ru ? "Срок предложения истёк" : "Taklif muddati tugagan");
    expect(html).toContain(`/${locale}/app/properties/lst-07`);
  });

  it("links calls and the owner's call timeline", async () => {
    state.locale = locale;
    const html = await render(await pages.owner(), withId("owner-06"));
    expect(html).toContain(`/${locale}/app/calls/call-06`);
    expect(html).toContain(`/${locale}/app/calls/timeline?ownerId=owner-06`);
  });

  it("runs the duplicate check on a prefilled number before saving", async () => {
    state.locale = locale;
    const html = await render(await pages.newOwner(), query({ phone: "+998 91 000 02 34", listingId: "lst-35" }));
    expect(html).toContain(ru ? "Этот номер уже есть в базе" : "Bu raqam bazada allaqachon bor");
    expect(html).toContain(ru ? "Это другой человек" : "Bu boshqa shaxs");
    expect(html).toContain("Равшан Норматов");
    const missing = await render(await pages.newOwner(), query({ listingId: "lst-99" }));
    expect(missing).toContain(ru ? "Объект из ссылки не найден" : "Havoladagi ob’yekt");
    // The "consent obtained" box is never pre-checked.
    expect(missing).not.toMatch(/type="checkbox"[^>]*checked/);
  });
});
