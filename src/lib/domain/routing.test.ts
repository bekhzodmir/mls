import { describe, expect, it } from "vitest";
import {
  routeLead,
  routingInputFromLead,
  type RoutingContext,
  type RoutingDimension,
  type RoutingInput,
  type RoutingResult,
  type RoutingTraceStep,
} from "./routing";
import type { AgentAvailability, Lead, RoutingRule } from "./types";

const NOW = new Date("2026-09-30T06:00:00.000Z"); // Wed 11:00 Tashkent

function rule(id: string, overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id,
    organizationId: "org-1",
    name: id,
    priority: 10,
    active: true,
    when: {},
    strategy: "fixed_agent",
    agentIds: ["a1"],
    ...overrides,
  };
}

function available(agentId: string, overrides: Partial<AgentAvailability> = {}): AgentAvailability {
  return { agentId, status: "available", dailyLeadCapacity: 5, specializations: [], ...overrides };
}

const TEAM = ["a1", "a2", "a3", "a4"].map((id) => available(id));

function route(input: RoutingInput, overrides: Partial<RoutingContext> = {}): RoutingResult {
  return routeLead(input, { rules: [], availability: TEAM, workloadToday: {}, now: NOW, ...overrides });
}

const TELEGRAM_RU: RoutingInput = { source: "telegram", language: "ru" };
const FULL: RoutingInput = {
  source: "telegram",
  language: "uz",
  district: "yunusabad",
  dealType: "sale",
  propertyType: "apartment",
};

function kinds(result: RoutingResult): RoutingTraceStep["kind"][] {
  return result.trace.map((step) => step.kind);
}

function skipped(result: RoutingResult) {
  return result.trace.flatMap((step) => (step.kind === "agent_skipped" ? [[step.agentId, step.reason]] : []));
}

describe("rule order", () => {
  it("evaluates active rules by priority, lower first", () => {
    const rules = [
      rule("r-late", { priority: 20, agentIds: ["a2"] }),
      rule("r-early", { priority: 5, agentIds: ["a1"] }),
    ];
    expect(route(TELEGRAM_RU, { rules })).toMatchObject({ agentId: "a1", ruleId: "r-early" });
  });

  it("breaks priority ties by rule id, independent of input order", () => {
    const rules = [rule("r-b", { agentIds: ["a2"] }), rule("r-a", { agentIds: ["a1"] })];
    expect(route(TELEGRAM_RU, { rules })).toMatchObject({ agentId: "a1", ruleId: "r-a" });
    expect(route(TELEGRAM_RU, { rules: [...rules].reverse() })).toMatchObject({ ruleId: "r-a" });
  });

  it("ignores inactive rules entirely", () => {
    const rules = [rule("r-off", { priority: 1, active: false, agentIds: ["a2"] }), rule("r-on", { priority: 2 })];
    const result = route(TELEGRAM_RU, { rules });
    expect(result).toMatchObject({ agentId: "a1", ruleId: "r-on" });
    expect(result.trace.some((step) => "ruleId" in step && step.ruleId === "r-off")).toBe(false);
  });
});

