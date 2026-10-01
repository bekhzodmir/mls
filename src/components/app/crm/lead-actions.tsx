"use client";

import { useId, useState, type FormEvent } from "react";
import { CircleCheck, Undo2 } from "lucide-react";
import { assignmentErrors } from "@/components/app/team/routing-model";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate } from "@/i18n/format";
import leads from "@/i18n/messages/leads";
import { FieldError, FieldHint, FieldLabel, SegmentedRadio, inputClasses, textareaClasses } from "./form-controls";

/**
 * Interactive parts of the lead profile. Both forms are demo-only: they
 * validate like the real thing, then change local state and say plainly that
 * nothing reached the server.
 */

export interface AgentOption {
  id: string;
  name: string;
}

/**
 * Manual assignment within the agency (§14.2, §36.5). Choosing or changing
 * the responsible agent by hand needs a reason: it goes to the journal with
 * the assignment (same checks as the routing screen).
 */
export function LeadAssignForm({
  locale,
  agents,
  viewerId,
  currentId,
}: {
  locale: Locale;
  agents: AgentOption[];
  viewerId: string;
  currentId?: string;
}) {
  const t = leads[locale].assign;
  const ids = { agent: useId(), reason: useId(), hint: useId() };
  const [selected, setSelected] = useState(currentId ?? viewerId);
  const [reason, setReason] = useState("");
  const [assigned, setAssigned] = useState(currentId);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<{ name: string; reason: string }>();
  const nameOf = (id: string | undefined) => agents.find((agent) => agent.id === id)?.name;

  // No rule suggestion here: every pick on this screen is manual.
  const draft = { agentId: selected, reason, currentAgentId: assigned };
  const errors = submitted ? assignmentErrors(draft) : [];
  const agentError = errors.find((error) => error === "agent_required" || error === "same_agent");
  const reasonError = errors.find((error) => error === "reason_required" || error === "reason_short");

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (assignmentErrors(draft).length > 0) return;
    setAssigned(selected);
    setDone({ name: nameOf(selected) ?? selected, reason: reason.trim() });
    setReason("");
    setSubmitted(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-small text-fg">{format(t.current, { name: nameOf(assigned) ?? t.nobody })}</p>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.agent}>{t.label}</FieldLabel>
        <select
          id={ids.agent}
          value={selected}
          aria-invalid={agentError ? true : undefined}
          aria-describedby={agentError ? `${ids.agent}-error` : undefined}
          onChange={(event) => {
            setSelected(event.target.value);
            setDone(undefined);
          }}
          className={inputClasses}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.id === viewerId ? format(t.me, { name: agent.name }) : agent.name}
            </option>
          ))}
        </select>
        {agentError ? <FieldError id={`${ids.agent}-error`}>{t.errors[agentError]}</FieldError> : null}
        <FieldHint>{t.hint}</FieldHint>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.reason}>{t.reason}</FieldLabel>
        <textarea
          id={ids.reason}
          rows={2}
          value={reason}
          required
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={[ids.hint, reasonError ? `${ids.reason}-error` : undefined].filter(Boolean).join(" ")}
          onChange={(event) => {
            setReason(event.target.value);
            setDone(undefined);
          }}
          className={textareaClasses}
        />
        <FieldHint id={ids.hint}>{t.reasonHint}</FieldHint>
        {reasonError ? <FieldError id={`${ids.reason}-error`}>{t.errors[reasonError]}</FieldError> : null}
      </div>
      <Button type="submit" variant="secondary">
        {t.submit}
      </Button>
      <div aria-live="polite">
        {done ? (
          <Notice kind="info">
            <p>{format(t.done, { name: done.name })}</p>
            <p className="mt-1">{format(t.journal, { reason: done.reason })}</p>
          </Notice>
        ) : null}
      </div>
    </form>
  );
}

