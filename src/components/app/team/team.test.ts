import { describe, expect, it } from "vitest";
import { getLead, getMyTeam, getRoutingContext } from "@/lib/data/repository";
import { routeLead, routingInputFromLead, type RoutingResult } from "@/lib/domain/routing";
import type { AgentAvailability, RoutingRule } from "@/lib/domain/types";
import type { LeadView, TeamMemberView } from "@/lib/data/views";
import {
  assignCheck,
  auditReach,
  cooperationCheck,
  exportCheck,
  memberOwnership,
  metricsCheck,
  partnersCheck,
  routingEditCheck,
} from "./access";
import { accessText, levelText } from "./access-text";
import { actingRole, parseDemoRole, withDemoRole } from "./demo-role";
import {
  assignmentErrors,
  assignmentRecord,
  changedRuleIds,
  composedRoutingInput,
  EMPTY_COMPOSED_INPUT,
  moveRule,
  reasonRequired,
  ruleConditions,
  setRuleActive,
  sortRules,
} from "./routing-model";
import { routingOutcome, traceLines, type TraceContext } from "./routing-trace";
import { availabilityState, capacityState, memberHref, routingHref, teamExceptions, teamHref } from "./team-model";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import { badgeItem, extraFactSubjects } from "./verification";

const NOW = new Date("2026-09-30T06:00:00.000Z");

/* ------------------------------------------------------------ demo role */

describe("demo role preview", () => {
  it("accepts only the three manager roles", () => {
    expect(parseDemoRole("team_lead")).toBe("team_lead");
    expect(parseDemoRole(["agency_owner", "x"])).toBe("agency_owner");
    expect(parseDemoRole(" agency_admin ")).toBe("agency_admin");
    for (const value of [undefined, "", "binor_admin", "compliance", "agency_agent", "TEAM_LEAD"]) {
      expect(parseDemoRole(value), String(value)).toBeUndefined();
    }
  });

  it("falls back to the account's own role", () => {
    expect(actingRole("agency_agent")).toBe("agency_agent");
    expect(actingRole("agency_agent", "team_lead")).toBe("team_lead");
  });

  it("sets or removes the parameter and keeps the rest of the URL", () => {
    expect(withDemoRole("/ru/app/team", "team_lead")).toBe("/ru/app/team?demoRole=team_lead");
    expect(withDemoRole("/ru/app/audit?actor=agent-01#x", "agency_owner")).toBe(
      "/ru/app/audit?actor=agent-01&demoRole=agency_owner#x",
    );
    expect(withDemoRole("/ru/app/team?demoRole=team_lead&a=1")).toBe("/ru/app/team?a=1");
    expect(withDemoRole("/ru/app/team?demoRole=team_lead", "agency_admin")).toBe("/ru/app/team?demoRole=agency_admin");
  });

  it("builds team links with the preview and the routing anchor", () => {
    expect(teamHref("uz")).toBe("/uz/app/team");
    expect(memberHref("ru", "agent-03", "team_lead")).toBe("/ru/app/team/agent-03?demoRole=team_lead");
    expect(routingHref("ru", "agency_owner", "simulator")).toBe("/ru/app/team/routing?demoRole=agency_owner#simulator");
  });
});

/* --------------------------------------------------------------- access */

