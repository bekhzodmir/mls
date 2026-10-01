import { draftToRequirementFields, parseRequirementText } from "./requirement-parser";
import type {
  AgentAvailability,
  AvailabilityStatus,
  DealType,
  DistrictId,
  ID,
  ISODateTime,
  Language,
  Lead,
  LeadSource,
  PropertyType,
  RoutingRule,
  RoutingStrategy,
} from "./types";

/**
 * Lead routing (§14.2, §35.3 step 4, §36.5 "Командное распределение").
 *
 * Configurable rules pick an agent by source, language, district, deal type
 * and property type, then respect absence and capacity. The result always
 * carries a step-by-step trace — which rule was tried, why it did or did not
 * apply, which agents were skipped and why the chosen one won — so the UI can
 * answer "почему этот агент" with reasons, never a bare outcome (§12.4 spirit).
 *
 * - Unknown is not a match: a rule that constrains a dimension the lead does
 *   not state (no district in the message, source "unknown") does not apply.
 * - Manual assignment is never lost (§35.3 step 4): a `manual` rule stops the
 *   automation and says so; the caller keeps the lead in the manual queue.
 * - Pure and deterministic: the same input always gives the same agent and
 *   the same trace; nothing is mutated. Recording the assignment, the rotation
 *   cursor and an audit event is the caller's job.
 */

/* ---------------------------------------------------------------- input */

export interface RoutingInput {
  source: LeadSource;
  language: Language;
  district?: DistrictId;
  dealType?: DealType;
  propertyType?: PropertyType;
}

/**
 * Routing facts of a lead. District, deal type and property type come from
 * the lead's own words via the requirement parser, and only when the parser
 * is confident (≥ MIN_APPLY_CONFIDENCE) and names exactly one value: "в
 * Яккасарае или Мирабаде" stays unknown rather than being routed by a guess.
 */
export function routingInputFromLead(lead: Lead): RoutingInput {
  const input: RoutingInput = { source: lead.source, language: lead.language };
  const fields = draftToRequirementFields(parseRequirementText(lead.message));
  if (fields.districts?.length === 1) input.district = fields.districts[0];
  if (fields.dealType) input.dealType = fields.dealType;
  if (fields.propertyTypes?.length === 1) input.propertyType = fields.propertyTypes[0];
  return input;
}

/* ---------------------------------------------------------------- trace */

export type RoutingDimension = "source" | "language" | "district" | "dealType" | "propertyType";

/** Rule `when` key and input key per dimension, in evaluation order. */
const DIMENSIONS: readonly { dimension: RoutingDimension; key: keyof RoutingRule["when"] }[] = [
  { dimension: "source", key: "sources" },
  { dimension: "language", key: "languages" },
  { dimension: "district", key: "districts" },
  { dimension: "dealType", key: "dealTypes" },
  { dimension: "propertyType", key: "propertyTypes" },
];

export interface DimensionMismatch {
  dimension: RoutingDimension;
  /**
   * `value_mismatch` — the lead's value is not in the rule's list;
   * `unknown_value` — the lead does not state it (or the source is "unknown").
   */
  reason: "value_mismatch" | "unknown_value";
  /** The rule's allowed values. */
  expected: readonly string[];
  /** The lead's value, when known. */
  actual?: string;
}

export type AgentSkipReason =
  /** Status "away" with no return date, or a return date after now. */
  | "away"
  /** Today's new leads already at or above the daily capacity. */
  | "over_capacity"
  /** No availability record: capacity and presence are unknown, so not assumed. */
  | "availability_unknown";

/** Why the chosen agent won, per strategy. */
export type ChoiceReason =
  /** fixed_agent: the first eligible agent in the rule's list (available before busy). */
  | "first_in_list"
  /** round_robin: the next eligible agent after the rotation cursor. */
  | "next_in_rotation"
  /** least_loaded: fewest new leads today; ties go to list order. */
  | "least_loaded";

