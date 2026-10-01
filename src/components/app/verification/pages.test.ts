import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Server-render smoke test for the Verification Center and the new request
 * form in both locales: the summary, filters and result-only rule, the
 * "could not verify ≠ confirmed" explanation, the §38.4 access table, the
 * permission-limited state and the not-connected integrations notice.
 */

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "uz" }));

vi.mock("@/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${state.locale}/app/verification`,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type PageModule = { default: (props: never) => Promise<ReactElement> };

async function render(module: PageModule, searchParams: Record<string, string> = {}): Promise<string> {
  return renderToString(
    await module.default({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never),
  );
}

const pages = {
  center: () => import("@/app/[locale]/app/verification/(list)/page") as Promise<PageModule>,
  request: () => import("@/app/[locale]/app/verification/request/page") as Promise<PageModule>,
};

describe.each(["ru", "uz"] as const)("verification pages (%s)", (locale) => {
  const ru = locale === "ru";

  it("shows the queue with a summary, chips and the status legend", async () => {
    state.locale = locale;
    const html = await render(await pages.center());
    expect(html).toContain(ru ? "Сводка по статусам" : "Holatlar bo‘yicha xulosa");
    expect(html).toContain(ru ? "«Не удалось проверить» ≠ «Подтверждено»" : "«Tekshirib bo‘lmadi» ≠ «Tasdiqlangan»");
    expect(html).toContain(ru ? "Только результат" : "Faqat natija");
    expect(html).toContain(`/${locale}/app/verification?status=unavailable`);
    expect(html).toContain(`/${locale}/app/properties/lst-03`);
    expect(html).toContain(ru ? "Проверки теряют актуальность" : "Tekshiruvlar dolzarbligini yo‘qotmoqda");
    // A partner's contract number (the source of its result-only facts) never reaches the page.
    expect(html).not.toContain("MN-2026-009");
    expect(html).toContain("Договор оказания услуг № DR-2026-038");
  });

  it("filters by status, target and subject from the URL", async () => {
    state.locale = locale;
    const unavailable = await render(await pages.center(), { status: "unavailable" });
    expect(unavailable).toContain(ru ? "Реестр не ответил. Это не «Подтверждено»" : "Reestr javob bermadi. Bu «Tasdiqlangan» emas");
    expect(unavailable).toContain(`/${locale}/app/verification/request?listingId=lst-03&amp;subject=encumbrance`);
    // Only the bucket asked for: a confirmed fact of the same listing is not in the list.
    expect(unavailable).not.toContain("Выписка из реестра прав (демо)");
    const organization = await render(await pages.center(), { target: "organization" });
    expect(organization).toContain("Demo Realty");
    expect(organization).toContain(`/${locale}/app/more#more-facts`);
    const none = await render(await pages.center(), { status: "expired", subject: "insurance" });
    expect(none).toContain(ru ? "По этому фильтру проверок нет" : "Bu filtr bo‘yicha tekshiruvlar yo‘q");
  });

  it("prepares a request with the access table, the permission notice and no integrations", async () => {
    state.locale = locale;
    const html = await render(await pages.request(), { listingId: "lst-03", subject: "encumbrance" });
    expect(html).toContain(ru ? "Госинтеграции в этой сборке не подключены" : "davlat integratsiyalari ulanmagan");
    expect(html).toContain(ru ? "Нужно право: «Проверки»" : "Kerakli huquq: «Tekshiruvlar»");
    expect(html).toContain(ru ? "Риэлторская организация «Demo Realty»" : "«Demo Realty» rieltorlik tashkiloti");
    expect(html).toContain(ru ? "Агенту по недвижимости — только реестр юрлиц" : "Ko‘chmas mulk agentiga — faqat");
    expect(html).toContain(ru ? "Нотариат" : "Notariat");
    // Prefilled object and its contract, the documents for the chosen block.
    expect(html).toMatch(/<option value="lst-03" selected/);
    expect(html).toContain(ru ? "Согласие всех правообладателей (ст. 37)" : "Barcha huquq egalarining roziligi (37-modda)");
    const missing = await render(await pages.request(), { listingId: "lst-99" });
    expect(missing).toContain(ru ? "Объект из ссылки не найден" : "Havoladagi ob’yekt");
  });
});