describe("permission matrix on the team screens (§19)", () => {
  it("shows an agent their own reports only, a team lead the team, an owner the agency", () => {
    expect(metricsCheck("agency_agent", "own").ok).toBe(true);
    expect(metricsCheck("agency_agent", "team").ok).toBe(false);
    expect(metricsCheck("team_lead", "team").ok).toBe(true);
    expect(metricsCheck("team_lead", "agency").ok).toBe(false);
    expect(metricsCheck("agency_owner", "agency").ok).toBe(true);
    // Agency administrator: reports only with a grant (§5.5).
    expect(metricsCheck("agency_admin", "own").ok).toBe(false);
  });

  it("explains a refused report: holders by role and who changes roles", () => {
    const check = metricsCheck("agency_agent", "team");
    if (check.ok) throw new Error("must be refused");
    expect(check.explanation.reason).toBe("out_of_scope");
    expect(check.explanation.holders).toEqual(["team_lead", "agency_owner"]);
    expect(check.explanation.granters).toEqual([]);
    expect(check.explanation.roleManagers).toEqual(["agency_owner", "agency_admin"]);
    const admin = metricsCheck("agency_admin", "team");
    if (admin.ok) throw new Error("must be refused");
    expect(admin.explanation.reason).toBe("permission_required");
    expect(admin.explanation.granters).toEqual(["agency_owner", "agency_admin"]);
    expect(admin.explanation.selfCanGrant).toBe(true);
  });

  it("reads member relations as own / team / agency", () => {
    expect(memberOwnership({ isViewer: true, inViewerTeam: true })).toBe("own");
    expect(memberOwnership({ isViewer: false, inViewerTeam: true })).toBe("team");
    expect(memberOwnership({ isViewer: false, inViewerTeam: false })).toBe("agency");
  });

  it("lets team leads, owners and administrators edit routing rules, not agents", () => {
    expect(routingEditCheck("team_lead").ok).toBe(true);
    expect(routingEditCheck("agency_owner").ok).toBe(true);
    expect(routingEditCheck("agency_admin").ok).toBe(true);
    const agent = routingEditCheck("agency_agent");
    if (agent.ok) throw new Error("must be refused");
    expect(agent.explanation.holders).toEqual(["team_lead", "agency_owner", "agency_admin"]);
    expect(agent.explanation.action).toBe("edit");
  });

  it("assigns team leads by role: team lead and owner directly, administrator by grant", () => {
    expect(assignCheck("team_lead").ok).toBe(true);
    expect(assignCheck("agency_owner").ok).toBe(true);
    const admin = assignCheck("agency_admin");
    expect(admin.ok ? undefined : admin.explanation.reason).toBe("permission_required");
    const agent = assignCheck("agency_agent");
    expect(agent.ok ? undefined : agent.explanation.reason).toBe("out_of_scope");
  });

  it("opens partners to professional roles, not to the agency administrator", () => {
    expect(partnersCheck("agency_agent").ok).toBe(true);
    expect(partnersCheck("team_lead").ok).toBe(true);
    expect(partnersCheck("agency_owner").ok).toBe(true);
    const admin = partnersCheck("agency_admin");
    expect(admin.ok ? undefined : admin.explanation.reason).toBe("no_access");
    expect(cooperationCheck("agency_agent").ok).toBe(true);
    expect(cooperationCheck("agency_admin").ok).toBe(false);
  });

  it("reaches audit levels per role", () => {
    expect(auditReach("agency_agent")).toEqual(["own"]);
    expect(auditReach("team_lead")).toEqual(["own", "team"]);
    expect(auditReach("agency_owner")).toEqual(["own", "team", "agency"]);
    expect(auditReach("agency_admin")).toEqual(["own", "team", "agency"]);
  });

  it("never treats the journal export as granted by role", () => {
    for (const role of ["agency_agent", "team_lead", "agency_owner", "agency_admin"] as const) {
      const check = exportCheck(role);
      expect(check.ok).toBe(false);
      expect(check.explanation.reason).toBe("permission_required");
      expect(check.explanation.granters).toEqual(["agency_owner", "agency_admin"]);
    }
    expect(exportCheck("agency_owner").explanation.selfCanGrant).toBe(true);
    expect(exportCheck("agency_agent").explanation.selfCanGrant).toBe(false);
  });

  it("says the level, the need, the holders and who changes it — in both languages", () => {
    const check = metricsCheck("agency_agent", "team");
    if (check.ok) throw new Error("must be refused");
    const ru = accessText("ru", check.explanation);
    expect(ru.title).toBe("Вне вашего уровня доступа");
    expect(ru.lines).toEqual([
      "Ваша роль — Агент агентства. «Отчёты и показатели»: только свои записи.",
      "Нужно: «Отчёты и показатели» — записи команды.",
      "По роли такой доступ есть у: Руководитель группы и Руководитель агентства.",
      "Роль и права меняют: Руководитель агентства и Администратор агентства.",
    ]);
    const uz = accessText("uz", check.explanation);
    expect(uz.lines[0]).toBe("Rolingiz — Agentlik agenti. «Hisobotlar va ko‘rsatkichlar»: faqat o‘z yozuvlari.");
    expect(levelText("ru", "agency_owner", "verification")).toBe("записи агентства (по одобрению)");
    expect(levelText("ru", "agency_agent", "agency_base")).toBe("записи агентства (изменения — по разрешению)");
    const admin = metricsCheck("agency_admin", "own");
    if (admin.ok) throw new Error("must be refused");
    expect(accessText("ru", admin.explanation).lines.at(-1)).toMatch(/выдача записывается в журнал/);
  });
});

