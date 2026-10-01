import { describe, expect, it } from "vitest";
import { listAuditEvents } from "@/lib/data/repository";
import { ORG_AUDIT_ACTIONS, ORG_AUDIT_TARGET_KINDS, AUDIT_ACTIONS } from "@/lib/data/views";
import {
  actionLabel,
  actionOptions,
  actorLabel,
  actorOptions,
  auditHref,
  filterEvents,
  groupByDay,
  parseAuditParams,
  reasonText,
  targetKindLabel,
  targetLabel,
  targetOptions,
  visibleEvents,
} from "./audit-model";
import { purposeError } from "./export-purpose";

const names: Record<string, string> = {
  "agent-01": "Азиз Каримов",
  "agent-02": "Нигора Юсупова",
  "agent-03": "Тимур Ахмедов",
};
const nameOf = (id: string) => names[id];
const byText = (a: string, b: string) => a.localeCompare(b, "ru");

describe("audit params", () => {
  it("keeps known values and drops the rest", () => {
    expect(parseAuditParams({ actor: "agent-02", action: "lead_assigned", target: "lead", sensitive: "1" })).toEqual({
      actor: "agent-02",
      action: "lead_assigned",
      target: "lead",
      sensitive: true,
    });
    expect(parseAuditParams({ action: "deal.stage_changed", target: "offer" })).toEqual({
      action: "deal.stage_changed",
      target: "offer",
    });
    expect(parseAuditParams({ actor: "<script>", action: "drop_table", target: "planet", sensitive: "yes" })).toEqual({});
  });

  it("builds filter links with the preview role last", () => {
    expect(auditHref("ru")).toBe("/ru/app/audit");
    expect(auditHref("ru", { actor: "system", sensitive: true }, "team_lead")).toBe(
      "/ru/app/audit?actor=system&sensitive=1&demoRole=team_lead",
    );
  });
});

describe("audit reach (§19 Audit)", () => {
  it("gives an agent only their own history", async () => {
    const events = await listAuditEvents();
    const own = visibleEvents(events, "agency_agent");
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((view) => view.scope === "own")).toBe(true);
    // The owner's agency-wide export and new-device login are never on the agent's page.
    expect(own.some((view) => view.event.target.id === "export-2026-09-24-02")).toBe(false);
  });

  it("adds the team for a team lead and everything for owner and administrator", async () => {
    const events = await listAuditEvents();
    const lead = visibleEvents(events, "team_lead");
    expect(new Set(lead.map((view) => view.scope))).toEqual(new Set(["own", "team"]));
    expect(visibleEvents(events, "agency_owner")).toHaveLength(events.length);
    expect(visibleEvents(events, "agency_admin")).toHaveLength(events.length);
  });

  it("offers filter options only from what the role can read", async () => {
    const own = visibleEvents(await listAuditEvents(), "agency_agent");
    const actors = actorOptions(own, byText);
    expect(actors.at(-1)).toMatchObject({ id: "system", system: true });
    expect(actors.some((option) => option.id === "agent-10")).toBe(false);
    const actions = actionOptions(own);
    expect(actions.org).not.toContain("role_changed");
    expect(actions.org.every((code) => (ORG_AUDIT_ACTIONS as readonly string[]).includes(code))).toBe(true);
    expect(actions.deal.every((code) => (AUDIT_ACTIONS as readonly string[]).includes(code))).toBe(true);
    expect(targetOptions(own)).not.toContain("export-unknown");
  });

  it("filters by actor, action, kind and sensitivity together", async () => {
    const events = visibleEvents(await listAuditEvents(), "agency_owner");
    const shown = filterEvents(events, { actor: "system", action: "lead_assigned", target: "lead" });
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((view) => view.system && view.event.action === "lead_assigned")).toBe(true);
    expect(filterEvents(events, { sensitive: true }).every((view) => view.sensitive)).toBe(true);
    expect(filterEvents(events, { actor: "system", sensitive: true })).toEqual([]);
  });

  it("groups by Tashkent day, newest first", async () => {
    const groups = groupByDay(await listAuditEvents());
    const days = groups.map((group) => group.day);
    expect([...days].sort().reverse()).toEqual(days);
    expect(new Set(days).size).toBe(days.length);
  });
});

describe("audit labels", () => {
  it("labels every organization action and target kind in both languages", () => {
    for (const locale of ["ru", "uz"] as const) {
      for (const code of [...ORG_AUDIT_ACTIONS, ...AUDIT_ACTIONS]) expect(actionLabel(locale, code), code).not.toMatch(/[a-z]+[._][a-z]/);
      for (const kind of ORG_AUDIT_TARGET_KINDS) expect(targetKindLabel(locale, kind), kind).not.toBe(targetKindLabel(locale, "zzz"));
    }
    expect(actionLabel("ru", "something_new")).toBe("Действие: something_new");
  });

  it("names targets without restricted values and documents by type", async () => {
    const events = await listAuditEvents();
    const doc = events.find((view) => view.event.target.id === "doc-deal-03-3");
    expect(doc && targetLabel("ru", doc)).toBe("Документ: Копия паспорта (doc-deal-03-3)");
    const contract = events.find((view) => view.event.target.kind === "contract");
    expect(contract && targetLabel("uz", contract)).toMatch(/^Shartnoma: (DR|DRB|CO)-2026-\d{3}$/);
  });

  it("localizes machine-written reasons and replaces agent ids with names", async () => {
    const events = await listAuditEvents();
    const reason = (id: string, locale: "ru" | "uz" = "ru") => {
      const view = events.find((item) => item.event.id === id);
      if (!view) throw new Error(id);
      return reasonText(locale, view, nameOf);
    };
    expect(reason("aud-org-21")).toBe("Опубликован в MLS → Есть предложение");
    expect(reason("aud-org-01")).toBe("Агент агентства → Руководитель группы: руководитель команды «Юнусабад»");
    expect(reason("aud-org-01", "uz")).toBe("Agentlik agenti → Guruh rahbari: руководитель команды «Юнусабад»");
    expect(reason("aud-org-06")).toBe(
      "Нигора Юсупова → Азиз Каримов: клиент ищет в Сергели, это территория Азиза. Автор записи сохранён",
    );
    expect(reason("aud-org-48")).toBe("rule-99 «Все остальные лиды»: round-robin → Азиз Каримов");
    expect(reason("aud-org-03")).toBeUndefined();
  });

  it("names the actor, the viewer and the system", async () => {
    const events = await listAuditEvents();
    const system = events.find((view) => view.system);
    const own = events.find((view) => view.event.actorId === "agent-01");
    if (!system || !own) throw new Error("seed must have both");
    expect(actorLabel("ru", system, "agent-01")).toBe("Система");
    expect(actorLabel("uz", system, "agent-01")).toBe("Tizim");
    expect(actorLabel("ru", own, "agent-01")).toBe("Азиз Каримов (Вы)");
  });
});

describe("export purpose", () => {
  it("is required and meaningful", () => {
    expect(purposeError("")).toBe("required");
    expect(purposeError("   ")).toBe("required");
    expect(purposeError("ок")).toBe("short");
    expect(purposeError("Проверка доступа по запросу клиента")).toBeUndefined();
  });
});
