import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "@/i18n/config";
import search from "@/i18n/messages/search";

/**
 * Server-renders the W1 workspace pages (Today, search, notifications, tasks,
 * new task, more) to static HTML in both locales. `next/root-params` only
 * exists inside a Next request, so the locale getter is replaced here.
 */

let currentLocale: Locale = "ru";
vi.mock("@/i18n/server", () => ({ getLocale: async () => currentLocale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${currentLocale}/app/more`,
  useParams: () => ({ locale: currentLocale }),
}));

type Page = (props: never) => Promise<ReactElement>;

async function render(load: () => Promise<{ default: unknown }>, searchParams: Record<string, string> = {}) {
  const page = (await load()).default as Page;
  const props = { params: Promise.resolve({ locale: currentLocale }), searchParams: Promise.resolve(searchParams) };
  return renderToStaticMarkup(await page(props as never));
}

const pages = {
  today: () => import("@/app/[locale]/app/(today)/page"),
  search: () => import("@/app/[locale]/app/search/page"),
  notifications: () => import("@/app/[locale]/app/notifications/page"),
  tasks: () => import("@/app/[locale]/app/tasks/page"),
  newTask: () => import("@/app/[locale]/app/tasks/new/page"),
  more: () => import("@/app/[locale]/app/more/page"),
};

/** Unreplaced `{placeholder}`, a leaked `undefined`/`NaN`, or an object printed as text. */
const BROKEN = /undefined|NaN|\{[a-zA-Z]+\}|\[object Object\]/;

describe.each(["ru", "uz"] as const)("W1 pages (%s)", (locale) => {
  beforeEach(() => {
    currentLocale = locale;
  });

  it("render every state without broken text", async () => {
    const html = [
      await render(pages.today),
      await render(pages.search),
      await render(pages.search, { q: "Чиланзар 2 комнаты до 70 000" }),
      await render(pages.search, { q: "Chilonzor" }),
      await render(pages.search, { q: "zzzqqq" }),
      await render(pages.search, { q: "+998 90" }),
      await render(pages.notifications),
      await render(pages.notifications, { category: "system" }),
      await render(pages.notifications, { category: "not-a-category" }),
      await render(pages.tasks),
      await render(pages.tasks, { status: "done" }),
      await render(pages.newTask, { clientId: "cl-02" }),
      await render(pages.more),
    ];
    for (const page of html) expect(page).not.toMatch(BROKEN);
  });

  it("Today leads each block to a filtered list", async () => {
    const html = await render(pages.today);
    expect(html).toContain(`href="/${locale}/app/leads?status=new"`);
    expect(html).toContain(`href="/${locale}/app/tasks?status=overdue"`);
    expect(html).toContain(`href="/${locale}/app/mls/cooperation?direction=incoming"`);
    expect(html).toContain(`href="/${locale}/app/properties?scope=mine&amp;freshness=needs_confirmation"`);
  });

  it("search turns a phrase into property filters but leaves the currency to the user", async () => {
    const html = await render(pages.search, { q: "Чиланзар 2 комнаты до 70 000" });
    expect(html).toContain(`href="/${locale}/app/properties?district=chilanzar&amp;roomsMin=2&amp;roomsMax=2"`);
    expect(html).toContain("priceMax=70000&amp;currency=USD");
    expect(html).toContain("priceMax=70000&amp;currency=UZS");
  });

  it("search explains masked partner listings", async () => {
    const html = await render(pages.search, { q: "Chilonzor" });
    expect(html).toContain(search[locale].masked.title);
    expect(html).toContain(search[locale].masked.badge);
  });

  it("notifications mark unread items with text, not only colour", async () => {
    const html = await render(pages.notifications);
    expect(html).toMatch(/<span class="sr-only">(Новое|Yangi): <\/span>/);
  });

  it("an unknown task filter falls back to all tasks and a known one narrows the list", async () => {
    const all = await render(pages.tasks, { status: "bogus" });
    const done = await render(pages.tasks, { status: "done" });
    expect(all).toContain('id="tasks-overdue"');
    expect(done).not.toContain('id="tasks-overdue"');
    expect(done).toContain('id="tasks-done"');
  });

  it("the security notification switch cannot be turned off", async () => {
    const html = await render(pages.more);
    expect(html).toMatch(/role="switch" aria-checked="true"[^>]*disabled=""/);
  });
});