/* --------------------------------------------------------- availability */

describe("availability and capacity", () => {
  const base: AgentAvailability = { agentId: "a", status: "available", dailyLeadCapacity: 5, specializations: [] };

  it("reads absence like the routing does, and flags a stale one", () => {
    expect(availabilityState(base, NOW)).toEqual({ kind: "available" });
    expect(availabilityState({ ...base, status: "busy" }, NOW)).toEqual({ kind: "busy" });
    expect(availabilityState({ ...base, status: "away" }, NOW)).toEqual({ kind: "away" });
    expect(availabilityState({ ...base, status: "away", awayUntil: "not a date" }, NOW)).toEqual({ kind: "away" });
    expect(availabilityState({ ...base, status: "away", awayUntil: "2026-10-01T04:00:00.000Z" }, NOW)).toEqual({
      kind: "away",
      until: "2026-10-01T04:00:00.000Z",
    });
    expect(availabilityState({ ...base, status: "away", awayUntil: "2026-09-29T04:00:00.000Z" }, NOW)).toEqual({
      kind: "away_ended",
      until: "2026-09-29T04:00:00.000Z",
    });
  });

  it("counts capacity left and marks the limit", () => {
    const member = (used: number, capacity: number) => ({
      availability: { ...base, dailyLeadCapacity: capacity },
      metrics: { newLeadsToday: used } as TeamMemberView["metrics"],
    });
    expect(capacityState(member(2, 6))).toEqual({ used: 2, capacity: 6, left: 4, level: "ok" });
    expect(capacityState(member(5, 6))).toEqual({ used: 5, capacity: 6, left: 1, level: "near" });
    expect(capacityState(member(6, 6))).toEqual({ used: 6, capacity: 6, left: 0, level: "over" });
    expect(capacityState(member(8, 6))).toMatchObject({ left: 0, level: "over" });
    expect(capacityState(member(0, 1))).toMatchObject({ left: 1, level: "ok" });
  });
});

