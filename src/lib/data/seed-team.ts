import type { AgentAvailability, ID, RoutingRule, Team } from "@/lib/domain/types";
import { day } from "./seed-time";

/**
 * Demo teams, availability and lead routing (§14.2, §36.5) — all fictional.
 *
 * - team-01 is the viewer's team at Demo Realty: lead agent-02 (Нигора),
 *   members agent-01 (the viewer) and agent-03. The agency owner agent-10
 *   heads the organization outside any team. team-02 belongs to the
 *   partner agency and is never shown to the viewer.
 * - agent-03 is away until tomorrow morning and agent-02 is busy, so a
 *   routing simulator has to skip or deprioritize them.
 * - Rules are evaluated by ascending `priority`; rule-05 is switched off and
 *   rule-99 is the catch-all. Lead assignments in the org audit log name the
 *   rule that made them.
 */

export const teams: Team[] = [
  {
    id: "team-01",
    organizationId: "org-01",
    name: "Команда Юнусабад",
    branchName: "Юнусабад",
    leadAgentId: "agent-02",
    memberIds: ["agent-01", "agent-02", "agent-03"],
  },
  {
    id: "team-02",
    organizationId: "org-02",
    name: "Namuna — Chilonzor jamoasi",
    leadAgentId: "agent-04",
    memberIds: ["agent-04", "agent-05"],
  },
];

/** Availability and capacity of Demo Realty's agents (partners do not share theirs). */
export const agentAvailability: AgentAvailability[] = [
  {
    agentId: "agent-01",
    status: "available",
    dailyLeadCapacity: 6,
    specializations: ["apartment", "commercial"],
  },
  {
    agentId: "agent-02",
    status: "busy",
    dailyLeadCapacity: 4,
    specializations: ["apartment", "commercial"],
  },
  {
    agentId: "agent-03",
    status: "away",
    awayUntil: day(1, "09:00"),
    dailyLeadCapacity: 5,
    specializations: ["apartment", "room"],
  },
  {
    // The agency owner takes only the occasional large commercial client.
    agentId: "agent-10",
    status: "available",
    dailyLeadCapacity: 1,
    specializations: ["commercial"],
  },
];

export const routingRules: RoutingRule[] = [
  {
    id: "rule-01",
    organizationId: "org-01",
    name: "Telegram: Юнусабад и Мирзо-Улугбек",
    priority: 10,
    active: true,
    when: { sources: ["telegram"], districts: ["yunusabad", "mirzo_ulugbek"] },
    strategy: "round_robin",
    agentIds: ["agent-01", "agent-03"],
  },
  {
    id: "rule-02",
    organizationId: "org-01",
    name: "Лиды на узбекском",
    priority: 20,
    active: true,
    when: { languages: ["uz"] },
    // Only agents who work in Uzbek: Тимур (agent-03) speaks Russian only.
    strategy: "least_loaded",
    agentIds: ["agent-01", "agent-02"],
  },
  {
    id: "rule-03",
    organizationId: "org-01",
    name: "Коммерческая недвижимость",
    priority: 30,
    active: true,
    when: { propertyTypes: ["commercial"] },
    strategy: "fixed_agent",
    agentIds: ["agent-02"],
  },
  {
    id: "rule-04",
    organizationId: "org-01",
    name: "Заявки с сайта — вручную руководителем",
    priority: 40,
    active: true,
    when: { sources: ["website"] },
    strategy: "manual",
    agentIds: [],
  },
  {
    id: "rule-05",
    organizationId: "org-01",
    name: "Instagram → Тимур (пилот, выключено)",
    priority: 50,
    active: false,
    when: { sources: ["instagram"] },
    strategy: "fixed_agent",
    agentIds: ["agent-03"],
  },
  {
    id: "rule-99",
    organizationId: "org-01",
    name: "Все остальные лиды",
    priority: 999,
    active: true,
    when: {},
    strategy: "round_robin",
    agentIds: ["agent-01", "agent-02", "agent-03"],
  },
];

/**
 * Rotation state of the round-robin rules: the index in the rule's
 * `agentIds` of the agent who took its last lead. It follows the latest
 * automatic assignments in the org audit log — rule-01 gave lead-14 to
 * agent-03 (index 1), rule-99 gave lead-03 to agent-01 (index 0) — so the
 * routing simulator continues the same rotation.
 */
export const roundRobinCursors: Record<ID, number> = {
  "rule-01": 1,
  "rule-99": 0,
};
