"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Hand,
  Info,
  Power,
  PowerOff,
  RotateCcw,
  TriangleAlert,
  Undo2,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { LeadSourceBadge, SlaBadge } from "@/components/app/crm/badges";
import {
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  inputClasses,
  textareaClasses,
} from "@/components/app/crm/form-controls";
import type { SlaDisplay } from "@/components/app/crm/sla";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { compareText } from "@/i18n/format";
import audit from "@/i18n/messages/audit";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import team from "@/i18n/messages/team";
import { districtName } from "@/lib/domain/geo";
import { routeLead, type RoutingInput } from "@/lib/domain/routing";
import {
  dealTypes,
  districtIds,
  leadSources,
  propertyTypes,
  type AgentAvailability,
  type ID,
  type LeadSource,
  type RoutingRule,
} from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { RuleStateBadge } from "./badges";
import {
  EMPTY_COMPOSED_INPUT,
  assignmentErrors,
  assignmentRecord,
  changedRuleIds,
  composedRoutingInput,
  moveRule,
  reasonRequired,
  ruleConditions,
  setRuleActive,
  sortRules,
  type AssignmentRecord,
  type ComposedInput,
} from "./routing-model";
import { dimensionValue, dimensionValues, routingOutcome, traceLines, type TraceContext, type TraceLine } from "./routing-trace";

/**
 * Lead routing workspace (screen 81, §14.2, §36.5): the rules in the order
 * they are tried, demo editing for roles that may change them, and a
 * simulator that runs the real `routeLead` on the client and explains every
 * step. Nothing here is saved: edits and assignments live in page state and
 * say so.
 */

export interface QueueLead {
  id: ID;
  name?: string;
  source: LeadSource;
  sla: SlaDisplay;
  input: RoutingInput;
  href: string;
}

export interface RoutingWorkspaceProps {
  locale: Locale;
  rules: RoutingRule[];
  availability: AgentAvailability[];
  workloadToday: Record<ID, number>;
  /** Per round-robin rule, who took its last lead: the simulator continues the real rotation. */
  roundRobinCursor: Record<ID, number>;
  generatedAt: string;
  agents: { id: ID; name: string; href: string }[];
  /** Agents whose workload numbers the actor may see (§19 Reports). */
  workloadVisible: ID[];
  queue: QueueLead[];
  canEdit: boolean;
  canAssign: boolean;
  /** Server-rendered permission note shown instead of the assign form. */
  assignDenied?: ReactNode;
}

const lineIcon: Record<TraceLine["kind"], LucideIcon> = {
  inactive_rules: PowerOff,
  rule_not_matched: CircleSlash,
  rule_matched: CircleCheck,
  agent_skipped: UserX,
  manual_assignment_required: Hand,
  rule_no_eligible_agent: TriangleAlert,
  agent_chosen: UserCheck,
  no_rule_matched: TriangleAlert,
  no_eligible_agent: TriangleAlert,
};

const toneClass: Record<TraceLine["tone"], string> = {
  neutral: "text-fg-muted",
  info: "text-info-fg",
  warning: "text-warning-fg",
  success: "text-success-fg",
};