describe("team exceptions (§33.2)", () => {
  it("lists SLA breaches, the unassigned queue and absences for a team lead", async () => {
    const team = await getMyTeam();
    const routing = await getRoutingContext();
    const items = teamExceptions({
      members: team?.members ?? [],
      unassigned: routing.unassignedLeads,
      now: NOW,
      canSeeMetrics: () => true,
    });
    expect(items.map((item) => item.kind)).toEqual(["sla_breach", "sla_breach", "unassigned", "away", "near_capacity"]);
    expect(items[0]).toMatchObject({ kind: "sla_breach", agentId: "agent-01", count: 1, away: false });
    expect(items[1]).toMatchObject({ kind: "sla_breach", agentId: "agent-03", away: true });
    expect(items[2]).toMatchObject({ kind: "unassigned", count: 3, breached: 2 });
    // The next deadline is one still ahead, never a missed one.
    const next = items[2].kind === "unassigned" ? items[2].nextDueAt : undefined;
    expect(next && Date.parse(next) > NOW.getTime()).toBe(true);
    expect(items[3]).toMatchObject({ kind: "away", agentId: "agent-03", openLeads: 2 });
  });

  it("keeps colleagues' metric exceptions out of an agent's panel", async () => {
    const team = await getMyTeam();
    const routing = await getRoutingContext();
    const items = teamExceptions({
      members: team?.members ?? [],
      unassigned: routing.unassignedLeads,
      now: NOW,
      canSeeMetrics: (member) => member.isViewer,
    });
    expect(items.filter((item) => "agentId" in item && item.kind !== "away").every((item) => "agentId" in item && item.agentId === "agent-01")).toBe(true);
    const away = items.find((item) => item.kind === "away");
    expect(away && "openLeads" in away ? away.openLeads : undefined).toBeUndefined();
  });

  it("is empty when nothing needs a decision", () => {
    const quiet = {
      agent: { id: "x" },
      availability: { agentId: "x", status: "available", dailyLeadCapacity: 5, specializations: [] },
      metrics: { newLeadsToday: 1, slaBreaches: 0, openLeads: 1 },
    } as unknown as TeamMemberView;
    const closed = { sla: { state: "closed", dueAt: NOW.toISOString(), minutesLeft: 0 } } as LeadView;
    expect(teamExceptions({ members: [quiet], unassigned: [closed], now: NOW, canSeeMetrics: () => true })).toEqual([]);
  });
});

/* -------------------------------------------------------------- routing */

const rules: RoutingRule[] = [
  { id: "r-b", organizationId: "o", name: "B", priority: 20, active: true, when: { languages: ["uz"] }, strategy: "least_loaded", agentIds: ["a1"] },
  { id: "r-a", organizationId: "o", name: "A", priority: 10, active: true, when: { sources: ["telegram"], districts: ["yunusabad"] }, strategy: "round_robin", agentIds: ["a1", "a2"] },
  { id: "r-z", organizationId: "o", name: "Z", priority: 999, active: true, when: {}, strategy: "manual", agentIds: [] },
];

describe("routing rules (demo editing)", () => {
  it("names constrained dimensions only", () => {
    expect(ruleConditions(rules[1])).toEqual([
      { dimension: "source", values: ["telegram"] },
      { dimension: "district", values: ["yunusabad"] },
    ]);
    expect(ruleConditions(rules[2])).toEqual([]);
  });

  it("moves a rule and restores the original numbers when moved back", () => {
    expect(sortRules(rules).map((rule) => rule.id)).toEqual(["r-a", "r-b", "r-z"]);
    const down = moveRule(rules, "r-a", 1);
    expect(down.map((rule) => [rule.id, rule.priority])).toEqual([
      ["r-b", 10],
      ["r-a", 20],
      ["r-z", 999],
    ]);
    expect(changedRuleIds(rules, down)).toEqual(["r-b", "r-a"]);
    const back = moveRule(down, "r-a", -1);
    expect(changedRuleIds(rules, back)).toEqual([]);
    expect(moveRule(rules, "r-a", -1).map((rule) => rule.id)).toEqual(["r-a", "r-b", "r-z"]);
    expect(moveRule(rules, "missing", 1)).toEqual(sortRules(rules));
  });

  it("renumbers when priorities are shared", () => {
    const tied = rules.map((rule) => ({ ...rule, priority: 10 }));
    expect(moveRule(tied, "r-z", -1).map((rule) => [rule.id, rule.priority])).toEqual([
      ["r-a", 10],
      ["r-z", 20],
      ["r-b", 30],
    ]);
  });

  it("switches a rule on and off without mutating the input", () => {
    const off = setRuleActive(rules, "r-b", false);
    expect(off.find((rule) => rule.id === "r-b")?.active).toBe(false);
    expect(rules[0].active).toBe(true);
    expect(changedRuleIds(rules, off)).toEqual(["r-b"]);
  });

  it("keeps an unstated dimension unknown in a composed lead", () => {
    expect(composedRoutingInput(EMPTY_COMPOSED_INPUT)).toEqual({ source: "telegram", language: "ru" });
    expect(
      composedRoutingInput({ source: "website", language: "uz", district: "chilanzar", dealType: "rent", propertyType: "room" }),
    ).toEqual({ source: "website", language: "uz", district: "chilanzar", dealType: "rent", propertyType: "room" });
    expect(
      composedRoutingInput({ ...EMPTY_COMPOSED_INPUT, source: "bogus" as never, district: "nowhere" as never }),
    ).toEqual({ source: "unknown", language: "ru" });
  });
});

