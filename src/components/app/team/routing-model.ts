import type { RoutingDimension, RoutingInput } from "@/lib/domain/routing";
import {
  dealTypes,
  districtIds,
  leadSources,
  propertyTypes,
  type DealType,
  type DistrictId,
  type ID,
  type Language,
  type LeadSource,
  type PropertyType,
  type RoutingRule,
} from "@/lib/domain/types";

/**
 * Pure helpers for the lead-routing screen (§14.2, §36.5): rule conditions as
 * chips, the demo editing of rule order and on/off state (local only), the
 * simulator's composed input and the checks of a manual assignment.
 */

/* ------------------------------------------------------------ conditions */

/** Rule `when` key per dimension. */
export const WHEN_KEY = {
  source: "sources",
  language: "languages",
  district: "districts",
  dealType: "dealTypes",
  propertyType: "propertyTypes",
} as const satisfies Record<RoutingDimension, keyof RoutingRule["when"]>;

/** Dimensions in the order `routeLead` evaluates them. */
export const RULE_DIMENSIONS: readonly { dimension: RoutingDimension; key: keyof RoutingRule["when"] }[] = (
  ["source", "language", "district", "dealType", "propertyType"] as const
).map((dimension) => ({ dimension, key: WHEN_KEY[dimension] }));

export interface RuleCondition {
  dimension: RoutingDimension;
  /** Codes the rule accepts; any one of them matches. */
  values: string[];
}

/** The dimensions a rule constrains; empty for a catch-all rule. */
export function ruleConditions(rule: Pick<RoutingRule, "when">): RuleCondition[] {
  return RULE_DIMENSIONS.flatMap(({ dimension, key }) => {
    const values: readonly string[] | undefined = rule.when[key];
    return values && values.length > 0 ? [{ dimension, values: [...values] }] : [];
  });
}

/* ---------------------------------------------------------------- order */

/** The order `routeLead` tries rules in: priority, then id by code unit. */
export function sortRules(rules: readonly RoutingRule[]): RoutingRule[] {
  return [...rules].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Moves a rule one place up (-1) or down (+1). The priorities already in use
 * are handed out again in the new order, so moving a rule back restores the
 * original numbers; when two rules share a number they are renumbered 10, 20…
 */
export function moveRule(rules: readonly RoutingRule[], id: ID, direction: -1 | 1): RoutingRule[] {
  const ordered = sortRules(rules);
  const from = ordered.findIndex((rule) => rule.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ordered.length) return ordered;
  const priorities = ordered.map((rule) => rule.priority);
  const distinct = new Set(priorities).size === priorities.length;
  const moved = [...ordered];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved.map((rule, index) => ({ ...rule, priority: distinct ? priorities[index] : (index + 1) * 10 }));
}

export function setRuleActive(rules: readonly RoutingRule[], id: ID, active: boolean): RoutingRule[] {
  return sortRules(rules).map((rule) => (rule.id === id ? { ...rule, active } : rule));
}

/** Rules whose order or on/off state differs from the saved configuration. */
export function changedRuleIds(original: readonly RoutingRule[], current: readonly RoutingRule[]): ID[] {
  const before = new Map(original.map((rule) => [rule.id, rule]));
  return sortRules(current)
    .filter((rule) => {
      const saved = before.get(rule.id);
      return !saved || saved.priority !== rule.priority || saved.active !== rule.active;
    })
    .map((rule) => rule.id);
}

/* ------------------------------------------------------- composed input */

/** Form values of the "compose a lead" mode; "" = not stated (unknown). */
export interface ComposedInput {
  source: LeadSource;
  language: Language;
  district: DistrictId | "";
  dealType: DealType | "";
  propertyType: PropertyType | "";
}

export const EMPTY_COMPOSED_INPUT: ComposedInput = {
  source: "telegram",
  language: "ru",
  district: "",
  dealType: "",
  propertyType: "",
};

function oneOf<T extends string>(values: readonly T[], value: string): T | undefined {
  return (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

/**
 * The routing input of a composed lead. A dimension left empty stays
 * unknown — never guessed — so rules that require it do not apply.
 */
export function composedRoutingInput(form: ComposedInput): RoutingInput {
  const input: RoutingInput = {
    source: oneOf(leadSources, form.source) ?? "unknown",
    language: form.language === "uz" ? "uz" : "ru",
  };
  const district = oneOf(districtIds, form.district);
  const dealType = oneOf(dealTypes, form.dealType);
  const propertyType = oneOf(propertyTypes, form.propertyType);
  if (district) input.district = district;
  if (dealType) input.dealType = dealType;
  if (propertyType) input.propertyType = propertyType;
  return input;
}

/* ------------------------------------------------------------ assignment */

export const MIN_REASON_LENGTH = 5;

export interface AssignmentDraft {
  agentId: ID | "";
  reason: string;
  /** The agent the rules chose; absent when a manual rule applies or nobody fits. */
  suggestedAgentId?: ID;
  /** Who holds the lead now (after an earlier demo assignment). */
  currentAgentId?: ID;
}

export type AssignmentError = "agent_required" | "same_agent" | "reason_required" | "reason_short";

/**
 * A manual assignment or a change of owner needs a reason (§36.5): it is
 * written to the journal with the assignment. Taking the rules' choice for a
 * lead nobody holds yet records the rule as the reason instead.
 */
export function reasonRequired(draft: Pick<AssignmentDraft, "agentId" | "suggestedAgentId" | "currentAgentId">): boolean {
  if (draft.currentAgentId !== undefined) return true;
  return draft.agentId === "" || draft.agentId !== draft.suggestedAgentId;
}

export function assignmentErrors(draft: AssignmentDraft): AssignmentError[] {
  const errors: AssignmentError[] = [];
  if (draft.agentId === "") errors.push("agent_required");
  else if (draft.agentId === draft.currentAgentId) errors.push("same_agent");
  if (reasonRequired(draft)) {
    const reason = draft.reason.trim();
    if (reason === "") errors.push("reason_required");
    else if (reason.length < MIN_REASON_LENGTH) errors.push("reason_short");
  }
  return errors;
}

/** The journal entry an assignment would add (§36.5, §38.6 item 7). */
export interface AssignmentRecord {
  action: "lead_assigned" | "responsible_changed";
  agentId: ID;
  /** `rule` = the routing rule's choice; `manual` = the stated reason. */
  basis: "rule" | "manual";
  reason?: string;
  ruleId?: ID;
}

export function assignmentRecord(draft: AssignmentDraft, ruleId?: ID): AssignmentRecord | undefined {
  if (assignmentErrors(draft).length > 0 || draft.agentId === "") return undefined;
  const action = draft.currentAgentId === undefined ? "lead_assigned" : "responsible_changed";
  if (!reasonRequired(draft)) {
    const record: AssignmentRecord = { action, agentId: draft.agentId, basis: "rule" };
    if (ruleId) record.ruleId = ruleId;
    return record;
  }
  return { action, agentId: draft.agentId, basis: "manual", reason: draft.reason.trim() };
}