export function RoutingWorkspace(props: RoutingWorkspaceProps) {
  const { locale, agents, queue, canEdit } = props;
  const t = team[locale].routing;
  const [rules, setRules] = useState(() => sortRules(props.rules));
  const changed = changedRuleIds(props.rules, rules);
  const now = useMemo(() => new Date(props.generatedAt), [props.generatedAt]);
  const names = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const visible = useMemo(() => new Set(props.workloadVisible), [props.workloadVisible]);

  const [mode, setMode] = useState<"lead" | "custom">(queue.length > 0 ? "lead" : "custom");
  const [leadId, setLeadId] = useState<ID | undefined>(queue[0]?.id);
  const [composed, setComposed] = useState<ComposedInput>(EMPTY_COMPOSED_INPUT);
  const [assignments, setAssignments] = useState<Record<ID, AssignmentRecord>>({});

  const lead = mode === "lead" ? queue.find((item) => item.id === leadId) : undefined;
  const input = lead ? lead.input : composedRoutingInput(composed);
  const result = routeLead(input, {
    rules,
    availability: props.availability,
    workloadToday: props.workloadToday,
    roundRobinCursor: props.roundRobinCursor,
    now,
  });
  const context: TraceContext = {
    locale,
    rules,
    agentName: (id) => names.get(id),
    showWorkload: (id) => visible.has(id),
  };
  const lines = traceLines(result, context);
  const outcome = routingOutcome(result, context);
  const OutcomeIcon = outcome.kind === "assigned" ? UserCheck : Hand;

  return (
    <div className="space-y-6">
      <section aria-labelledby="routing-rules" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="routing-rules" className="text-h2 text-fg">
            {t.rulesTitle}
          </h2>
          {changed.length > 0 ? (
            <Button variant="ghost" onClick={() => setRules(sortRules(props.rules))}>
              <RotateCcw aria-hidden className="size-4" />
              {t.edit.reset}
            </Button>
          ) : null}
        </div>
        {canEdit ? <Notice kind="info">{t.edit.demo}</Notice> : null}
        <ol className="space-y-3">
          {rules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              locale={locale}
              rule={rule}
              position={index + 1}
              first={index === 0}
              last={index === rules.length - 1}
              changed={changed.includes(rule.id)}
              canEdit={canEdit}
              agents={agents}
              onMove={(direction) => setRules((current) => moveRule(current, rule.id, direction))}
              onToggle={() => setRules((current) => setRuleActive(current, rule.id, !rule.active))}
            />
          ))}
        </ol>
      </section>

      <section id="simulator" aria-labelledby="routing-simulator" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 id="routing-simulator" className="text-h2 text-fg">
            {t.simulator.title}
          </h2>
          <p className="text-small text-fg-muted">{t.simulator.text}</p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card">
          <SegmentedRadio<"lead" | "custom">
            name="routing-mode"
            legend={t.simulator.mode}
            value={mode}
            onChange={setMode}
            options={[
              { value: "lead", label: t.simulator.modeLead },
              { value: "custom", label: t.simulator.modeCustom },
            ]}
          />

          {mode === "lead" ? (
            queue.length === 0 ? (
              <p className="text-small text-fg-muted">{t.simulator.queueEmpty}</p>
            ) : (
              <fieldset className="space-y-2">
                <legend className="text-small font-semibold text-fg">{t.simulator.queue}</legend>
                <ul className="space-y-2">
                  {queue.map((item) => {
                    const checked = item.id === leadId;
                    const assigned = assignments[item.id];
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center",
                          checked ? "border-primary bg-primary-soft/40" : "border-border",
                        )}
                      >
                        <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="radio"
                            name="routing-lead"
                            value={item.id}
                            checked={checked}
                            onChange={() => setLeadId(item.id)}
                            className="mt-1 size-5 shrink-0 accent-primary"
                          />
                          <span className="min-w-0 space-y-1">
                            <span className="block text-small font-semibold text-fg">
                              {item.name ?? t.simulator.noName}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              <LeadSourceBadge locale={locale} source={item.source} />
                              <SlaBadge display={item.sla} label={leads[locale].sla.label} />
                              {assigned ? (
                                <Badge tone="brand" icon={UserCheck}>
                                  {names.get(assigned.agentId) ?? assigned.agentId}
                                </Badge>
                              ) : null}
                            </span>
                          </span>
                        </label>
                        <Link
                          href={item.href}
                          className="inline-flex min-h-11 items-center self-start text-small font-medium text-primary underline-offset-4 hover:underline sm:self-auto"
                        >
                          {t.simulator.openLead}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )
          ) : (
            <ComposeForm locale={locale} value={composed} onChange={setComposed} />
          )}

          <InputSummary locale={locale} input={input} />
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 rounded-md border p-3 text-small font-semibold",
              outcome.kind === "assigned"
                ? "border-success-border bg-success-bg text-success-fg"
                : "border-warning-border bg-warning-bg text-warning-fg",
            )}
          >
            <OutcomeIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {outcome.text}
          </p>
          <h3 className="text-body font-semibold text-fg">{t.simulator.trace}</h3>
          <ol className="space-y-2">
            {lines.map((line, index) => {
              const Icon = lineIcon[line.kind];
              return (
                <li key={`${line.kind}-${index}`} className="flex items-start gap-2 text-small text-fg">
                  <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", toneClass[line.tone])} />
                  <span>{line.text}</span>
                </li>
              );
            })}
          </ol>
          {changed.length > 0 ? (
            <p className="flex items-center gap-1.5 text-caption text-fg-muted">
              <Info aria-hidden className="size-3.5" />
              {t.simulator.usesEdits}
            </p>
          ) : null}
        </div>

        {lead ? (
          props.canAssign ? (
            <AssignForm
              key={`${lead.id}:${outcome.kind === "assigned" ? outcome.agentId : ""}:${assignments[lead.id]?.agentId ?? ""}`}
              locale={locale}
              lead={lead}
              agents={agents}
              suggestedAgentId={outcome.kind === "assigned" ? outcome.agentId : undefined}
              ruleId={outcome.kind === "assigned" ? outcome.ruleId : undefined}
              ruleNameOf={(id) => rules.find((rule) => rule.id === id)?.name}
              current={assignments[lead.id]}
              onAssign={(record) => setAssignments((all) => ({ ...all, [lead.id]: record }))}
              onUndo={() =>
                setAssignments((all) => {
                  const next = { ...all };
                  delete next[lead.id];
                  return next;
                })
              }
            />
          ) : (
            props.assignDenied
          )
        ) : null}
      </section>
    </div>
  );
}