describe("manual assignment (§36.5)", () => {
  it("needs a reason when overriding the rules, for a manual rule and for any change of owner", () => {
    expect(reasonRequired({ agentId: "a1", suggestedAgentId: "a1" })).toBe(false);
    expect(reasonRequired({ agentId: "a2", suggestedAgentId: "a1" })).toBe(true);
    expect(reasonRequired({ agentId: "a1" })).toBe(true);
    expect(reasonRequired({ agentId: "a1", suggestedAgentId: "a1", currentAgentId: "a2" })).toBe(true);
  });

  it("validates the agent and the reason", () => {
    expect(assignmentErrors({ agentId: "", reason: "" })).toEqual(["agent_required", "reason_required"]);
    expect(assignmentErrors({ agentId: "a2", reason: "  ок ", suggestedAgentId: "a1" })).toEqual(["reason_short"]);
    expect(assignmentErrors({ agentId: "a1", reason: "", suggestedAgentId: "a1" })).toEqual([]);
    expect(assignmentErrors({ agentId: "a1", reason: "Повторное обращение", currentAgentId: "a1" })).toEqual(["same_agent"]);
  });

  it("records the rule, or the stated reason, as the journal entry", () => {
    expect(assignmentRecord({ agentId: "a1", reason: "", suggestedAgentId: "a1" }, "r-a")).toEqual({
      action: "lead_assigned",
      agentId: "a1",
      basis: "rule",
      ruleId: "r-a",
    });
    expect(assignmentRecord({ agentId: "a2", reason: " Клиент Азиза ", suggestedAgentId: "a1" })).toEqual({
      action: "lead_assigned",
      agentId: "a2",
      basis: "manual",
      reason: "Клиент Азиза",
    });
    expect(assignmentRecord({ agentId: "a2", reason: "Отпуск агента", currentAgentId: "a1" })).toMatchObject({
      action: "responsible_changed",
      basis: "manual",
    });
    expect(assignmentRecord({ agentId: "a2", reason: "", suggestedAgentId: "a1" })).toBeUndefined();
  });
});

