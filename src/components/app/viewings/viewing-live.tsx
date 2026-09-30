"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  ClipboardCheck,
  ListTodo,
  Star,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatDay, formatList, formatTime } from "@/i18n/format";
import viewings from "@/i18n/messages/viewings";
import type { Viewing } from "@/lib/domain/types";
import { canRecordOutcome, DURATION_OPTIONS, findOverlaps, isOpen, slotEnd } from "./agenda";
import { CheckRow, ErrorSummary, Hint, InlineError, inputClasses, Label, RadioRows, textareaClasses } from "./form-parts";
import { checkSlot, type ExistingSlot } from "./new-viewing";
import { tashkentParts } from "./time";
import { ConfirmationList, ViewingStatusBadge } from "./viewing-badges";
import {
  initialViewingDemoState,
  reduceViewingDemo,
  type CancelReason,
  type NoShowWho,
  type ViewingDemoAction,
  type ViewingDemoNotice,
  type ViewingDemoState,
} from "./viewing-demo-state";

/**
 * Interactive parts of the viewing detail (§22.10, §35.2 row 9): live status
 * and confirmations, the outcome with its mandatory next step (§14.8), and a
 * sticky action bar in the thumb zone (§14.3). Every change is local demo
 * state: the page says so and offers to undo — nothing pretends to reach a
 * server or notify anyone.
 *
 * `ViewingDemoProvider` holds the state; server-rendered sections (place,
 * property, participants) sit between the islands as children.
 */

type Panel = "confirm" | "reschedule" | "cancel" | "outcome" | "next";

interface ViewingDemoContextValue {
  locale: Locale;
  now: Date;
  state: ViewingDemoState;
  dispatch: (action: ViewingDemoAction) => void;
  /** The agent's other viewings, for live overlap checks. */
  slots: ExistingSlot[];
  hasPartner: boolean;
  /** Who a change affects, already localized: «Гульнара Сафарова (клиент)». */
  participants: string[];
  newViewingHref: string;
  clientHref: string;
  panel: Panel | null;
  openPanel: (panel: Panel | null) => void;
}

const ViewingDemoContext = createContext<ViewingDemoContextValue | null>(null);

function useViewingDemo(): ViewingDemoContextValue {
  const value = useContext(ViewingDemoContext);
  if (!value) throw new Error("Viewing demo islands must be rendered inside ViewingDemoProvider");
  return value;
}

export function ViewingDemoProvider({
  locale,
  viewing,
  nowIso,
  slots,
  hasPartner,
  participants,
  newViewingHref,
  clientHref,
  children,
}: {
  locale: Locale;
  viewing: Viewing;
  nowIso: string;
  slots: ExistingSlot[];
  hasPartner: boolean;
  participants: string[];
  newViewingHref: string;
  clientHref: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reduceViewingDemo, viewing, initialViewingDemoState);
  const [panel, setPanel] = useState<Panel | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const value: ViewingDemoContextValue = {
    locale,
    now,
    state,
    dispatch,
    slots,
    hasPartner,
    participants,
    newViewingHref,
    clientHref,
    panel,
    openPanel: setPanel,
  };
  return <ViewingDemoContext.Provider value={value}>{children}</ViewingDemoContext.Provider>;
}

/* ------------------------------------------------------------- helpers */

function listText(locale: Locale, items: string[]): string {
  return formatList(locale, items);
}

function timeRange(locale: Locale, viewing: Pick<Viewing, "startsAt" | "durationMinutes">): string {
  const end = new Date(slotEnd(viewing)).toISOString();
  return `${formatTime(locale, viewing.startsAt)}–${formatTime(locale, end)}`;
}

function overlapText(locale: Locale, overlaps: ExistingSlot[]): string {
  return listText(
    locale,
    overlaps.map((slot) => `${formatTime(locale, slot.startsAt)} · ${slot.clientName} · ${slot.propertyLabel}`),
  );
}