function RuleCard({
  locale,
  rule,
  position,
  first,
  last,
  changed,
  canEdit,
  agents,
  onMove,
  onToggle,
}: {
  locale: Locale;
  rule: RoutingRule;
  position: number;
  first: boolean;
  last: boolean;
  changed: boolean;
  canEdit: boolean;
  agents: RoutingWorkspaceProps["agents"];
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
}) {
  const t = team[locale].routing;
  const conditions = ruleConditions(rule);
  const titleId = `rule-${rule.id}-title`;
  return (
    <li
      id={`rule-${rule.id}`}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-20 space-y-3 rounded-lg border bg-surface p-4 shadow-card",
        rule.active ? "border-border" : "border-dashed border-border-strong bg-surface-muted/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-muted px-2 text-caption font-semibold text-fg">
          {format(t.position, { n: position })}
        </span>
        <h3 id={titleId} className="min-w-0 flex-1 text-body font-semibold text-fg">
          {rule.name}
        </h3>
        <RuleStateBadge locale={locale} active={rule.active} />
        {changed ? (
          <Badge tone="warning" icon={CircleAlert}>
            {t.edit.changed}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-caption font-medium text-fg-muted">{t.conditions}</p>
        {conditions.length === 0 ? (
          <p className="text-small text-fg">{t.any}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {conditions.map((condition) => (
              <li key={condition.dimension}>
                <Chip>
                  {t.dimensions[condition.dimension]}: {dimensionValues(locale, condition.dimension, condition.values)}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-small sm:grid-cols-2">
        <div>
          <dt className="text-caption font-medium text-fg-muted">{t.strategy}</dt>
          <dd className="text-fg">{t.strategies[rule.strategy]}</dd>
          <dd className="text-caption text-fg-muted">{t.strategyHints[rule.strategy]}</dd>
        </div>
        <div>
          <dt className="text-caption font-medium text-fg-muted">{t.agents}</dt>
          <dd className="text-fg">
            {rule.agentIds.length === 0 ? (
              t.agentsNone
            ) : (
              <ul className="flex flex-wrap gap-x-3">
                {rule.agentIds.map((id) => {
                  const agent = agents.find((item) => item.id === id);
                  return (
                    <li key={id}>
                      {agent ? (
                        <Link
                          href={agent.href}
                          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                        >
                          {agent.name}
                        </Link>
                      ) : (
                        format(team[locale].routing.trace.unknownAgent, { id })
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      {canEdit ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            disabled={first}
            onClick={() => onMove(-1)}
            aria-label={format(t.edit.upLabel, { rule: rule.name })}
          >
            <ArrowUp aria-hidden className="size-4" />
            {t.edit.up}
          </Button>
          <Button
            variant="secondary"
            disabled={last}
            onClick={() => onMove(1)}
            aria-label={format(t.edit.downLabel, { rule: rule.name })}
          >
            <ArrowDown aria-hidden className="size-4" />
            {t.edit.down}
          </Button>
          <Button
            variant="ghost"
            onClick={onToggle}
            aria-label={format(rule.active ? t.edit.turnOffLabel : t.edit.turnOnLabel, { rule: rule.name })}
          >
            {rule.active ? <PowerOff aria-hidden className="size-4" /> : <Power aria-hidden className="size-4" />}
            {rule.active ? t.edit.turnOff : t.edit.turnOn}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ComposeForm({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: ComposedInput;
  onChange: (value: ComposedInput) => void;
}) {
  const t = team[locale].routing.simulator;
  const d = domain[locale];
  const ids = { source: useId(), language: useId(), district: useId(), dealType: useId(), propertyType: useId() };
  const set = <K extends keyof ComposedInput>(key: K, next: ComposedInput[K]) => onChange({ ...value, [key]: next });
  const districts = [...districtIds].sort((a, b) => compareText(locale, districtName(a, locale), districtName(b, locale)));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.source}>{t.source}</FieldLabel>
        <select
          id={ids.source}
          value={value.source}
          onChange={(event) => set("source", event.target.value as ComposedInput["source"])}
          className={inputClasses}
        >
          {leadSources.map((code) => (
            <option key={code} value={code}>
              {d.leadSource[code]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.language}>{t.language}</FieldLabel>
        <select
          id={ids.language}
          value={value.language}
          onChange={(event) => set("language", event.target.value === "uz" ? "uz" : "ru")}
          className={inputClasses}
        >
          <option value="ru">{leads[locale].language.ru}</option>
          <option value="uz">{leads[locale].language.uz}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.district}>{t.district}</FieldLabel>
        <select
          id={ids.district}
          value={value.district}
          onChange={(event) => set("district", event.target.value as ComposedInput["district"])}
          className={inputClasses}
        >
          <option value="">{t.notStated}</option>
          {districts.map((code) => (
            <option key={code} value={code}>
              {districtName(code, locale)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.dealType}>{t.dealType}</FieldLabel>
        <select
          id={ids.dealType}
          value={value.dealType}
          onChange={(event) => set("dealType", event.target.value as ComposedInput["dealType"])}
          className={inputClasses}
        >
          <option value="">{t.notStated}</option>
          {dealTypes.map((code) => (
            <option key={code} value={code}>
              {d.dealType[code]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <FieldLabel htmlFor={ids.propertyType}>{t.propertyType}</FieldLabel>
        <select
          id={ids.propertyType}
          value={value.propertyType}
          onChange={(event) => set("propertyType", event.target.value as ComposedInput["propertyType"])}
          className={inputClasses}
        >
          <option value="">{t.notStated}</option>
          {propertyTypes.map((code) => (
            <option key={code} value={code}>
              {d.propertyType[code]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** What the routing knows about the lead; unknown dimensions are named as unknown, never guessed. */
function InputSummary({ locale, input }: { locale: Locale; input: RoutingInput }) {
  const t = team[locale].routing;
  const rows: { key: keyof RoutingInput; label: string; value?: string }[] = [
    { key: "source", label: t.simulator.source, value: dimensionValue(locale, "source", input.source) },
    { key: "language", label: t.simulator.language, value: dimensionValue(locale, "language", input.language) },
    { key: "district", label: t.simulator.district, value: input.district && dimensionValue(locale, "district", input.district) },
    { key: "dealType", label: t.simulator.dealType, value: input.dealType && dimensionValue(locale, "dealType", input.dealType) },
    {
      key: "propertyType",
      label: t.simulator.propertyType,
      value: input.propertyType && dimensionValue(locale, "propertyType", input.propertyType),
    },
  ];
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-small font-semibold text-fg">{t.simulator.detected}</p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-small sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="flex gap-1.5">
            <dt className="text-fg-muted">{row.label}:</dt>
            <dd className={row.value && !(row.key === "source" && input.source === "unknown") ? "text-fg" : "text-fg-muted italic"}>
              {row.value || t.simulator.unknown}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-fg-muted">{t.simulator.detectedHint}</p>
    </div>
  );
}

function AssignForm({
  locale,
  lead,
  agents,
  suggestedAgentId,
  ruleId,
  ruleNameOf,
  current,
  onAssign,
  onUndo,
}: {
  locale: Locale;
  lead: QueueLead;
  agents: RoutingWorkspaceProps["agents"];
  suggestedAgentId?: ID;
  /** The rule that chose `suggestedAgentId`. */
  ruleId?: ID;
  ruleNameOf: (id: ID) => string | undefined;
  current?: AssignmentRecord;
  onAssign: (record: AssignmentRecord) => void;
  onUndo: () => void;
}) {
  const t = team[locale].routing.assign;
  const ids = { agent: useId(), reason: useId(), hint: useId() };
  const [agentId, setAgentId] = useState<ID | "">(current ? "" : (suggestedAgentId ?? ""));
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const draft = { agentId, reason, suggestedAgentId, currentAgentId: current?.agentId };
  const errors = assignmentErrors(draft);
  const show = submitted ? errors : [];
  const agentError = show.find((error) => error === "agent_required" || error === "same_agent");
  const reasonError = show.find((error) => error === "reason_required" || error === "reason_short");
  const needsReason = reasonRequired(draft);
  const nameOf = (id: ID) => agents.find((agent) => agent.id === id)?.name ?? id;
  const leadName = lead.name ?? team[locale].routing.simulator.noName;
  const titleId = `assign-${lead.id}-title`;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    // The parent remounts the form after an assignment, so its fields start over.
    const record = assignmentRecord(draft, ruleId);
    if (record) onAssign(record);
  }

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h3 id={titleId} className="text-body font-semibold text-fg">
        {t.title}
      </h3>
      <p className="text-small text-fg">{current ? format(t.current, { name: nameOf(current.agentId) }) : t.nobody}</p>

      {current ? (
        <div role="status" className="space-y-2">
          <Notice kind="info" title={t.doneTitle}>
            <p>{format(t.done, { name: nameOf(current.agentId), lead: leadName })}</p>
            <p>
              {current.basis === "rule" && current.ruleId
                ? format(t.journalRule, {
                    action: audit[locale].actions.lead_assigned,
                    rule: ruleNameOf(current.ruleId) ?? current.ruleId,
                  })
                : format(t.journalManual, {
                    action: audit[locale].actions[current.action],
                    reason: current.reason ?? "",
                  })}
            </p>
          </Notice>
          <Button variant="ghost" onClick={onUndo}>
            <Undo2 aria-hidden className="size-4" />
            {t.undo}
          </Button>
        </div>
      ) : null}

      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.agent}>{t.agent}</FieldLabel>
          <select
            id={ids.agent}
            value={agentId}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? `${ids.agent}-error` : undefined}
            onChange={(event) => setAgentId(event.target.value)}
            className={inputClasses}
          >
            <option value="">{t.agentPlaceholder}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.id === suggestedAgentId ? format(t.suggested, { name: agent.name }) : agent.name}
              </option>
            ))}
          </select>
          {agentError ? <FieldError id={`${ids.agent}-error`}>{t.errors[agentError]}</FieldError> : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.reason}>{t.reason}</FieldLabel>
          <textarea
            id={ids.reason}
            value={reason}
            rows={2}
            required={needsReason}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={[ids.hint, reasonError ? `${ids.reason}-error` : undefined].filter(Boolean).join(" ")}
            onChange={(event) => setReason(event.target.value)}
            className={textareaClasses}
          />
          <FieldHint id={ids.hint}>{needsReason ? t.reasonRequired : t.reasonOptional}</FieldHint>
          {reasonError ? <FieldError id={`${ids.reason}-error`}>{t.errors[reasonError]}</FieldError> : null}
        </div>
        <Button type="submit">
          <UserCheck aria-hidden className="size-4" />
          {t.submit}
        </Button>
      </form>
    </section>
  );
}
