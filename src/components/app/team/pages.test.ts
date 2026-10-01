import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "@/i18n/config";

/**
 * Server-renders the team, routing, partners and audit pages in both
 * locales and every demo role, through every state the seed allows.
 * `next/root-params` only exists inside a Next request, so the locale getter
 * is replaced; `notFound()` throws a marker error.
 */

let currentLocale: Locale = "ru";
vi.mock("@/i18n/server", () => ({ getLocale: async () => currentLocale }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/${currentLocale}/app/team`,
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
  team: () => import("@/app/[locale]/app/team/(overview)/page"),
  member: () => import("@/app/[locale]/app/team/[agentId]/page"),
  routing: () => import("@/app/[locale]/app/team/routing/page"),
  partners: () => import("@/app/[locale]/app/partners/(list)/page"),
  partner: () => import("@/app/[locale]/app/partners/[agentId]/page"),
  audit: () => import("@/app/[locale]/app/audit/page"),
  teamNotFound: () => import("@/app/[locale]/app/team/not-found"),
  partnerNotFound: () => import("@/app/[locale]/app/partners/not-found"),
  teamLoading: () => import("@/app/[locale]/app/team/(overview)/loading"),
  memberLoading: () => import("@/app/[locale]/app/team/[agentId]/loading"),
  routingLoading: () => import("@/app/[locale]/app/team/routing/loading"),
  partnersLoading: () => import("@/app/[locale]/app/partners/(list)/loading"),
  partnerLoading: () => import("@/app/[locale]/app/partners/[agentId]/loading"),
  auditLoading: () => import("@/app/[locale]/app/audit/loading"),
};

/** Unreplaced `{placeholder}`, a leaked `undefined`/`NaN`, or an object printed as text. */
const BROKEN = /undefined|NaN|\{[a-zA-Z]+\}|\[object Object\]/;
const ROLES = [undefined, "team_lead", "agency_owner", "agency_admin"] as const;
const MEMBERS = ["agent-01", "agent-02", "agent-03", "agent-10"];
const PARTNERS = ["agent-04", "agent-05", "agent-06", "agent-07", "agent-08", "agent-09"];
const MY_ROUTES = /^\/(ru|uz)\/app\/(team|partners|audit)(\/|\?|#|$)/;

function withRole(role: (typeof ROLES)[number], params: Record<string, string> = {}) {
  return role ? { ...params, demoRole: role } : params;
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

/** The preview never leaks outside the four screens. */
function expectPreviewContained(html: string) {
  for (const href of hrefs(html)) {
    if (href.includes("demoRole=")) expect(href).toMatch(MY_ROUTES);
  }
}

function count(html: string, text: string): number {
  return html.split(text).length - 1;
}

describe.each(["ru", "uz"] as const)("team, partners and audit pages (%s)", (locale) => {
  beforeEach(() => {
    currentLocale = locale;
  });

  it("render every page and role without broken text, keeping the preview inside", async () => {
    for (const role of ROLES) {
      const html = [
        await render(pages.team, withRole(role)),
        await render(pages.routing, withRole(role)),
        await render(pages.partners, withRole(role)),
        await render(pages.partners, withRole(role, { q: "Namuna" })),
        await render(pages.partners, withRole(role, { q: "zzzqqq" })),
        await render(pages.audit, withRole(role)),
        await render(pages.audit, withRole(role, { sensitive: "1", target: "owner" })),
        await render(pages.audit, withRole(role, { actor: "system", action: "lead_assigned" })),
        await render(pages.audit, withRole(role, { actor: "agent-10" })),
        await render(pages.audit, withRole(role, { action: "deal.stage_changed" })),
        ...(await Promise.all(MEMBERS.map((agentId) => render(pages.member, withRole(role), { agentId })))),
        ...(await Promise.all(PARTNERS.map((agentId) => render(pages.partner, withRole(role), { agentId })))),
      ];
      for (const page of html) {
        expect(page).not.toMatch(BROKEN);
        expectPreviewContained(page);
        if (role) expect(page).toContain(locale === "ru" ? "Демо: просмотр с правами" : "Demo: «");
        else expect(page).not.toContain(locale === "ru" ? "Демо: просмотр с правами" : "huquqlari bilan ko‘rish. Ishchi");
      }
    }
  });

  it("render loading and not-found states", async () => {
    for (const load of [
      pages.teamNotFound,
      pages.partnerNotFound,
      pages.teamLoading,
      pages.memberLoading,
      pages.routingLoading,
      pages.partnersLoading,
      pages.partnerLoading,
      pages.auditLoading,
    ]) {
      expect(await render(load)).not.toMatch(BROKEN);
    }
    await expect(render(pages.member, {}, { agentId: "agent-04" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(pages.partner, {}, { agentId: "agent-02" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(pages.partner, {}, { agentId: "agent-01" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows an agent their own metrics and colleagues' availability only, with the right explained", async () => {
    const hidden = locale === "ru" ? "Показатели скрыты" : "Ko‘rsatkichlar yashirilgan";
    const agent = await render(pages.team);
    expect(count(agent, hidden)).toBe(2);
    expect(agent).toContain(locale === "ru" ? "Вне вашего уровня доступа" : "Kirish darajangizdan tashqarida");
    expect(agent).toContain(locale === "ru" ? "Отсутствует до" : "gacha ishda emas");
    expect(agent).not.toContain(locale === "ru" ? "Итого по команде" : "Jamoa bo‘yicha jami");
    const lead = await render(pages.team, { demoRole: "team_lead" });
    expect(count(lead, hidden)).toBe(0);
    expect(lead).toContain(locale === "ru" ? "Итого по команде" : "Jamoa bo‘yicha jami");
    expect(lead).not.toContain("Шахноза Валиева");
    const owner = await render(pages.team, { demoRole: "agency_owner" });
    expect(owner).toContain("Шахноза Валиева");
    const admin = await render(pages.team, { demoRole: "agency_admin" });
    expect(count(admin, hidden)).toBe(3);
    expect(admin).toContain(locale === "ru" ? "Нужно разрешение" : "Ruxsat kerak");
  });

  it("keeps a colleague's workload behind the reports level on the profile", async () => {
    const colleague = await render(pages.member, {}, { agentId: "agent-03" });
    expect(colleague).toContain(locale === "ru" ? "Вне вашего уровня доступа" : "Kirish darajangizdan tashqarida");
    // A colleague's fact source stays out; the viewer's own profile shows it.
    expect(colleague).not.toContain("Реестр квалификационных сертификатов");
    const own = await render(pages.member, {}, { agentId: "agent-01" });
    expect(own).toContain("Реестр квалификационных сертификатов");
    expect(own).not.toContain(locale === "ru" ? "Вне вашего уровня доступа" : "Kirish darajangizdan tashqarida");
  });

  it("lets only managers edit routing rules and assign, with the reason requirement stated", async () => {
    const agent = await render(pages.routing);
    expect(agent).not.toContain(locale === "ru" ? "Поднять правило" : "qoidasini yuqoriga");
    expect(agent).not.toContain(locale === "ru" ? "Назначить (демо)" : "Tayinlash (demo)");
    expect(agent).toContain(locale === "ru" ? "Результат: Азиз Каримов" : "Natija: Азиз Каримов");
    expect(agent).toContain(locale === "ru" ? "дневной лимит" : "kunlik");
    const lead = await render(pages.routing, { demoRole: "team_lead" });
    expect(lead).toContain(locale === "ru" ? "Поднять правило" : "qoidasini yuqoriga");
    expect(lead).toContain(locale === "ru" ? "Назначить (демо)" : "Tayinlash (demo)");
    expect(lead).toContain(locale === "ru" ? "Причина назначения" : "Tayinlash sababi");
    const admin = await render(pages.routing, { demoRole: "agency_admin" });
    expect(admin).toContain(locale === "ru" ? "Поднять правило" : "qoidasini yuqoriga");
    expect(admin).not.toContain(locale === "ru" ? "Назначить (демо)" : "Tayinlash (demo)");
  });

  it("never shows a partner's contacts without an accepted cooperation", async () => {
    const list = await render(pages.partners);
    for (const digits of ["0105", "0106", "0107", "0109", "01 05", "01 06", "01 07", "01 09"]) {
      expect(list).not.toContain(digits);
    }
    const shared = await render(pages.partner, {}, { agentId: "agent-04" });
    expect(shared).toContain('href="tel:+998900000104"');
    const hidden = await render(pages.partner, {}, { agentId: "agent-09" });
    expect(hidden).not.toContain("tel:");
    expect(hidden).toContain(`/${locale}/app/mls/cooperation/new?listingId=`);
    const pending = await render(pages.partner, {}, { agentId: "agent-06" });
    expect(pending).toContain(`/${locale}/app/mls/cooperation/coop-02`);
    expect(pending).not.toContain("tel:");
    const admin = await render(pages.partners, { demoRole: "agency_admin" });
    expect(admin).toContain(locale === "ru" ? "Недоступно для вашей роли" : "Rolingiz uchun mavjud emas");
    expect(admin).not.toContain("Дильноза Рахимова");
  });

  it("opens journal targets on their own screens", async () => {
    const agent = await render(pages.audit);
    expect(agent).toContain(`href="/${locale}/app/contracts/ctr-drb-2026-014"`);
    expect(agent).toContain(`href="/${locale}/app/partners/agent-08"`);
    expect(agent).toContain(`href="/${locale}/app/consents?subject=client"`);
    expect(agent).toContain(`href="/${locale}/app/owners/owner-34"`);
  });

  it("limits the journal to the role's audit level and keeps it read-only", async () => {
    const agent = await render(pages.audit);
    expect(agent).not.toContain("export-2026-09-24-02");
    expect(agent).not.toContain("session-agent-10-0929");
    expect(agent).toContain(locale === "ru" ? "Журнал нельзя изменить или удалить" : "Jurnalni o‘zgartirib yoki o‘chirib bo‘lmaydi");
    expect(agent).toContain(locale === "ru" ? "Вы видите свою историю" : "Siz o‘z tarixingizni ko‘rasiz");
    const lead = await render(pages.audit, { demoRole: "team_lead" });
    expect(lead).toContain("session-agent-03-0927");
    expect(lead).not.toContain("export-2026-09-24-02");
    const owner = await render(pages.audit, { demoRole: "agency_owner" });
    expect(owner).toContain("export-2026-09-24-02");
    expect(owner).toContain(locale === "ru" ? "Вы видите журнал всего агентства" : "Siz butun agentlik jurnalini ko‘rasiz");
    for (const html of [agent, lead, owner]) {
      expect(html).not.toMatch(/\+998\d{9}/);
      expect(html).not.toMatch(/(Удалить|Изменить запись|O‘chirish)/);
    }
  });
});