function noticeText(locale: Locale, notice: ViewingDemoNotice): string {
  const t = viewings[locale].actions;
  switch (notice.kind) {
    case "confirmed":
      return t.done.confirmed;
    case "rescheduled":
      return format(t.done.rescheduled, { when: formatDateTime(locale, notice.startsAt) });
    case "cancelled":
      return format(t.done.cancelled, {
        reason: notice.comment ? `${t.cancelReasons[notice.reason]} — ${notice.comment}` : t.cancelReasons[notice.reason],
      });
    case "completed":
      return t.done.completed;
    case "no_show":
      return t.done.noShow;
  }
}

/* ------------------------------------------------------- status island */

export function ViewingStatusCard() {
  const { locale, state, dispatch, slots, hasPartner } = useViewingDemo();
  const t = viewings[locale];
  const { viewing, notice } = state;
  const overlaps = isOpen(viewing) ? findOverlaps(viewing, slots) : [];

  return (
    <section aria-labelledby="viewing-status-title">
      <Card className="space-y-3 p-4">
        <h2 id="viewing-status-title" className="flex items-center gap-2 text-h2 text-fg">
          <CalendarClock aria-hidden className="size-5 shrink-0 text-fg-muted" />
          {t.detail.sections.status}
        </h2>

        <div role="status" aria-live="polite">
          {notice ? (
            <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
              <p className="flex items-start gap-2 font-semibold">
                <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{noticeText(locale, notice)}</span>
              </p>
              <p>{t.actions.demo}</p>
              <Button variant="ghost" className="-ml-2 text-info-fg" onClick={() => dispatch({ type: "undo" })}>
                <Undo2 aria-hidden className="size-4" />
                {t.actions.undo}
              </Button>
            </div>
          ) : null}
        </div>

        <dl className="divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.status}</dt>
            <dd>
              <ViewingStatusBadge locale={locale} status={viewing.status} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.date}</dt>
            <dd className="text-right text-small font-medium text-fg">
              {formatDay(locale, viewing.startsAt, { year: true })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.time}</dt>
            <dd className="text-right text-small font-medium text-fg tabular">
              <time dateTime={viewing.startsAt}>{timeRange(locale, viewing)}</time>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.duration}</dt>
            <dd className="text-right text-small font-medium text-fg">
              {format(t.item.duration, { n: viewing.durationMinutes })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.timezone}</dt>
            <dd className="text-right text-small font-medium text-fg">{t.detail.timezoneValue}</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          <h3 className="text-small font-semibold text-fg">{t.detail.confirmations}</h3>
          <ConfirmationList locale={locale} confirmations={viewing.confirmations} hasPartner={hasPartner} />
        </div>

        {overlaps.length > 0 ? (
          <Notice kind="warning" title={t.detail.conflictTitle}>
            {format(t.detail.conflictText, { list: overlapText(locale, overlaps) })}
          </Notice>
        ) : null}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------- result island */