export type RoutingTraceStep =
  | { kind: "rule_not_matched"; ruleId: ID; mismatches: DimensionMismatch[] }
  | {
      kind: "rule_matched";
      ruleId: ID;
      strategy: RoutingStrategy;
      /** Dimensions the rule constrains, all of which matched; empty = catch-all rule. */
      matchedOn: RoutingDimension[];
    }
  | {
      kind: "agent_skipped";
      ruleId: ID;
      agentId: ID;
      reason: AgentSkipReason;
      awayUntil?: ISODateTime;
      workloadToday?: number;
      capacity?: number;
    }
  | { kind: "manual_assignment_required"; ruleId: ID }
  /** The rule matched but none of its agents can take the lead; the next rule is tried. */
  | { kind: "rule_no_eligible_agent"; ruleId: ID }
  | {
      kind: "agent_chosen";
      ruleId: ID;
      agentId: ID;
      strategy: Exclude<RoutingStrategy, "manual">;
      because: ChoiceReason;
      /**
       * "busy" means no available agent was eligible: busy agents are ranked
       * after available ones.
       */
      status: Exclude<AvailabilityStatus, "away">;
      workloadToday: number;
      capacity: number;
    }
  /** Final: no active rule applies to this lead. */
  | { kind: "no_rule_matched" }
  /** Final: rules applied, but none had an eligible agent. */
  | { kind: "no_eligible_agent" };

type AgentSkippedStep = Extract<RoutingTraceStep, { kind: "agent_skipped" }>;

/* -------------------------------------------------------------- routing */

export interface RoutingContext {
  rules: readonly RoutingRule[];
  availability: readonly AgentAvailability[];
  /** New leads assigned to each agent today. Missing = 0. */
  workloadToday: Readonly<Record<ID, number>>;
  /** Per round-robin rule: index in `agentIds` of the last agent assigned. */
  roundRobinCursor?: Readonly<Record<ID, number>>;
  now: Date;
}

export interface RoutingResult {
  /** Absent when a manual rule applies or nobody can take the lead. */
  agentId?: ID;
  /** The rule that decided: assigned, or demanded manual assignment. */
  ruleId?: ID;
  /** For round_robin: the new cursor to store under `roundRobinCursor[ruleId]`. */
  roundRobinCursor?: number;
  trace: RoutingTraceStep[];
}

/** Priority first (lower = earlier), then id, compared by code unit (locale-independent). */
function byPriority(a: RoutingRule, b: RoutingRule): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function inputValue(input: RoutingInput, dimension: RoutingDimension): string | undefined {
  const value = input[dimension];
  // "unknown" is the explicit code for a source nobody recorded (§35.3 step 1).
  if (dimension === "source" && value === "unknown") return undefined;
  return value;
}

function mismatchesOf(rule: RoutingRule, input: RoutingInput): { mismatches: DimensionMismatch[]; matchedOn: RoutingDimension[] } {
  const mismatches: DimensionMismatch[] = [];
  const matchedOn: RoutingDimension[] = [];
  for (const { dimension, key } of DIMENSIONS) {
    const expected: readonly string[] | undefined = rule.when[key];
    // An omitted or empty list does not constrain the dimension.
    if (!expected || expected.length === 0) continue;
    const raw = input[dimension];
    // A rule may explicitly route "unknown" sources; then it is a plain value.
    if (raw !== undefined && expected.includes(raw)) {
      matchedOn.push(dimension);
      continue;
    }
    const actual = inputValue(input, dimension);
    if (actual === undefined) {
      const mismatch: DimensionMismatch = { dimension, reason: "unknown_value", expected: [...expected] };
      if (raw !== undefined) mismatch.actual = raw;
      mismatches.push(mismatch);
    } else {
      mismatches.push({ dimension, reason: "value_mismatch", expected: [...expected], actual });
    }
  }
  return { mismatches, matchedOn };
}

interface Candidate {
  agentId: ID;
  /** Position in the rule's agent list. */
  index: number;
  status: Exclude<AvailabilityStatus, "away">;
  workload: number;
  capacity: number;
}

function isAway(availability: AgentAvailability, now: Date): boolean {
  if (availability.status !== "away") return false;
  if (!availability.awayUntil) return true;
  const until = Date.parse(availability.awayUntil);
  // An unreadable return date is not a return: stay away.
  return Number.isNaN(until) || until > now.getTime();
}