describe("rule matching", () => {
  const cases: [RoutingDimension, hit: RoutingRule["when"], miss: RoutingRule["when"], string, string[]][] = [
    ["source", { sources: ["telegram"] }, { sources: ["phone", "website"] }, "telegram", ["phone", "website"]],
    ["language", { languages: ["uz"] }, { languages: ["ru"] }, "uz", ["ru"]],
    ["district", { districts: ["yunusabad"] }, { districts: ["chilanzar"] }, "yunusabad", ["chilanzar"]],
    ["dealType", { dealTypes: ["sale"] }, { dealTypes: ["rent"] }, "sale", ["rent"]],
    ["propertyType", { propertyTypes: ["apartment"] }, { propertyTypes: ["house", "land"] }, "apartment", ["house", "land"]],
  ];
  it.each(cases)("%s: matches its value and explains a mismatch", (dimension, hit, miss, actual, expected) => {
    expect(route(FULL, { rules: [rule("r", { when: hit })] })).toMatchObject({ agentId: "a1", ruleId: "r" });
    const result = route(FULL, { rules: [rule("r", { when: miss })] });
    expect(result.agentId).toBeUndefined();
    expect(result.trace).toEqual([
      { kind: "rule_not_matched", ruleId: "r", mismatches: [{ dimension, reason: "value_mismatch", expected, actual }] },
      { kind: "no_rule_matched" },
    ]);
  });

  it("needs every constrained dimension and reports every failing one", () => {
    const when: RoutingRule["when"] = { languages: ["ru"], districts: ["yunusabad"], dealTypes: ["rent"] };
    const result = route(FULL, { rules: [rule("r", { when })] });
    expect(result.trace[0]).toEqual({
      kind: "rule_not_matched",
      ruleId: "r",
      mismatches: [
        { dimension: "language", reason: "value_mismatch", expected: ["ru"], actual: "uz" },
        { dimension: "dealType", reason: "value_mismatch", expected: ["rent"], actual: "sale" },
      ],
    });
  });

  it("lists the matched dimensions; an omitted or empty list matches anything", () => {
    const when: RoutingRule["when"] = { sources: ["telegram"], districts: ["yunusabad", "mirabad"], dealTypes: [] };
    const result = route(FULL, { rules: [rule("r", { when })] });
    expect(result.trace[0]).toEqual({
      kind: "rule_matched",
      ruleId: "r",
      strategy: "fixed_agent",
      matchedOn: ["source", "district"],
    });
    expect(route(TELEGRAM_RU, { rules: [rule("catch-all")] }).trace[0]).toMatchObject({ matchedOn: [] });
  });

  it("does not match an unknown value against a constrained dimension", () => {
    const rules = [
      rule("by-district", { priority: 1, when: { districts: ["chilanzar"] }, agentIds: ["a1"] }),
      rule("fallback", { priority: 2, agentIds: ["a2"] }),
    ];
    const result = route(TELEGRAM_RU, { rules });
    expect(result).toMatchObject({ agentId: "a2", ruleId: "fallback" });
    expect(result.trace[0]).toEqual({
      kind: "rule_not_matched",
      ruleId: "by-district",
      mismatches: [{ dimension: "district", reason: "unknown_value", expected: ["chilanzar"] }],
    });
  });

  it('treats source "unknown" as unknown, unless a rule routes it explicitly', () => {
    const input: RoutingInput = { source: "unknown", language: "ru" };
    const byPhone = route(input, { rules: [rule("phone", { when: { sources: ["phone"] } })] });
    expect(byPhone.trace[0]).toEqual({
      kind: "rule_not_matched",
      ruleId: "phone",
      mismatches: [{ dimension: "source", reason: "unknown_value", expected: ["phone"], actual: "unknown" }],
    });
    const explicit = route(input, { rules: [rule("triage", { when: { sources: ["unknown"] } })] });
    expect(explicit).toMatchObject({ agentId: "a1", ruleId: "triage" });
  });
});

