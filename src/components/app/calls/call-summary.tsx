"use client";

import { useId, useReducer, useState, type FormEvent } from "react";
import { Ban, BadgeCheck, CheckCheck, ClipboardList, PencilLine, Sparkles, Undo2, X } from "lucide-react";
import { FieldError, FieldHint, FieldLabel, textareaClasses } from "@/components/app/crm/form-controls";
import { textLang } from "@/components/app/inventory/labels";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import type { CallSummary } from "@/lib/domain/types";
import { SummaryBadge } from "./call-badges";
import { initialSummaryState, reduceSummary } from "./call-demo";

/** A draft older than this waits for review and says since when (§36.6 "Stale"). */
const STALE_DRAFT_MS = 24 * 60 * 60 * 1000;

/**
 * AI call summary as an assistant's draft (§14.7: «помощники, а не
 * окончательная юридическая запись»): the agent confirms it, corrects it or
 * rejects it. Every change is local demo state — the card says so and offers
 * to undo. The extracted request opens the requirement editor with the
 * phrase, where the agent checks the parameters before anything is saved.
 */
export function CallSummaryCard({
  locale,
  summary,
  confirmedByName,
  viewerName,
  nowIso,
  requirementHref,
}: {
  locale: Locale;
  summary: CallSummary;
  /** Who confirmed a stored confirmed summary, already localized ("Вы", a colleague, "Неизвестно"). */
  confirmedByName?: string;
  /** How the viewer is named on their own confirmations. */
  viewerName: string;
  nowIso: string;
  /** Requirement editor prefilled with the extracted request. */
  requirementHref?: string;
}) {
  const t = calls[locale].detail.summary;
  const [state, dispatch] = useReducer(reduceSummary, summary, (initial) =>
    initialSummaryState(initial, confirmedByName),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.text);
  const [error, setError] = useState(false);
  const textId = useId();
  const stale = Date.parse(nowIso) - Date.parse(summary.generatedAt) > STALE_DRAFT_MS;

  function startEdit() {
    setDraft(state.text);
    setError(false);
    setEditing(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) {
      setError(true);
      return;
    }
    dispatch({ type: "correct", text: draft, at: nowIso, by: viewerName });
    setEditing(false);
  }

  function undo() {
    dispatch({ type: "undo" });
    setEditing(false);
  }

  return (
    <section aria-labelledby="call-summary-title">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="call-summary-title" className="flex items-center gap-2 text-h2 text-fg">
            <Sparkles aria-hidden className="size-5 shrink-0 text-fg-muted" />
            {calls[locale].detail.sections.summary}
          </h2>
          {state.status === "rejected" ? (
            <Badge tone="neutral" icon={Ban}>
              {calls[locale].summaryState.rejected}
            </Badge>
          ) : (
            <SummaryBadge locale={locale} status={state.status} />
          )}
        </div>

        <div role="status" aria-live="polite">
          {state.notice ? (
            <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
              <p className="flex items-start gap-2 font-semibold">
                <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{t.done[state.notice]}</span>
              </p>
              <p>{t.demo}</p>
              <Button variant="ghost" className="-ml-2 text-info-fg" onClick={undo}>
                <Undo2 aria-hidden className="size-4" />
                {t.undo}
              </Button>
            </div>
          ) : null}
        </div>

        {state.status === "draft" ? (
          <Notice kind="warning" title={t.draftTitle}>
            <p>{t.draftHint}</p>
            <p className="mt-1 font-medium">
              <time dateTime={summary.generatedAt}>
                {format(stale ? t.stale : t.generated, { date: formatDateTime(locale, summary.generatedAt) })}
              </time>
            </p>
          </Notice>
        ) : null}

        {state.status === "rejected" ? (
          <p className="text-small text-fg-muted">{t.rejected}</p>
        ) : editing ? (
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor={textId}>{t.textLabel}</FieldLabel>
              <textarea
                id={textId}
                rows={5}
                value={draft}
                lang={textLang(draft)}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${textId}-hint`}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(false);
                }}
                className={textareaClasses}
              />
              {error ? (
                <FieldError id={`${textId}-hint`}>{t.errorEmpty}</FieldError>
              ) : (
                <FieldHint id={`${textId}-hint`}>{t.textHint}</FieldHint>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                <BadgeCheck aria-hidden className="size-4" />
                {t.save}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                <X aria-hidden className="size-4" />
                {t.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <blockquote
            lang={textLang(state.text)}
            className="rounded-md border-l-4 border-border-strong bg-surface-muted px-3 py-2 text-body text-fg"
          >
            {state.text}
          </blockquote>
        )}

        {state.status === "confirmed" && state.confirmedAt ? (
          <p className="flex items-start gap-1.5 text-caption text-fg-muted">
            <BadgeCheck aria-hidden className="mt-px size-3.5 shrink-0 text-success-fg" />
            <span>
              {format(state.corrected ? t.correctedBy : t.confirmedBy, {
                name: state.confirmedBy ?? calls[locale].party.noName,
                date: formatDateTime(locale, state.confirmedAt),
              })}
            </span>
          </p>
        ) : null}

        {summary.extractedRequest && state.status !== "rejected" ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="flex items-center gap-1.5 text-small font-semibold text-fg">
              <ClipboardList aria-hidden className="size-4 shrink-0 text-fg-muted" />
              {t.extracted}
            </p>
            <p className="text-small text-fg">
              «<span lang={textLang(summary.extractedRequest)}>{summary.extractedRequest}</span>»
            </p>
            <p className="text-caption text-fg-muted">{t.extractedHint}</p>
            {requirementHref ? (
              <ButtonLink href={requirementHref} variant="secondary">
                <ClipboardList aria-hidden className="size-4" />
                {t.createRequirement}
              </ButtonLink>
            ) : null}
          </div>
        ) : null}

        {!editing && state.status !== "rejected" ? (
          <div className="flex flex-wrap gap-2">
            {state.status === "draft" ? (
              <Button onClick={() => dispatch({ type: "confirm", at: nowIso, by: viewerName })}>
                <BadgeCheck aria-hidden className="size-4" />
                {t.confirm}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={startEdit}>
              <PencilLine aria-hidden className="size-4" />
              {t.edit}
            </Button>
            {state.status === "draft" ? (
              <Button variant="ghost" onClick={() => dispatch({ type: "reject" })}>
                <Ban aria-hidden className="size-4" />
                {t.reject}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
