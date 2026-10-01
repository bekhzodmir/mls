import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import team from "@/i18n/messages/team";
import { districtName } from "@/lib/domain/geo";
import type { DimensionMismatch, RoutingDimension, RoutingResult, RoutingTraceStep } from "@/lib/domain/routing";
import { districtIds, type DistrictId, type ID, type RoutingRule } from "@/lib/domain/types";
import { WHEN_KEY } from "./routing-model";

/**
 * The routing trace in human language (§14.2, §36.5): every step says which
 * rule was tried and why it did or did not apply, which agents were skipped
 * and why, and why the chosen one won — never a bare outcome (§12.4 spirit).
 *
 * Workload numbers are reports (§19): they appear only for agents whose
 * reports the actor may see (`showWorkload`); the reason is always named.
 */

export type TraceTone = "neutral" | "success" | "warning" | "info";

export interface TraceLine {
  kind: RoutingTraceStep["kind"] | "inactive_rules";
  tone: TraceTone;
  text: string;
  ruleId?: ID;
  agentId?: ID;
}

export interface TraceContext {
  locale: Locale;
  /** All rules shown on the page, active or not (names and on/off state). */
  rules: readonly RoutingRule[];
  agentName: (agentId: ID) => string | undefined;
  showWorkload: (agentId: ID) => boolean;
}

/** One dimension value as the screen names it: «Сайт», «Мирзо-Улугбек», «Узбекский». */
export function dimensionValue(locale: Locale, dimension: RoutingDimension, code: string): string {
  const d = domain[locale];
  switch (dimension) {
    case "source":
      return code in d.leadSource ? d.leadSource[code as keyof typeof d.leadSource] : code;
    case "language":
      return code === "ru" || code === "uz" ? leads[locale].language[code] : code;
    case "district":
      return (districtIds as readonly string[]).includes(code) ? districtName(code as DistrictId, locale) : code;
    case "dealType":
      return code in d.dealType ? d.dealType[code as keyof typeof d.dealType] : code;
    case "propertyType":
      return code in d.propertyType ? d.propertyType[code as keyof typeof d.propertyType] : code;
  }
}

/** «Юнусабад или Мирзо-Улугбек». */
export function dimensionValues(locale: Locale, dimension: RoutingDimension, codes: readonly string[]): string {
  return formatList(
    locale,
    codes.map((code) => dimensionValue(locale, dimension, code)),
    "disjunction",
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1);
}

function mismatchText(locale: Locale, mismatch: DimensionMismatch): string {
  const t = team[locale].routing;
  const dimension = lowerFirst(t.dimensions[mismatch.dimension]);
  const expected = dimensionValues(locale, mismatch.dimension, mismatch.expected);
  if (mismatch.reason === "unknown_value") return format(t.trace.unknownValue, { dimension, expected });
  return format(t.trace.valueMismatch, {
    dimension,
    actual: dimensionValue(locale, mismatch.dimension, mismatch.actual ?? ""),
    expected,
  });
}

export function ruleName(context: Pick<TraceContext, "locale" | "rules">, ruleId: ID): string {
  return context.rules.find((rule) => rule.id === ruleId)?.name ?? format(team[context.locale].routing.trace.unknownRule, { id: ruleId });
}

function agentLabel(context: TraceContext, agentId: ID): string {
  return context.agentName(agentId) ?? format(team[context.locale].routing.trace.unknownAgent, { id: agentId });
}

function matchedText(locale: Locale, step: Extract<RoutingTraceStep, { kind: "rule_matched" }>, rule?: RoutingRule): string {
  const t = team[locale].routing;
  return formatList(
    locale,
    step.matchedOn.map((dimension) => {
      const values: readonly string[] = rule?.when[WHEN_KEY[dimension]] ?? [];
      return format(t.trace.matchedOn, {
        dimension: lowerFirst(t.dimensions[dimension]),
        value: dimensionValues(locale, dimension, values),
      });
    }),
  );
}