describe("agent eligibility", () => {
  it("skips agents who are away, with or without a return date", () => {
    const availability = [
      available("a1", { status: "away" }),
      available("a2", { status: "away", awayUntil: "2026-10-05T04:00:00.000Z" }),
      available("a3"),
    ];
    const result = route(TELEGRAM_RU, { rules: [rule("r", { agentIds: ["a1", "a2", "a3"] })], availability });
    expect(result.agentId).toBe("a3");
    expect(result.trace).toContainEqual({ kind: "agent_skipped", ruleId: "r", agentId: "a1", reason: "away" });
    expect(result.trace).toContainEqual({
      kind: "agent_skipped",
      ruleId: "r",
      agentId: "a2",
      reason: "away",
      awayUntil: "2026-10-05T04:00:00.000Z",
    });
  });

  it("counts an agent whose absence has ended as available", () => {
    const availability = [available("a1", { status: "away", awayUntil: "2026-09-30T05:00:00.000Z" })];
    const result = route(TELEGRAM_RU, { rules: [rule("r")], availability });
    expect(result.agentId).toBe("a1");
    expect(result.trace.at(-1)).toMatchObject({ kind: "agent_chosen", status: "available" });
  });

  it("skips agents at or over their daily capacity; missing workload is 0", () => {
    const availability = [
      available("a1", { dailyLeadCapacity: 3 }),
      available("a2", { dailyLeadCapacity: 0 }),
      available("a3", { dailyLeadCapacity: 1 }),
    ];
    const result = route(TELEGRAM_RU, {
      rules: [rule("r", { agentIds: ["a1", "a2", "a3"] })],
      availability,
      workloadToday: { a1: 3 },
    });
    expect(result.agentId).toBe("a3");
    expect(result.trace).toContainEqual({
      kind: "agent_skipped",
      ruleId: "r",
      agentId: "a1",
      reason: "over_capacity",
      workloadToday: 3,
      capacity: 3,
    });
    expect(skipped(result)).toEqual([
      ["a1", "over_capacity"],
      ["a2", "over_capacity"],
    ]);
  });

  it("never assumes availability for an agent without a record", () => {
    const result = route(TELEGRAM_RU, { rules: [rule("r", { agentIds: ["ghost", "a2"] })] });
    expect(result.agentId).toBe("a2");
    expect(skipped(result)).toEqual([["ghost", "availability_unknown"]]);
  });

  it("allows busy agents but ranks them after available ones", () => {
    const availability = [available("a1", { status: "busy" }), available("a2")];
    const rules = [rule("r", { agentIds: ["a1", "a2"] })];
    expect(route(TELEGRAM_RU, { rules, availability }).agentId).toBe("a2");

    const allBusy = [available("a1", { status: "busy" }), available("a2", { status: "busy" })];
    const result = route(TELEGRAM_RU, { rules, availability: allBusy });
    expect(result.agentId).toBe("a1");
    expect(result.trace.at(-1)).toMatchObject({ kind: "agent_chosen", status: "busy" });
  });

  it("falls through to the next rule when nobody in a matching rule can take the lead", () => {
    const rules = [
      rule("specialists", { priority: 1, agentIds: ["a1"] }),
      rule("everyone", { priority: 2, agentIds: ["a2"] }),
    ];
    const result = route(TELEGRAM_RU, { rules, availability: [available("a1", { status: "away" }), available("a2")] });
    expect(result).toMatchObject({ agentId: "a2", ruleId: "everyone" });
    expect(kinds(result)).toEqual([
      "rule_matched",
      "agent_skipped",
      "rule_no_eligible_agent",
      "rule_matched",
      "agent_chosen",
    ]);
  });
});

describe("strategies", () => {
  it("fixed_agent: the first eligible agent in list order", () => {
    const rules = [rule("r", { strategy: "fixed_agent", agentIds: ["a3", "a1", "a2"] })];
    const result = route(TELEGRAM_RU, { rules, workloadToday: { a3: 4, a1: 0 } });
    expect(result.agentId).toBe("a3");
    expect(result.roundRobinCursor).toBeUndefined();
    expect(result.trace.at(-1)).toEqual({
      kind: "agent_chosen",
      ruleId: "r",
      agentId: "a3",
      strategy: "fixed_agent",
      because: "first_in_list",
      status: "available",
      workloadToday: 4,
      capacity: 5,
    });
  });

  it("round_robin: starts at the first agent without a cursor and returns the new cursor", () => {
    const rules = [rule("rr", { strategy: "round_robin", agentIds: ["a1", "a2", "a3"] })];
    expect(route(TELEGRAM_RU, { rules })).toMatchObject({ agentId: "a1", roundRobinCursor: 0 });
    expect(route(TELEGRAM_RU, { rules, roundRobinCursor: { rr: 0 } })).toMatchObject({
      agentId: "a2",
      roundRobinCursor: 1,
    });
    expect(route(TELEGRAM_RU, { rules, roundRobinCursor: { rr: 2 } })).toMatchObject({
      agentId: "a1",
      roundRobinCursor: 0,
    });
    expect(route(TELEGRAM_RU, { rules }).trace.at(-1)).toMatchObject({ because: "next_in_rotation" });
  });

  it("round_robin: skips ineligible agents and wraps around", () => {
    const rules = [rule("rr", { strategy: "round_robin", agentIds: ["a1", "a2", "a3"] })];
    const availability = [available("a1"), available("a2"), available("a3", { status: "away" })];
    expect(route(TELEGRAM_RU, { rules, availability, roundRobinCursor: { rr: 1 } })).toMatchObject({
      agentId: "a1",
      roundRobinCursor: 0,
    });
    // A cursor left over from a longer list still lands inside it.
    expect(route(TELEGRAM_RU, { rules, roundRobinCursor: { rr: 7 } }).agentId).toBe("a3");
  });

  it("round_robin: an available agent later in the rotation beats a busy one next in line", () => {
    const rules = [rule("rr", { strategy: "round_robin", agentIds: ["a1", "a2", "a3"] })];
    const availability = [available("a1"), available("a2", { status: "busy" }), available("a3")];
    expect(route(TELEGRAM_RU, { rules, availability, roundRobinCursor: { rr: 0 } }).agentId).toBe("a3");
  });

  it("least_loaded: fewest leads today, ties in list order", () => {
    const rules = [rule("ll", { strategy: "least_loaded", agentIds: ["a1", "a2", "a3", "a4"] })];
    const result = route(TELEGRAM_RU, { rules, workloadToday: { a1: 3, a2: 1, a3: 1, a4: 2 } });
    expect(result.agentId).toBe("a2");
    expect(result.trace.at(-1)).toMatchObject({ because: "least_loaded", workloadToday: 1 });
  });

  it("least_loaded: a busy agent with fewer leads still ranks after an available one", () => {
    const rules = [rule("ll", { strategy: "least_loaded", agentIds: ["a1", "a2"] })];
    const availability = [available("a1", { status: "busy" }), available("a2")];
    expect(route(TELEGRAM_RU, { rules, availability, workloadToday: { a1: 0, a2: 4 } }).agentId).toBe("a2");
  });

  it("manual: never assigns, stops routing and says manual assignment is required", () => {
    const rules = [
      rule("vip", { priority: 1, strategy: "manual", when: { sources: ["referral"] }, agentIds: ["a1"] }),
      rule("everyone", { priority: 2, agentIds: ["a2"] }),
    ];
    const result = route({ source: "referral", language: "ru" }, { rules });
    expect(result).toEqual({
      ruleId: "vip",
      trace: [
        { kind: "rule_matched", ruleId: "vip", strategy: "manual", matchedOn: ["source"] },
        { kind: "manual_assignment_required", ruleId: "vip" },
      ],
    });
    // Other sources skip the manual rule and route normally.
    expect(route(TELEGRAM_RU, { rules })).toMatchObject({ agentId: "a2", ruleId: "everyone" });
  });
});