export const closeReasons = [
  "no_answer",
  "not_relevant",
  "found_elsewhere",
  "budget",
  "duplicate",
  "postponed",
  "other",
] as const;
export type CloseReason = (typeof closeReasons)[number];

type Outcome = "lost" | "deferred";

/** Lost / Deferred always needs a reason, and Deferred a return date (§35.3 step 8). */
export function LeadCloseForm({ locale, minReturnDate }: { locale: Locale; minReturnDate: string }) {
  const t = leads[locale].close;
  const ids = { reason: useId(), date: useId(), comment: useId() };
  const [outcome, setOutcome] = useState<Outcome>("lost");
  const [reason, setReason] = useState<CloseReason | "">("");
  const [returnDate, setReturnDate] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<string>();

  const errors = {
    reason: reason === "" ? t.errorReason : undefined,
    date: outcome === "deferred" && (!returnDate || returnDate < minReturnDate) ? t.errorDate : undefined,
    comment: reason === "other" && !comment.trim() ? t.errorOther : undefined,
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.reason || errors.date || errors.comment || reason === "") return;
    const reasonLabel = t.reasons[reason];
    setDone(
      outcome === "lost"
        ? format(t.doneLost, { reason: reasonLabel })
        : format(t.doneDeferred, { reason: reasonLabel, date: formatDate(locale, `${returnDate}T12:00:00+05:00`) }),
    );
  }

  if (done) {
    return (
      <div role="status" className="space-y-2">
        <Notice kind="info" title={outcome === "lost" ? t.lost : t.deferred}>
          <span className="inline-flex items-start gap-1.5">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {done}
          </span>
        </Notice>
        <Button variant="ghost" onClick={() => setDone(undefined)}>
          <Undo2 aria-hidden className="size-4" />
          {t.undo}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <SegmentedRadio<Outcome>
        name="lead-outcome"
        legend={t.outcome}
        value={outcome}
        onChange={setOutcome}
        options={[
          { value: "lost", label: t.lost },
          { value: "deferred", label: t.deferred },
        ]}
      />

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.reason}>{t.reason}</FieldLabel>
        <select
          id={ids.reason}
          value={reason}
          required
          aria-invalid={show("reason") ? true : undefined}
          aria-describedby={show("reason") ? `${ids.reason}-error` : undefined}
          onChange={(event) => setReason(event.target.value as CloseReason | "")}
          className={inputClasses}
        >
          <option value="">{t.reasonPlaceholder}</option>
          {closeReasons.map((code) => (
            <option key={code} value={code}>
              {t.reasons[code]}
            </option>
          ))}
        </select>
        {show("reason") ? <FieldError id={`${ids.reason}-error`}>{show("reason")}</FieldError> : null}
      </div>

      {outcome === "deferred" ? (
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.date}>{t.returnDate}</FieldLabel>
          <input
            id={ids.date}
            type="date"
            min={minReturnDate}
            value={returnDate}
            required
            aria-invalid={show("date") ? true : undefined}
            aria-describedby={show("date") ? `${ids.date}-error` : undefined}
            onChange={(event) => setReturnDate(event.target.value)}
            className={inputClasses}
          />
          {show("date") ? <FieldError id={`${ids.date}-error`}>{show("date")}</FieldError> : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.comment}>{t.comment}</FieldLabel>
        <textarea
          id={ids.comment}
          rows={2}
          value={comment}
          aria-invalid={show("comment") ? true : undefined}
          aria-describedby={`${ids.comment}-hint`}
          onChange={(event) => setComment(event.target.value)}
          className={textareaClasses}
        />
        {show("comment") ? (
          <FieldError id={`${ids.comment}-hint`}>{show("comment")}</FieldError>
        ) : (
          <FieldHint id={`${ids.comment}-hint`}>{t.commentHint}</FieldHint>
        )}
      </div>

      <Button type="submit" variant="secondary">
        {t.submit}
      </Button>
    </form>
  );
}