function stepLine(step: RoutingTraceStep, context: TraceContext): TraceLine {
  const { locale } = context;
  const t = team[locale].routing;
  switch (step.kind) {
    case "rule_not_matched":
      return {
        kind: step.kind,
        tone: "neutral",
        ruleId: step.ruleId,
        text: format(t.trace.notMatched, {
          rule: ruleName(context, step.ruleId),
          reasons: step.mismatches.map((mismatch) => mismatchText(locale, mismatch)).join("; "),
        }),
      };
    case "rule_matched": {
      const rule = context.rules.find((item) => item.id === step.ruleId);
      const values = { rule: ruleName(context, step.ruleId), strategy: lowerFirst(t.strategies[step.strategy]) };
      return {
        kind: step.kind,
        tone: "info",
        ruleId: step.ruleId,
        text:
          step.matchedOn.length === 0
            ? format(t.trace.matchedAny, values)
            : format(t.trace.matched, { ...values, matched: matchedText(locale, step, rule) }),
      };
    }
    case "agent_skipped": {
      const agent = agentLabel(context, step.agentId);
      let text: string;
      if (step.reason === "away") {
        text = step.awayUntil
          ? format(t.trace.skippedAway, { agent, date: formatDateTime(locale, step.awayUntil) })
          : format(t.trace.skippedAwayOpen, { agent });
      } else if (step.reason === "over_capacity") {
        text =
          context.showWorkload(step.agentId) && step.workloadToday !== undefined && step.capacity !== undefined
            ? format(t.trace.skippedCapacity, { agent, used: step.workloadToday, capacity: step.capacity })
            : format(t.trace.skippedCapacityHidden, { agent });
      } else {
        text = format(t.trace.skippedUnknown, { agent });
      }
      return { kind: step.kind, tone: "warning", ruleId: step.ruleId, agentId: step.agentId, text };
    }
    case "manual_assignment_required":
      return {
        kind: step.kind,
        tone: "info",
        ruleId: step.ruleId,
        text: format(t.trace.manual, { rule: ruleName(context, step.ruleId) }),
      };
    case "rule_no_eligible_agent":
      return {
        kind: step.kind,
        tone: "warning",
        ruleId: step.ruleId,
        text: format(t.trace.noEligibleInRule, { rule: ruleName(context, step.ruleId) }),
      };
    case "agent_chosen": {
      let because = t.trace.because[step.because];
      if (context.showWorkload(step.agentId)) {
        because += `, ${format(t.trace.load, { used: step.workloadToday, capacity: step.capacity })}`;
      }
      let text = format(t.trace.chosen, { agent: agentLabel(context, step.agentId), because });
      if (step.status === "busy") text += ` ${t.trace.busy}`;
      return { kind: step.kind, tone: "success", ruleId: step.ruleId, agentId: step.agentId, text };
    }
    case "no_rule_matched":
      return { kind: step.kind, tone: "warning", text: t.trace.noRuleMatched };
    case "no_eligible_agent":
      return { kind: step.kind, tone: "warning", text: t.trace.noEligibleAgent };
  }
}

/**
 * The full trace, preceded by a note about switched-off rules: `routeLead`
 * skips them silently, the screen says that they were not tried.
 */
export function traceLines(result: RoutingResult, context: TraceContext): TraceLine[] {
  const lines: TraceLine[] = [];
  const inactive = context.rules.filter((rule) => !rule.active);
  if (inactive.length > 0) {
    lines.push({
      kind: "inactive_rules",
      tone: "neutral",
      text: format(team[context.locale].routing.trace.inactive, {
        rules: formatList(
          context.locale,
          inactive.map((rule) => `«${rule.name}»`),
        ),
      }),
    });
  }
  for (const step of result.trace) lines.push(stepLine(step, context));
  return lines;
}

export type RoutingOutcome =
  | { kind: "assigned"; agentId: ID; ruleId: ID; text: string }
  | { kind: "manual"; ruleId: ID; text: string }
  | { kind: "nobody"; text: string };

/** One sentence: who gets the lead by which rule, or that a person has to decide. */
export function routingOutcome(result: RoutingResult, context: TraceContext): RoutingOutcome {
  const t = team[context.locale].routing.trace;
  if (result.agentId && result.ruleId) {
    return {
      kind: "assigned",
      agentId: result.agentId,
      ruleId: result.ruleId,
      text: format(t.outcomeAssigned, { agent: agentLabel(context, result.agentId), rule: ruleName(context, result.ruleId) }),
    };
  }
  if (result.ruleId) {
    return { kind: "manual", ruleId: result.ruleId, text: format(t.outcomeManual, { rule: ruleName(context, result.ruleId) }) };
  }
  return { kind: "nobody", text: t.outcomeNobody };
}