describe("no assignment", () => {
  it("no_rule_matched when no active rule applies, or there are no rules", () => {
    expect(route(TELEGRAM_RU)).toEqual({ trace: [{ kind: "no_rule_matched" }] });
    const result = route(TELEGRAM_RU, { rules: [rule("uz-only", { when: { languages: ["uz"] } })] });
    expect(result.agentId).toBeUndefined();
    expect(result.ruleId).toBeUndefined();
    expect(kinds(result)).toEqual(["rule_not_matched", "no_rule_matched"]);
  });

  it("no_eligible_agent when rules match but nobody can take the lead", () => {
    const rules = [rule("r1", { agentIds: ["a1"] }), rule("r2", { agentIds: [] })];
    const result = route(TELEGRAM_RU, { rules, workloadToday: { a1: 5 } });
    expect(result).toEqual({
      trace: [
        { kind: "rule_matched", ruleId: "r1", strategy: "fixed_agent", matchedOn: [] },
        { kind: "agent_skipped", ruleId: "r1", agentId: "a1", reason: "over_capacity", workloadToday: 5, capacity: 5 },
        { kind: "rule_no_eligible_agent", ruleId: "r1" },
        { kind: "rule_matched", ruleId: "r2", strategy: "fixed_agent", matchedOn: [] },
        { kind: "rule_no_eligible_agent", ruleId: "r2" },
        { kind: "no_eligible_agent" },
      ],
    });
  });
});

describe("explainability and determinism", () => {
  const rules = [
    rule("uz-yunusabad", {
      priority: 1,
      when: { languages: ["uz"], districts: ["yunusabad"] },
      strategy: "least_loaded",
      agentIds: ["a1", "a2", "a3"],
    }),
    rule("ru-all", { priority: 2, when: { languages: ["ru"] }, strategy: "round_robin", agentIds: ["a4"] }),
  ];
  const context: RoutingContext = {
    rules,
    availability: [available("a1", { status: "away" }), available("a2", { status: "busy" }), available("a3")],
    workloadToday: { a2: 0, a3: 2 },
    roundRobinCursor: { "ru-all": 0 },
    now: NOW,
  };

  it("tells step by step why this agent got the lead", () => {
    expect(routeLead(FULL, context)).toEqual({
      agentId: "a3",
      ruleId: "uz-yunusabad",
      trace: [
        { kind: "rule_matched", ruleId: "uz-yunusabad", strategy: "least_loaded", matchedOn: ["language", "district"] },
        { kind: "agent_skipped", ruleId: "uz-yunusabad", agentId: "a1", reason: "away" },
        {
          kind: "agent_chosen",
          ruleId: "uz-yunusabad",
          agentId: "a3",
          strategy: "least_loaded",
          because: "least_loaded",
          status: "available",
          workloadToday: 2,
          capacity: 5,
        },
      ],
    });
  });

  it("returns the same result for the same input and mutates nothing", () => {
    const frozen: RoutingContext = Object.freeze({
      ...context,
      rules: Object.freeze(rules.map((r) => Object.freeze({ ...r, agentIds: Object.freeze([...r.agentIds]) }))),
      availability: Object.freeze(context.availability.map((a) => Object.freeze({ ...a }))),
      workloadToday: Object.freeze({ ...context.workloadToday }),
    }) as RoutingContext;
    const first = routeLead(FULL, frozen);
    expect(routeLead(FULL, frozen)).toEqual(first);
    expect(routeLead({ ...FULL }, { ...frozen })).toEqual(first);
  });
});