function eligibleCandidates(
  rule: RoutingRule,
  availabilityById: ReadonlyMap<ID, AgentAvailability>,
  context: RoutingContext,
  trace: RoutingTraceStep[],
): Candidate[] {
  const candidates: Candidate[] = [];
  rule.agentIds.forEach((agentId, index) => {
    const availability = availabilityById.get(agentId);
    if (!availability) {
      trace.push({ kind: "agent_skipped", ruleId: rule.id, agentId, reason: "availability_unknown" });
      return;
    }
    if (isAway(availability, context.now)) {
      const step: AgentSkippedStep = { kind: "agent_skipped", ruleId: rule.id, agentId, reason: "away" };
      if (availability.awayUntil) step.awayUntil = availability.awayUntil;
      trace.push(step);
      return;
    }
    const workload = context.workloadToday[agentId] ?? 0;
    const capacity = availability.dailyLeadCapacity;
    if (workload >= capacity) {
      trace.push({
        kind: "agent_skipped",
        ruleId: rule.id,
        agentId,
        reason: "over_capacity",
        workloadToday: workload,
        capacity,
      });
      return;
    }
    // Back from an absence that has ended: counts as available.
    const status = availability.status === "busy" ? "busy" : "available";
    candidates.push({ agentId, index, status, workload, capacity });
  });
  return candidates;
}

/** Available before busy; otherwise the order given (stable sort). */
function byAvailability(a: Candidate, b: Candidate): number {
  return (a.status === "busy" ? 1 : 0) - (b.status === "busy" ? 1 : 0);
}

/**
 * How each automatic strategy orders the eligible agents; the first one wins.
 * `manual` has no entry: it never assigns.
 */
const STRATEGIES: Record<
  Exclude<RoutingStrategy, "manual">,
  { because: ChoiceReason; order: (candidates: Candidate[], rule: RoutingRule, context: RoutingContext) => Candidate[] }
> = {
  fixed_agent: {
    because: "first_in_list",
    order: (candidates) => [...candidates].sort(byAvailability),
  },
  round_robin: {
    because: "next_in_rotation",
    order: (candidates, rule, context) => {
      const size = rule.agentIds.length;
      const cursor = context.roundRobinCursor?.[rule.id] ?? -1;
      const start = (((cursor + 1) % size) + size) % size;
      // Distance from the slot after the cursor, wrapping around the list.
      const distance = (candidate: Candidate) => (candidate.index - start + size) % size;
      return [...candidates].sort((a, b) => byAvailability(a, b) || distance(a) - distance(b));
    },
  },
  least_loaded: {
    because: "least_loaded",
    order: (candidates) =>
      [...candidates].sort((a, b) => byAvailability(a, b) || a.workload - b.workload || a.index - b.index),
  },
};

/**
 * Picks the agent for a lead. Active rules are tried by priority (ties by
 * id); the first rule that matches and has an eligible agent decides. A
 * matching rule whose agents are all away / over capacity falls through to
 * the next rule; a matching `manual` rule stops routing.
 */
export function routeLead(input: RoutingInput, context: RoutingContext): RoutingResult {
  const trace: RoutingTraceStep[] = [];
  const availabilityById = new Map<ID, AgentAvailability>();
  for (const availability of context.availability) {
    if (!availabilityById.has(availability.agentId)) availabilityById.set(availability.agentId, availability);
  }

  let anyMatched = false;
  const rules = context.rules.filter((rule) => rule.active).sort(byPriority);
  for (const rule of rules) {
    const { mismatches, matchedOn } = mismatchesOf(rule, input);
    if (mismatches.length > 0) {
      trace.push({ kind: "rule_not_matched", ruleId: rule.id, mismatches });
      continue;
    }
    anyMatched = true;
    trace.push({ kind: "rule_matched", ruleId: rule.id, strategy: rule.strategy, matchedOn });

    if (rule.strategy === "manual") {
      trace.push({ kind: "manual_assignment_required", ruleId: rule.id });
      return { ruleId: rule.id, trace };
    }

    const candidates = eligibleCandidates(rule, availabilityById, context, trace);
    const strategy = STRATEGIES[rule.strategy];
    const chosen = strategy.order(candidates, rule, context)[0];
    if (!chosen) {
      trace.push({ kind: "rule_no_eligible_agent", ruleId: rule.id });
      continue;
    }
    trace.push({
      kind: "agent_chosen",
      ruleId: rule.id,
      agentId: chosen.agentId,
      strategy: rule.strategy,
      because: strategy.because,
      status: chosen.status,
      workloadToday: chosen.workload,
      capacity: chosen.capacity,
    });
    const result: RoutingResult = { agentId: chosen.agentId, ruleId: rule.id, trace };
    if (rule.strategy === "round_robin") result.roundRobinCursor = chosen.index;
    return result;
  }

  trace.push(anyMatched ? { kind: "no_eligible_agent" } : { kind: "no_rule_matched" });
  return { trace };
}