export function ViewingResultCard() {
  const { locale, state, now, newViewingHref, openPanel } = useViewingDemo();
  const t = viewings[locale];
  const { viewing } = state;

  let body: ReactNode;
  if (viewing.status === "cancelled") {
    body = (
      <div className="space-y-3">
        <p className="text-small text-fg-muted">{t.detail.cancelled}</p>
        <ButtonLink href={newViewingHref} variant="secondary">
          <CalendarPlus aria-hidden className="size-4" />
          {t.detail.newViewing}
        </ButtonLink>
      </div>
    );
  } else if (isOpen(viewing)) {
    body = (
      <div className="space-y-3">
        <p className="text-small text-fg-muted">{t.detail.upcoming}</p>
        {canRecordOutcome(viewing, now) ? (
          <Button variant="secondary" onClick={() => openPanel("outcome")}>
            <ClipboardCheck aria-hidden className="size-4" />
            {t.actions.outcome}
          </Button>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        {viewing.status === "no_show" ? <p className="text-small text-fg-muted">{t.detail.noShow}</p> : null}
        {viewing.status === "completed" ? (
          <dl className="space-y-3">
            <div className="space-y-1">
              <dt className="text-small text-fg-muted">{t.detail.rating}</dt>
              <dd className="text-small font-medium text-fg">
                {viewing.feedback ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Star aria-hidden className="size-4 shrink-0 text-warning-fg" />
                    {format(t.detail.ratingValue, { n: viewing.feedback.rating, label: t.rating[viewing.feedback.rating] })}
                  </span>
                ) : (
                  <span className="font-normal italic text-fg-muted">{t.detail.noFeedback}</span>
                )}
              </dd>
            </div>
            {viewing.feedback?.text ? (
              <div className="space-y-1">
                <dt className="text-small text-fg-muted">{t.detail.feedbackText}</dt>
                <dd className="text-small text-fg">
                  <q lang={/[Ѐ-ӿ]/.test(viewing.feedback.text) ? "ru" : "uz-Latn"}>{viewing.feedback.text}</q>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {viewing.nextAction ? (
          <div className="space-y-1 rounded-md border border-border bg-surface-muted p-3">
            <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-fg-subtle">
              <ListTodo aria-hidden className="size-4" />
              {t.detail.nextAction}
            </p>
            <p className="text-small font-medium text-fg">{viewing.nextAction}</p>
          </div>
        ) : (
          <Notice
            kind="warning"
            title={t.item.needsNextStep}
            action={
              <Button variant="secondary" onClick={() => openPanel("next")}>
                <ListTodo aria-hidden className="size-4" />
                {t.actions.setNextAction}
              </Button>
            }
          >
            {t.detail.nextActionMissing}
          </Notice>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="viewing-result-title">
      <Card className="space-y-3 p-4">
        <h2 id="viewing-result-title" className="flex items-center gap-2 text-h2 text-fg">
          <ClipboardCheck aria-hidden className="size-5 shrink-0 text-fg-muted" />
          {t.detail.sections.result}
        </h2>
        {body}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------- panels */

type NextActionOption = keyof (typeof viewings)["ru"]["actions"]["nextActionOptions"];
const NEXT_ACTION_OPTIONS: readonly NextActionOption[] = ["offer", "more", "repeat", "think", "update"];

/** Required next-step input with one-tap suggestions (§14.8). */
function NextActionField({
  locale,
  value,
  onChange,
  error,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  error: boolean;
}) {
  const t = viewings[locale].actions;
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-input`} note={t.nextActionRequired}>
        {t.nextAction}
      </Label>
      <input
        id={`${id}-input`}
        className={inputClasses}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t.nextActionPlaceholder}
        aria-invalid={error || undefined}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        required
      />
      <Hint id={`${id}-hint`}>{t.nextActionHint}</Hint>
      {error ? <InlineError id={`${id}-error`}>{t.errors.nextAction}</InlineError> : null}
      <div role="group" aria-label={t.nextActionQuick} className="flex flex-wrap gap-2">
        {NEXT_ACTION_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(t.nextActionOptions[option])}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3.5 text-small text-fg hover:bg-surface-muted"
          >
            {t.nextActionOptions[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmPanel({ onDone }: { onDone: () => void }) {
  const { locale, state, dispatch, hasPartner } = useViewingDemo();
  const t = viewings[locale].actions;
  const [client, setClient] = useState(state.viewing.confirmations.client);
  const [other, setOther] = useState(state.viewing.confirmations.ownerOrPartner);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: "confirm", client, ownerOrPartner: other });
        onDone();
      }}
    >
      <fieldset className="space-y-1">
        <legend className="sr-only">{t.confirmTitle}</legend>
        <CheckRow checked={client} onChange={setClient}>
          {t.confirmClient}
        </CheckRow>
        <CheckRow checked={other} onChange={setOther}>
          {hasPartner ? t.confirmPartner : t.confirmOwner}
        </CheckRow>
      </fieldset>
      <Hint>{t.confirmHint}</Hint>
      <Button type="submit">{t.confirmSave}</Button>
    </form>
  );
}

function ReschedulePanel({ onDone }: { onDone: () => void }) {
  const { locale, state, dispatch, slots, now, participants } = useViewingDemo();
  const t = viewings[locale].actions;
  const id = useId();
  const initial = tashkentParts(state.viewing.startsAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(state.viewing.durationMinutes);
  const [submitted, setSubmitted] = useState(false);
  const check = checkSlot({ date, time, durationMinutes: duration, selfId: state.viewing.id }, now, slots);
  const timeError = check.errors.includes("date") || check.errors.includes("time");
  const pastError = check.errors.includes("past");
  const durations = DURATION_OPTIONS.includes(duration as (typeof DURATION_OPTIONS)[number])
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (check.errors.length > 0 || !check.startsAt) return;
        dispatch({ type: "reschedule", startsAt: check.startsAt, durationMinutes: duration });
        onDone();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>{t.newDate}</Label>
          <input
            id={`${id}-date`}
            type="date"
            className={inputClasses}
            value={date}
            min={tashkentParts(now).date}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={(submitted && timeError) || undefined}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>{t.newTime}</Label>
          <input
            id={`${id}-time`}
            type="time"
            className={inputClasses}
            value={time}
            step={300}
            onChange={(event) => setTime(event.target.value)}
            aria-invalid={(submitted && (timeError || pastError)) || undefined}
            aria-describedby={`${id}-tz`}
            required
          />
        </div>
      </div>
      <Hint id={`${id}-tz`}>{t.timeHint}</Hint>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-duration`}>{viewings[locale].form.duration}</Label>
        <select
          id={`${id}-duration`}
          className={inputClasses}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
        >
          {durations.map((minutes) => (
            <option key={minutes} value={minutes}>
              {format(viewings[locale].form.minutes, { n: minutes })}
            </option>
          ))}
        </select>
      </div>
      {submitted && timeError ? <InlineError>{t.errors.time}</InlineError> : null}
      {pastError ? <InlineError>{t.errors.past}</InlineError> : null}
      {check.overlaps.length > 0 ? (
        <p className="flex items-start gap-1.5 text-caption font-medium text-warning-fg">
          <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>{format(t.overlap, { list: overlapText(locale, check.overlaps) })}</span>
        </p>
      ) : null}
      <Hint>{format(t.rescheduleNotify, { list: listText(locale, participants) })}</Hint>
      <Button type="submit">
        <CalendarClock aria-hidden className="size-4" />
        {t.rescheduleSave}
      </Button>
    </form>
  );
}

const CANCEL_REASONS: readonly CancelReason[] = ["client", "owner", "unavailable", "changed", "other"];

function CancelPanel({ onDone, onKeep }: { onDone: () => void; onKeep: () => void }) {
  const { locale, dispatch, participants } = useViewingDemo();
  const t = viewings[locale].actions;
  const id = useId();
  const [reason, setReason] = useState<CancelReason | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const missingReason = submitted && !reason;

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!reason) return;
        dispatch({ type: "cancel", reason, comment });
        onDone();
      }}
    >
      <RadioRows
        name={`${id}-reason`}
        legend={t.cancelReason}
        options={CANCEL_REASONS.map((value) => ({ value, label: t.cancelReasons[value] }))}
        value={reason}
        onChange={setReason}
        invalid={missingReason}
        describedBy={missingReason ? `${id}-reason-error` : undefined}
      />
      {missingReason ? <InlineError id={`${id}-reason-error`}>{t.errors.reason}</InlineError> : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-comment`} note={t.cancelCommentOptional}>
          {t.cancelComment}
        </Label>
        <textarea
          id={`${id}-comment`}
          className={textareaClasses}
          rows={2}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <Hint>{format(t.cancelNotify, { list: listText(locale, participants) })}</Hint>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger">
          <CalendarX aria-hidden className="size-4" />
          {t.cancelConfirm}
        </Button>
        <Button variant="ghost" onClick={onKeep}>
          {t.cancelKeep}
        </Button>
      </div>
    </form>
  );
}

type Outcome = "completed" | "no_show";
type Rating = 1 | 2 | 3 | 4 | 5;
const RATINGS: readonly Rating[] = [5, 4, 3, 2, 1];
const NO_SHOW_WHO: readonly NoShowWho[] = ["client", "owner", "unknown"];

function OutcomePanel({ onDone }: { onDone: () => void }) {
  const { locale, state, dispatch, now } = useViewingDemo();
  const t = viewings[locale];
  const a = t.actions;
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [outcome, setOutcome] = useState<Outcome>("completed");
  const [rating, setRating] = useState<`${Rating}` | undefined>(undefined);
  const [text, setText] = useState("");
  const [who, setWho] = useState<NoShowWho | undefined>(undefined);
  const [nextAction, setNextAction] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const missingNext = submitted && !nextAction.trim();
  const early = Date.parse(state.viewing.startsAt) > now.getTime();

  useEffect(() => {
    if (missingNext) summaryRef.current?.focus();
  }, [missingNext]);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!nextAction.trim()) return;
        if (outcome === "completed") {
          dispatch({ type: "complete", nextAction, rating: rating ? (Number(rating) as Rating) : undefined, text });
        } else {
          dispatch({ type: "no_show", nextAction, who });
        }
        onDone();
      }}
    >
      {early ? <Hint>{a.outcomeEarly}</Hint> : null}
      <ErrorSummary
        title={a.errorsTitle}
        errors={missingNext ? [{ id: `${id}-next`, text: a.errors.nextAction }] : []}
        summaryRef={summaryRef}
      />
      <RadioRows
        name={`${id}-outcome`}
        legend={a.outcomeTitle}
        options={[
          { value: "completed", label: a.completed },
          { value: "no_show", label: a.noShow },
        ]}
        value={outcome}
        onChange={setOutcome}
      />
      {outcome === "completed" ? (
        <>
          <RadioRows
            name={`${id}-rating`}
            legend={a.rating}
            note={a.ratingOptional}
            options={RATINGS.map((value) => ({
              value: `${value}` as const,
              label: (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5 font-semibold tabular">
                    <Star aria-hidden className="size-4 text-warning-fg" />
                    {value}
                  </span>
                  <span>— {t.rating[value]}</span>
                </span>
              ),
            }))}
            value={rating}
            onChange={setRating}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-text`} note={a.ratingOptional}>
              {a.feedbackText}
            </Label>
            <textarea
              id={`${id}-text`}
              className={textareaClasses}
              rows={3}
              value={text}
              placeholder={a.feedbackPlaceholder}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        </>
      ) : (
        <RadioRows
          name={`${id}-who`}
          legend={a.noShowWho}
          note={a.ratingOptional}
          options={NO_SHOW_WHO.map((value) => ({ value, label: a.noShowWhoOptions[value] }))}
          value={who}
          onChange={setWho}
        />
      )}
      <div id={`${id}-next`}>
        <NextActionField locale={locale} value={nextAction} onChange={setNextAction} error={missingNext} />
      </div>
      <Button type="submit">
        <ClipboardCheck aria-hidden className="size-4" />
        {a.saveOutcome}
      </Button>
    </form>
  );
}

function NextPanel({ onDone }: { onDone: () => void }) {
  const { locale, dispatch } = useViewingDemo();
  const a = viewings[locale].actions;
  const [nextAction, setNextAction] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const missing = submitted && !nextAction.trim();
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!nextAction.trim()) return;
        dispatch({ type: "next_action", nextAction });
        onDone();
      }}
    >
      <NextActionField locale={locale} value={nextAction} onChange={setNextAction} error={missing} />
      <Button type="submit">{a.saveNext}</Button>
    </form>
  );
}