describe("routingInputFromLead", () => {
  function lead(message: string, overrides: Partial<Lead> = {}): Lead {
    return {
      id: "lead-1",
      source: "telegram",
      receivedAt: "2026-09-30T05:00:00.000Z",
      message,
      language: "ru",
      status: "new",
      slaDueAt: "2026-09-30T05:15:00.000Z",
      ...overrides,
    };
  }

  it("reads district, deal type and property type from a Russian message", () => {
    expect(routingInputFromLead(lead("Куплю квартиру в Юнусабаде", { source: "website" }))).toEqual({
      source: "website",
      language: "ru",
      district: "yunusabad",
      dealType: "sale",
      propertyType: "apartment",
    });
  });

  it("reads an Uzbek message", () => {
    const message = "Mirzo Ulug‘bekda 2 xonali kvartira ijaraga kerak, 600$ gacha, mebel bilan.";
    expect(routingInputFromLead(lead(message, { language: "uz" }))).toEqual({
      source: "telegram",
      language: "uz",
      district: "mirzo_ulugbek",
      dealType: "rent",
      propertyType: "apartment",
    });
  });

  it("leaves low-confidence fields unknown instead of guessing", () => {
    // "3 комнаты" only hints at an apartment (confidence 0.5); no deal type at all.
    expect(routingInputFromLead(lead("Хочу посмотреть ещё варианты в Мирзо-Улугбеке, 3 комнаты с ремонтом."))).toEqual({
      source: "telegram",
      language: "ru",
      district: "mirzo_ulugbek",
    });
    // A bare "дом" is a weak hint too.
    expect(routingInputFromLead(lead("Нужен дом в Сергели"))).toEqual({
      source: "telegram",
      language: "ru",
      district: "sergeli",
    });
  });

  it("does not pick one of several districts", () => {
    const message = "Интересует аренда 1-комнатной в Яккасарае или Мирабаде, до 6 млн сум, с мебелью.";
    expect(routingInputFromLead(lead(message))).toEqual({ source: "telegram", language: "ru", dealType: "rent" });
  });

  it("keeps only source and language for an empty or unrelated message", () => {
    expect(routingInputFromLead(lead("Номер оставлен без комментария.", { source: "phone" }))).toEqual({
      source: "phone",
      language: "ru",
    });
    expect(routingInputFromLead(lead("", { source: "unknown", language: "uz" }))).toEqual({
      source: "unknown",
      language: "uz",
    });
  });

  it("feeds routing: a weak hint does not satisfy a property-type rule", () => {
    const rules = [
      rule("apartments", { priority: 1, when: { propertyTypes: ["apartment"] }, agentIds: ["a1"] }),
      rule("fallback", { priority: 99, agentIds: ["a2"] }),
    ];
    const confident = routingInputFromLead(lead("Куплю квартиру в Юнусабаде"));
    expect(route(confident, { rules }).agentId).toBe("a1");

    const hinted = routingInputFromLead(lead("Хочу посмотреть ещё варианты в Мирзо-Улугбеке, 3 комнаты с ремонтом."));
    const result = route(hinted, { rules });
    expect(result.agentId).toBe("a2");
    expect(result.trace[0]).toEqual({
      kind: "rule_not_matched",
      ruleId: "apartments",
      mismatches: [{ dimension: "propertyType", reason: "unknown_value", expected: ["apartment"] }],
    });
  });
});
