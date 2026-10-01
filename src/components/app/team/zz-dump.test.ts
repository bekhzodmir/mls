import { it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
let currentLocale = "ru";
vi.mock("@/i18n/server", () => ({ getLocale: async () => currentLocale }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), notFound: () => { throw new Error("NF"); } }));
const out = "/tmp/claude-0/-home-user-mls/dca01a68-bb5e-59ff-b499-8ee2bfa8cb3c/scratchpad/";
function text(html: string) {
  return html.replace(/<(h[1-3]|p|li|dt|dd|button|a|summary|legend|label|option|time)[^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
}
async function dump(name: string, load: () => Promise<{ default: unknown }>, sp: Record<string, string> = {}, params: Record<string, string> = {}) {
  const page = (await load()).default as (p: unknown) => Promise<React.ReactElement>;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ locale: currentLocale, ...params }), searchParams: Promise.resolve(sp) }));
  writeFileSync(out + name + ".txt", text(html));
}
it("dump", async () => {
  await dump("team-agent", () => import("@/app/[locale]/app/team/(overview)/page"));
  await dump("team-owner", () => import("@/app/[locale]/app/team/(overview)/page"), { demoRole: "agency_owner" });
  await dump("member-03", () => import("@/app/[locale]/app/team/[agentId]/page"), {}, { agentId: "agent-03" });
  await dump("routing-agent", () => import("@/app/[locale]/app/team/routing/page"));
  await dump("partners", () => import("@/app/[locale]/app/partners/(list)/page"));
  await dump("partner-09", () => import("@/app/[locale]/app/partners/[agentId]/page"), {}, { agentId: "agent-09" });
  await dump("audit-agent", () => import("@/app/[locale]/app/audit/page"));
  currentLocale = "uz";
  await dump("routing-uz-lead", () => import("@/app/[locale]/app/team/routing/page"), { demoRole: "team_lead" });
  await dump("audit-uz-owner", () => import("@/app/[locale]/app/audit/page"), { demoRole: "agency_owner" });
});
