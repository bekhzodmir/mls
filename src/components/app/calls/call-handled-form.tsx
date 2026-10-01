"use client";

import { useId, useState, type FormEvent } from "react";
import { CircleCheck, Undo2 } from "lucide-react";
import {
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  inputClasses,
  textareaClasses,
} from "@/components/app/crm/form-controls";
import { tashkentInstant, tashkentParts } from "@/components/app/viewings/time";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate, formatDateTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import type { DateKey } from "@/lib/domain/working-days";
import {
  hasErrors,
  noNextStepReasons,
  validateHandled,
  type HandledInput,
  type NoNextStepReason,
} from "./call-demo";

type Done = { kind: "next"; text: string; when?: string } | { kind: "none"; reason: string };

/** «2 окт.» for a date alone, «2 окт., 12:00» with a time — both Tashkent. */
function whenText(locale: Locale, date: string, time: string): string | undefined {
  if (!date) return undefined;
  if (time) {
    const iso = tashkentInstant(date, time);
    if (iso) return formatDateTime(locale, iso);
  }
  return formatDate(locale, `${date}T12:00:00+05:00`, { day: "numeric", month: "short" });
}

/**
 * "Отметить обработанным" (§14.7, §14.8): a handled call leads to a next
 * action — or the agent says explicitly why there is none. Demo only: it
 * validates like the real thing, then changes local state and says that
 * nothing reached the server.
 */
export function CallHandledForm({
  locale,
  today,
  current,
}: {
  locale: Locale;
  /** Tashkent date of the demo "now". */
  today: DateKey;
  current?: { text: string; dueAt?: string };
}) {
  const t = calls[locale].detail.handled;
  const ids = { text: useId(), date: useId(), time: useId(), reason: useId(), comment: useId() };
  const due = current?.dueAt ? tashkentParts(current.dueAt) : undefined;
  const [input, setInput] = useState<HandledInput>({
    mode: "next",
    text: current?.text ?? "",
    date: due?.date ?? "",
    time: due?.time ?? "",
    reason: "",
    comment: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<Done>();

  const errors = validateHandled(input, today);
  const show = (key: keyof typeof errors) => submitted && errors[key];
  const set = (patch: Partial<HandledInput>) => setInput((value) => ({ ...value, ...patch }));
  const describe = (id: string, error: boolean, hint: boolean) =>
    error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    if (input.mode === "next") {
      setDone({ kind: "next", text: input.text.trim(), when: whenText(locale, input.date, input.time) });
    } else if (input.reason) {
      const label = t.reasons[input.reason];
      const comment = input.comment.trim();
      setDone({ kind: "none", reason: comment ? `${label} — ${comment}` : label });
    }
  }

  if (done) {
    return (
      <div role="status" className="space-y-2">
        <Notice kind="info">
          <p className="flex items-start gap-1.5 font-semibold">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {done.kind === "next"
                ? done.when
                  ? format(t.doneNextDue, { text: done.text, when: done.when })
                  : format(t.doneNext, { text: done.text })
                : format(t.doneNone, { reason: done.reason })}
            </span>
          </p>
          <p className="mt-1">{t.demo}</p>
        </Notice>
        <Button
          variant="ghost"
          onClick={() => {
            setDone(undefined);
            setSubmitted(false);
          }}
        >
          <Undo2 aria-hidden className="size-4" />
          {t.undo}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-small text-fg-muted">{t.text}</p>
      <SegmentedRadio<HandledInput["mode"]>
        name="call-handled-mode"
        legend={t.mode}
        value={input.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "next", label: t.withNext },
          { value: "none", label: t.noNext },
        ]}
      />

      {input.mode === "next" ? (
        <>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={ids.text}>{t.nextLabel}</FieldLabel>
            <textarea
              id={ids.text}
              rows={2}
              value={input.text}
              required
              placeholder={t.nextPlaceholder}
              aria-invalid={show("text") ? true : undefined}
              aria-describedby={describe(ids.text, Boolean(show("text")), false)}
              onChange={(event) => set({ text: event.target.value })}
              className={textareaClasses}
            />
            {show("text") ? <FieldError id={`${ids.text}-error`}>{t.errors.next}</FieldError> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor={ids.date} optional={t.optional}>
                {t.dateLabel}
              </FieldLabel>
              <input
                id={ids.date}
                type="date"
                min={today}
                value={input.date}
                aria-invalid={show("date") ? true : undefined}
                aria-describedby={describe(ids.date, Boolean(show("date")), true)}
                onChange={(event) => set({ date: event.target.value })}
                className={inputClasses}
              />
              {show("date") ? (
                <FieldError id={`${ids.date}-error`}>{t.errors.date}</FieldError>
              ) : (
                <FieldHint id={`${ids.date}-hint`}>{t.dueHint}</FieldHint>
              )}
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor={ids.time} optional={t.optional}>
                {t.timeLabel}
              </FieldLabel>
              <input
                id={ids.time}
                type="time"
                value={input.time}
                aria-invalid={show("time") ? true : undefined}
                aria-describedby={describe(ids.time, Boolean(show("time")), false)}
                onChange={(event) => set({ time: event.target.value })}
                className={inputClasses}
              />
              {show("time") ? <FieldError id={`${ids.time}-error`}>{t.errors.time}</FieldError> : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={ids.reason}>{t.reasonLabel}</FieldLabel>
            <select
              id={ids.reason}
              value={input.reason}
              required
              aria-invalid={show("reason") ? true : undefined}
              aria-describedby={describe(ids.reason, Boolean(show("reason")), false)}
              onChange={(event) => set({ reason: event.target.value as NoNextStepReason | "" })}
              className={inputClasses}
            >
              <option value="">{t.reasonPlaceholder}</option>
              {noNextStepReasons.map((code) => (
                <option key={code} value={code}>
                  {t.reasons[code]}
                </option>
              ))}
            </select>
            {show("reason") ? <FieldError id={`${ids.reason}-error`}>{t.errors.reason}</FieldError> : null}
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={ids.comment} optional={input.reason === "other" ? undefined : t.optional}>
              {t.commentLabel}
            </FieldLabel>
            <textarea
              id={ids.comment}
              rows={2}
              value={input.comment}
              required={input.reason === "other"}
              aria-invalid={show("comment") ? true : undefined}
              aria-describedby={describe(ids.comment, Boolean(show("comment")), true)}
              onChange={(event) => set({ comment: event.target.value })}
              className={textareaClasses}
            />
            {show("comment") ? (
              <FieldError id={`${ids.comment}-error`}>{t.errors.comment}</FieldError>
            ) : (
              <FieldHint id={`${ids.comment}-hint`}>{t.commentHint}</FieldHint>
            )}
          </div>
        </>
      )}

      <Button type="submit">
        <CircleCheck aria-hidden className="size-4" />
        {t.submit}
      </Button>
    </form>
  );
}