/* ------------------------------------------------------------ action bar */

/**
 * Primary actions in the thumb zone: fixed above the bottom navigation on
 * phones (the shell hides the "+" meanwhile), inline on desktop. Panels open
 * above the bar; Escape closes them and focus returns to the trigger.
 */
export function ViewingActionBar() {
  const { locale, state, now, panel, openPanel, newViewingHref, clientHref } = useViewingDemo();
  const t = viewings[locale];
  const a = t.actions;
  const { viewing } = state;
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!panel) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    if (!wasOpen.current && document.activeElement instanceof HTMLElement) triggerRef.current = document.activeElement;
    wasOpen.current = true;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") openPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);

  const close = () => openPanel(null);
  const toggle = (next: Panel) => openPanel(panel === next ? null : next);
  const open = isOpen(viewing);
  const outcomeReady = canRecordOutcome(viewing, now);
  const needsNext = (viewing.status === "completed" || viewing.status === "no_show") && !viewing.nextAction;

  const titles: Record<Panel, string> = {
    confirm: a.confirmTitle,
    reschedule: a.rescheduleTitle,
    cancel: a.cancelTitle,
    outcome: a.outcomeTitle,
    next: a.nextTitle,
  };

  const secondary = (key: Panel, label: string, Icon: typeof CalendarClock) => (
    <Button
      key={key}
      variant="secondary"
      className="shrink-0 px-3"
      aria-expanded={panel === key}
      aria-controls={panel === key ? panelId : undefined}
      onClick={() => toggle(key)}
    >
      <Icon aria-hidden className="size-4" />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </Button>
  );

  return (
    <div
      role="group"
      aria-label={a.label}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 py-2 px-4 backdrop-blur lg:relative lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      {panel ? (
        <div
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="absolute inset-x-2 bottom-full mb-2 max-h-[65dvh] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float outline-none lg:inset-x-auto lg:top-full lg:bottom-auto lg:left-0 lg:mt-2 lg:mb-0 lg:w-[28rem]"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <p id={`${panelId}-title`} className="text-body font-semibold text-fg">
              {titles[panel]}
            </p>
            <Button variant="ghost" size="icon" onClick={close} aria-label={a.close}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>
          {panel === "confirm" ? <ConfirmPanel onDone={close} /> : null}
          {panel === "reschedule" ? <ReschedulePanel onDone={close} /> : null}
          {panel === "cancel" ? <CancelPanel onDone={close} onKeep={close} /> : null}
          {panel === "outcome" ? <OutcomePanel onDone={close} /> : null}
          {panel === "next" ? <NextPanel onDone={close} /> : null}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl gap-2 lg:mx-0 lg:flex-wrap">
        {open ? (
          <>
            <Button
              className="min-w-0 flex-1 lg:flex-none"
              aria-expanded={panel === (outcomeReady ? "outcome" : "confirm")}
              aria-controls={panel ? panelId : undefined}
              onClick={() => toggle(outcomeReady ? "outcome" : "confirm")}
            >
              <ClipboardCheck aria-hidden className="size-4 shrink-0" />
              {outcomeReady ? (
                <>
                  <span className="truncate lg:hidden">{a.outcomeShort}</span>
                  <span className="hidden lg:inline">{a.outcome}</span>
                </>
              ) : (
                <span className="truncate">{a.confirm}</span>
              )}
            </Button>
            {outcomeReady ? secondary("confirm", a.confirm, CheckCheck) : null}
            {secondary("reschedule", a.reschedule, CalendarClock)}
            {secondary("cancel", a.cancel, CalendarX)}
          </>
        ) : needsNext ? (
          <Button
            className="min-w-0 flex-1 lg:flex-none"
            aria-expanded={panel === "next"}
            aria-controls={panel === "next" ? panelId : undefined}
            onClick={() => toggle("next")}
          >
            <ListTodo aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{a.setNextAction}</span>
          </Button>
        ) : (
          <>
            <ButtonLink href={newViewingHref} className="min-w-0 flex-1 lg:flex-none">
              <CalendarPlus aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{t.detail.newViewing}</span>
            </ButtonLink>
            <ButtonLink href={clientHref} variant="secondary" className="shrink-0">
              {t.detail.openClient}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