describe("routing trace in human language", () => {
  const names: Record<string, string> = { "agent-01": "Азиз Каримов", "agent-02": "Нигора Юсупова", "agent-03": "Тимур Ахмедов" };

  async function simulate(leadIndex: number, locale: "ru" | "uz", showWorkload = true) {
    const routing = await getRoutingContext();
    const lead = routing.unassignedLeads[leadIndex].lead;
    const result = routeLead(routingInputFromLead(lead), { ...routing, now: NOW });
    const context: TraceContext = {
      locale,
      rules: routing.rules,
      agentName: (id) => names[id],
      showWorkload: () => showWorkload,
    };
    return { result, lines: traceLines(result, context), outcome: routingOutcome(result, context) };
  }

  it("explains the unknown-source lead step by step (lead-04)", async () => {
    const { lines, outcome } = await simulate(0, "ru");
    expect(lines.map((line) => line.text)).toEqual([
      "Выключенные правила не проверяются: «Instagram → Тимур (пилот, выключено)».",
      "«Telegram: Юнусабад и Мирзо-Улугбек» не подходит: источник неизвестен, а правило требует: Telegram; район неизвестен, а правило требует: Юнусабад или Мирзо-Улугбек.",
      "«Лиды на узбекском» не подходит: язык — Русский, а правило требует: Узбекский.",
      "«Коммерческая недвижимость» не подходит: тип недвижимости неизвестен, а правило требует: Коммерция.",
      "«Заявки с сайта — вручную руководителем» не подходит: источник неизвестен, а правило требует: Сайт.",
      "«Все остальные лиды» подходит любому лиду — условий нет. Способ выбора: по очереди (round-robin).",
      "Пропуск: Тимур Ахмедов — отсутствует до 1 окт., 09:00.",
      "Назначение: Азиз Каримов — следующий по очереди (round-robin), сегодня 5 из 6.",
    ]);
    expect(outcome).toMatchObject({ kind: "assigned", agentId: "agent-01", ruleId: "rule-99" });
    expect(outcome.text).toBe("Результат: Азиз Каримов — по правилу «Все остальные лиды».");
  });

  it("stops at a manual rule (lead-06, website)", async () => {
    const { lines, outcome } = await simulate(1, "ru");
    expect(lines.at(-2)?.text).toBe("«Заявки с сайта — вручную руководителем» подходит: источник — Сайт. Способ выбора: ручное назначение.");
    expect(lines.at(-1)?.text).toBe(
      "«Заявки с сайта — вручную руководителем» требует ручного назначения: лид остаётся в очереди, ответственного выбирает руководитель.",
    );
    expect(outcome.kind).toBe("manual");
  });

  it("hides workload numbers the actor may not see, but keeps the reason", () => {
    const result: RoutingResult = {
      trace: [
        { kind: "agent_skipped", ruleId: "r", agentId: "agent-02", reason: "over_capacity", workloadToday: 4, capacity: 4 },
        { kind: "agent_skipped", ruleId: "r", agentId: "agent-09", reason: "availability_unknown" },
        { kind: "agent_skipped", ruleId: "r", agentId: "agent-03", reason: "away" },
        { kind: "rule_no_eligible_agent", ruleId: "r" },
        { kind: "no_eligible_agent" },
      ],
    };
    const context = (showWorkload: boolean): TraceContext => ({
      locale: "ru",
      rules: [],
      agentName: (id) => names[id],
      showWorkload: () => showWorkload,
    });
    expect(traceLines(result, context(true)).map((line) => line.text)).toEqual([
      "Пропуск: Нигора Юсупова — дневной лимит новых лидов исчерпан (4 из 4).",
      "Пропуск: Сотрудник agent-09 — нет данных о доступности и лимите, не угадываем.",
      "Пропуск: Тимур Ахмедов — отсутствует, дата возвращения неизвестна.",
      "В правиле «Правило r» взять лид некому — проверяем следующее правило.",
      "Правила подошли, но взять лид некому — нужно ручное назначение.",
    ]);
    expect(traceLines(result, context(false))[0].text).toBe("Пропуск: Нигора Юсупова — дневной лимит новых лидов исчерпан.");
    expect(routingOutcome(result, context(false)).kind).toBe("nobody");
  });

  it("continues the recorded round-robin rotation", async () => {
    const routing = await getRoutingContext();
    // Last automatic picks in the journal: rule-01 → agent-03 (index 1), rule-99 → agent-01 (index 0).
    expect(routing.roundRobinCursor).toEqual({ "rule-01": 1, "rule-99": 0 });
    const lead = routing.unassignedLeads[0].lead;
    const result = routeLead(routingInputFromLead(lead), { ...routing, now: NOW });
    // rule-99 starts after agent-01: agent-02 is busy and agent-03 away, so agent-01 is next again.
    expect(result).toMatchObject({ agentId: "agent-01", ruleId: "rule-99", roundRobinCursor: 0 });
  });

  it("does not send lead-12 («Звонила в офис…») to the commercial rule", async () => {
    const routing = await getRoutingContext();
    const view = await getLead("lead-12");
    expect(view).toBeDefined();
    if (!view) return;
    const input = routingInputFromLead(view.lead);
    expect(input.propertyType).toBeUndefined();
    const result = routeLead(input, { ...routing, now: NOW });
    expect(result.trace).toContainEqual({
      kind: "rule_not_matched",
      ruleId: "rule-03",
      mismatches: [{ dimension: "propertyType", reason: "unknown_value", expected: ["commercial"] }],
    });
    expect(result.ruleId).toBe("rule-99");
  });

  it("speaks Uzbek with the same facts", async () => {
    const { lines, outcome } = await simulate(2, "uz");
    expect(lines[1].text).toBe(
      "«Telegram: Юнусабад и Мирзо-Улугбек» mos kelmadi: tuman — Chilonzor, qoida esa talab qiladi: Yunusobod yoki Mirzo Ulug‘bek.",
    );
    expect(lines.at(-1)?.text).toBe("Азиз Каримов tayinlanadi: navbatdagi agent (round-robin), bugun 5 / 6.");
    expect(outcome.text).toBe("Natija: Азиз Каримов — «Все остальные лиды» qoidasi bo‘yicha.");
  });

  it("says when no rule applies and when a busy agent was the only choice", () => {
    const context: TraceContext = { locale: "ru", rules, agentName: (id) => names[id], showWorkload: () => false };
    const none: RoutingResult = { trace: [{ kind: "no_rule_matched" }] };
    expect(traceLines(none, context).map((line) => line.text)).toEqual([
      "Ни одно включённое правило не подошло — нужно ручное назначение.",
    ]);
    const busy: RoutingResult = {
      agentId: "agent-02",
      ruleId: "r-b",
      trace: [
        { kind: "rule_matched", ruleId: "r-b", strategy: "least_loaded", matchedOn: ["language"] },
        {
          kind: "agent_chosen",
          ruleId: "r-b",
          agentId: "agent-02",
          strategy: "least_loaded",
          because: "least_loaded",
          status: "busy",
          workloadToday: 1,
          capacity: 4,
        },
      ],
    };
    expect(traceLines(busy, context).map((line) => line.text)).toEqual([
      "«B» подходит: язык — Узбекский. Способ выбора: наименее загруженному.",
      "Назначение: Нигора Юсупова — меньше всего новых лидов сегодня. Свободных не было — выбран занятый сотрудник.",
    ]);
  });
});

/* --------------------------------------------------------- verification */

describe("result-only facts", () => {
  it("keeps 'certified' only with a confirmed certificate", () => {
    const certificate = (status: "confirmed" | "pending" | "unavailable") => ({
      id: "c",
      subject: "agent_certificate" as const,
      status,
      method: "official_source" as const,
    });
    expect(displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [certificate("confirmed")] })).toBe(
      "certified_realtor",
    );
    expect(displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [certificate("unavailable")] })).toBe(
      "unconfirmed",
    );
    expect(displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [] })).toBe("unconfirmed");
    expect(displayedProfessionalStatus({ professionalStatus: "real_estate_agent", verifications: [] })).toBe("real_estate_agent");
    expect(badgeItem(certificate("pending")).source).toBe("");
  });

  it("adds registry and insurance facts only when present", () => {
    expect(extraFactSubjects([{ subject: "insurance" }, { subject: "agent_identity" }, { subject: "org_registry" }])).toEqual([
      "org_registry",
      "insurance",
    ]);
    expect(extraFactSubjects([])).toEqual([]);
  });
});
