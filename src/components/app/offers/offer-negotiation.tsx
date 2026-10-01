"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BadgeCheck, CheckCheck, CircleX, Flag, History, Undo2 } from "lucide-react";
import { stickyActionClasses } from "@/components/app/crm/layout-parts";
import { DealSection } from "@/components/app/deals/deal-section";
import {
  answeringSide,
  isNegotiable,
  latestOfferVersion,
  representsSide,
  versionExpired,
} from "@/components/app/deals/offers";
import { textLang } from "@/components/app/inventory/labels";
import {
  ErrorSummary,
  Hint,
  InlineError,
  Label,
  RadioRows,
  inputClasses,
  textareaClasses,
} from "@/components/app/viewings/form-parts";
import { MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import offers from "@/i18n/messages/offers";
import type { ListingAccess } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import { currencies, type Currency, type DealType, type Money, type Offer } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { OfferStatusBadge, TurnBadge, deadlineText, gapText, sideLabel } from "./offer-badges";
import { priceGap } from "./offer-list";
import {
  MAX_RESPONSE_DAYS,
  declineReasons,
  defaultExpiry,
  initialNegotiation,
  reduceNegotiation,
  validateCounter,
  validateDecline,
  type CounterErrors,
  type DeclineReason,
  type NegotiationAction,
  type NegotiationNotice,
  type NegotiationState,
} from "./negotiation";

/**
 * Interactive part of the Offer Detail screen (§21.4 screens 69–70,
 * §22.11): the current state with the answer forms, the full version
 * timeline and the sticky action bar on phones. They share one local demo
 * state (`negotiation.ts`) — the real negotiation rules run against it and
 * every change says it was not saved or sent to anyone.
 */

type Mode = "idle" | "accept" | "decline" | "counter";

interface NegotiationValue {
  locale: Locale;
  now: Date;
  nowIso: string;
  state: NegotiationState;
  dispatch: (action: NegotiationAction) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  dealType: DealType;
  asking: Money;
  access: ListingAccess;
  listingAgentName: string;
}

const NegotiationContext = createContext<NegotiationValue | null>(null);

function useNegotiation(): NegotiationValue {
  const value = useContext(NegotiationContext);
  if (!value) throw new Error("Offer islands must be rendered inside OfferNegotiationProvider");
  return value;
}

export const STATE_SECTION_ID = "offer-state";

export function OfferNegotiationProvider({
  locale,
  offer,
  nowIso,
  dealType,
  asking,
  access,
  listingAgentName,
  children,
}: {
  locale: Locale;
  offer: Offer;
  nowIso: string;
  dealType: DealType;
  asking: Money;
  access: ListingAccess;
  listingAgentName: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reduceNegotiation, offer, initialNegotiation);
  const [mode, setMode] = useState<Mode>("idle");
  const [now] = useState(() => new Date(nowIso));
  const value: NegotiationValue = {
    locale,
    now,
    nowIso,
    state,
    dispatch,
    mode,
    setMode,
    dealType,
    asking,
    access,
    listingAgentName,
  };
  return <NegotiationContext.Provider value={value}>{children}</NegotiationContext.Provider>;
}

/** Who answers now, and whether this viewer may record that answer. */
function useTurn() {
  const { state, access, now } = useNegotiation();
  const latest = latestOfferVersion(state.offer);
  const open = isNegotiable(state.offer) && latest !== undefined;
  const side = answeringSide(state.offer);
  return {
    latest,
    open,
    side,
    canAnswer: open && representsSide(side, access),
    expired: open && latest !== undefined && versionExpired(latest, now),
  };
}

function reasonText(locale: Locale, reason: DeclineReason, comment?: string): string {
  const label = offers[locale].actions.declineReasons[reason];
  return comment ? `${label} — ${comment}` : label;
}

function noticeText(locale: Locale, notice: NegotiationNotice): string {
  const t = offers[locale].done;
  switch (notice.kind) {
    case "accepted":
      return format(t.accepted, { amount: formatMoney(locale, notice.amount) });
    case "declined":
      return format(t.declined, { reason: reasonText(locale, notice.reason, notice.comment) });
    case "countered":
      return format(t.countered, {
        n: notice.version,
        amount: formatMoney(locale, notice.amount),
        date: formatDateTime(locale, notice.expiresAt),
      });
  }
}

/* --------------------------------------------------------------- state */

/**
 * Status, the amount on the table against the asking price, whose turn it
 * is and until when — then the answer forms, or why the viewer cannot
 * answer (the owner's side on someone else's listing).
 */
export function OfferStatePanel() {
  const { locale, state, dispatch, mode, setMode, dealType, asking, listingAgentName } = useNegotiation();
  const t = offers[locale];
  const { latest, open, side, canAnswer, expired } = useTurn();
  const resultRef = useRef<HTMLDivElement>(null);
  const notice = state.notice;

  // Each finished action moves focus to its result, so it is announced and visible.
  useEffect(() => {
    if (notice) resultRef.current?.focus();
  }, [notice]);

  return (
    <DealSection id={STATE_SECTION_ID} title={t.detail.sections.state} icon={Flag}>
      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {notice ? (
          <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
            <p className="flex items-start gap-2 font-semibold">
              <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{noticeText(locale, notice)}</span>
            </p>
            <p>{t.actions.demo}</p>
            <Button
              variant="ghost"
              className="-ml-2 text-info-fg"
              onClick={() => {
                dispatch({ type: "reset" });
                setMode("idle");
              }}
            >
              <Undo2 aria-hidden className="size-4" />
              {t.actions.reset}
            </Button>
          </div>
        ) : null}
      </div>

      <dl className="divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-small text-fg-muted">{t.detail.status}</dt>
          <dd>
            <OfferStatusBadge locale={locale} status={state.offer.status} />
          </dd>
        </div>
        {latest ? (
          <>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.detail.latest}</dt>
              <dd className="text-right">
                <MoneyText locale={locale} value={latest.amount} className="text-body font-semibold text-fg" />
                <span className="block text-caption text-fg-muted">
                  {format(t.card.latest, { n: latest.version, side: sideLabel(locale, dealType, latest.by) })}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.detail.asking}</dt>
              <dd className="text-right text-small font-semibold text-fg">
                <MoneyText locale={locale} value={asking} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-small text-fg-muted">{t.detail.gap}</dt>
              <dd className="text-right text-small text-fg">{gapText(locale, priceGap(latest.amount, asking), asking)}</dd>
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <dt className="text-small text-fg-muted">{t.detail.turn}</dt>
          <dd className="text-right">
            {open ? (
              <TurnBadge locale={locale} dealType={dealType} side={side} overdue={expired} />
            ) : (
              <span className="text-small text-fg-muted">{t.turn.decided}</span>
            )}
          </dd>
        </div>
        {open && latest ? (
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-small text-fg-muted">{t.detail.deadline}</dt>
            <dd className={cn("text-right text-small", expired ? "font-semibold text-danger-fg" : "text-fg")}>
              {deadlineText(locale, latest, expired)}
            </dd>
          </div>
        ) : null}
      </dl>

      {!open ? (
        <Notice kind="info">{format(t.actions.notNegotiable, { status: domain[locale].offerStatus[state.offer.status] })}</Notice>
      ) : !canAnswer ? (
        <Notice kind="permission">
          {format(t.actions.waitingPartner, { side: sideLabel(locale, dealType, side), agent: listingAgentName })}
        </Notice>
      ) : (
        <div className="space-y-3">
          <h3 className="text-body font-semibold text-fg">{t.actions.title}</h3>
          {expired ? <Notice kind="warning">{t.actions.acceptExpired}</Notice> : null}
          {mode === "idle" ? (
            <div className="hidden flex-wrap gap-2 lg:flex">
              <ActionButtons />
            </div>
          ) : null}
          {mode === "accept" ? <AcceptConfirm /> : null}
          {mode === "decline" ? <DeclineForm /> : null}
          {mode === "counter" ? <CounterForm /> : null}
        </div>
      )}
    </DealSection>
  );
}

const barPrimary = "bg-primary text-primary-fg hover:bg-primary-hover";
const barSecondary = "border border-border bg-surface text-fg hover:bg-surface-muted";

/**
 * The three answers. Full buttons in the state section on desktop; in the
 * phone bar, icon over a short label so all three fit one thumb row.
 */
function ActionButtons({ compact = false, onPick }: { compact?: boolean; onPick?: () => void }) {
  const { locale, setMode } = useNegotiation();
  const t = offers[locale].actions;
  const { latest, expired } = useTurn();
  if (!latest) return null;
  const actions: { mode: Mode; icon: typeof BadgeCheck; label: string; short: string; primary: boolean }[] = [
    ...(expired
      ? []
      : [
          {
            mode: "accept" as const,
            icon: BadgeCheck,
            label: format(t.accept, { amount: formatMoney(locale, latest.amount) }),
            short: t.acceptShort,
            primary: true,
          },
        ]),
    { mode: "counter", icon: History, label: t.counter, short: t.counterShort, primary: false },
    { mode: "decline", icon: CircleX, label: t.decline, short: t.decline, primary: false },
  ];
  return (
    <>
      {actions.map(({ mode, icon: Icon, label, short, primary }) =>
        compact ? (
          <button
            key={mode}
            type="button"
            aria-label={label}
            className={cn(stickyActionClasses, primary ? barPrimary : barSecondary)}
            onClick={() => {
              setMode(mode);
              onPick?.();
            }}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            {short}
          </button>
        ) : (
          <Button key={mode} variant={primary ? "primary" : "secondary"} onClick={() => setMode(mode)}>
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
          </Button>
        ),
      )}
    </>
  );
}

/** §35.2 row 10: acceptance needs an explicit second step that names the side and the amount. */
function AcceptConfirm() {
  const { locale, nowIso, dispatch, setMode, dealType } = useNegotiation();
  const t = offers[locale].actions;
  const id = useId();
  const { latest, side } = useTurn();
  if (!latest) return null;
  const amount = formatMoney(locale, latest.amount);
  return (
    <div role="group" aria-labelledby={`${id}-title`} className="space-y-2 rounded-md border border-border bg-surface-muted p-3">
      <p id={`${id}-title`} className="text-small font-semibold text-fg">
        {format(t.acceptTitle, { by: sideLabel(locale, dealType, latest.by) })}
      </p>
      <p className="text-small text-fg-muted">{format(t.acceptText, { side: sideLabel(locale, dealType, side), amount })}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            dispatch({ type: "accept", at: nowIso });
            setMode("idle");
          }}
        >
          <BadgeCheck aria-hidden className="size-4" />
          {format(t.acceptConfirm, { amount })}
        </Button>
        <Button variant="ghost" onClick={() => setMode("idle")}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}

function DeclineForm() {
  const { locale, nowIso, dispatch, setMode, dealType } = useNegotiation();
  const t = offers[locale];
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const { side } = useTurn();
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; comment?: string }>({});

  const summary = [
    ...(errors.reason ? [{ id: `${id}-reason`, text: errors.reason }] : []),
    ...(errors.comment ? [{ id: `${id}-comment`, text: errors.comment }] : []),
  ];

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const check = validateDecline(reason, comment);
        if (!check.ok) {
          setErrors({
            reason: check.errors.reason ? t.errors.reason_missing : undefined,
            comment: check.errors.comment ? t.errors.comment_missing : undefined,
          });
          requestAnimationFrame(() => summaryRef.current?.focus());
          return;
        }
        setErrors({});
        dispatch({ type: "decline", reason: check.reason, comment: check.comment, at: nowIso });
        setMode("idle");
      }}
    >
      <p id={`${id}-title`} className="text-small font-semibold text-fg">
        {format(t.actions.declineTitle, { side: sideLabel(locale, dealType, side) })}
      </p>
      <ErrorSummary title={t.actions.errorsTitle} errors={summary} summaryRef={summaryRef} />
      <div id={`${id}-reason`} tabIndex={-1} className="space-y-1.5 outline-none">
        <RadioRows
          name={`${id}-reason`}
          legend={t.actions.declineReason}
          options={declineReasons.map((value) => ({ value, label: t.actions.declineReasons[value] }))}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setErrors({});
          }}
          invalid={Boolean(errors.reason)}
          describedBy={errors.reason ? `${id}-reason-error` : undefined}
        />
        {errors.reason ? <InlineError id={`${id}-reason-error`}>{errors.reason}</InlineError> : null}
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor={`${id}-comment`}
          note={reason === "other" ? t.actions.declineCommentRequired : t.actions.declineCommentOptional}
        >
          {t.actions.declineComment}
        </Label>
        <textarea
          id={`${id}-comment`}
          className={textareaClasses}
          rows={2}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={errors.comment ? `${id}-comment-error` : undefined}
        />
        {errors.comment ? <InlineError id={`${id}-comment-error`}>{errors.comment}</InlineError> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger">
          <CircleX aria-hidden className="size-4" />
          {t.actions.declineConfirm}
        </Button>
        <Button variant="ghost" onClick={() => setMode("idle")}>
          {t.actions.cancel}
        </Button>
      </div>
    </form>
  );
}

/** A new version from the answering side: amount, explicit currency, response deadline and a note. */
function CounterForm() {
  const { locale, now, nowIso, dispatch, setMode, dealType } = useNegotiation();
  const t = offers[locale];
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const { latest, side } = useTurn();
  const [initialExpiry] = useState(() => defaultExpiry(now));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(latest?.amount.currency ?? "USD");
  const [date, setDate] = useState(initialExpiry.date);
  const [time, setTime] = useState(initialExpiry.time);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<CounterErrors>({});
  if (!latest) return null;

  const negotiationCurrency = latest.amount.currency;
  const errorText = (field: keyof CounterErrors): string | undefined => {
    const code = errors[field];
    if (!code) return undefined;
    return format(t.errors[code], { currency: negotiationCurrency, days: MAX_RESPONSE_DAYS });
  };
  const fieldIds = { amount: `${id}-amount`, currency: `${id}-currency`, expiry: `${id}-date` } as const;
  const summary = (["amount", "currency", "expiry"] as const).flatMap((field) => {
    const text = errorText(field);
    return text ? [{ id: fieldIds[field] as string, text }] : [];
  });
  const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const check = validateCounter({ amount, currency, date, time, note }, latest, now);
        if (!check.ok) {
          setErrors(check.errors);
          requestAnimationFrame(() => summaryRef.current?.focus());
          return;
        }
        setErrors({});
        dispatch({ type: "counter", amount: check.amount, expiresAt: check.expiresAt, note: check.note, at: nowIso });
        setMode("idle");
      }}
    >
      <p id={`${id}-title`} className="text-small font-semibold text-fg">
        {format(t.actions.counterTitle, { side: sideLabel(locale, dealType, side) })}
      </p>
      <ErrorSummary title={t.actions.errorsTitle} errors={summary} summaryRef={summaryRef} />

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldIds.amount}>{t.actions.counterAmount}</Label>
          <input
            id={fieldIds.amount}
            inputMode="decimal"
            autoComplete="off"
            className={inputClasses}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describe(`${id}-amount-hint`, errors.amount && `${id}-amount-error`)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fieldIds.currency}>{t.actions.counterCurrency}</Label>
          <select
            id={fieldIds.currency}
            className={inputClasses}
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-invalid={errors.currency ? true : undefined}
            aria-describedby={describe(`${id}-currency-hint`, errors.currency && `${id}-currency-error`)}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Hint id={`${id}-amount-hint`}>
        {format(t.actions.counterAmountHint, { amount: formatMoney(locale, latest.amount) })}
      </Hint>
      {errors.amount ? <InlineError id={`${id}-amount-error`}>{errorText("amount")}</InlineError> : null}
      <Hint id={`${id}-currency-hint`}>{format(t.actions.counterCurrencyHint, { currency: negotiationCurrency })}</Hint>
      {errors.currency ? <InlineError id={`${id}-currency-error`}>{errorText("currency")}</InlineError> : null}

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldIds.expiry}>{t.actions.counterDate}</Label>
          <input
            id={fieldIds.expiry}
            type="date"
            className={inputClasses}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={describe(`${id}-expiry-hint`, errors.expiry && `${id}-expiry-error`)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>{t.actions.counterTime}</Label>
          <input
            id={`${id}-time`}
            type="time"
            className={inputClasses}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={describe(`${id}-expiry-hint`, errors.expiry && `${id}-expiry-error`)}
          />
        </div>
      </div>
      <Hint id={`${id}-expiry-hint`}>{format(t.actions.counterExpiryHint, { days: MAX_RESPONSE_DAYS })}</Hint>
      {errors.expiry ? <InlineError id={`${id}-expiry-error`}>{errorText("expiry")}</InlineError> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-note`} note={t.actions.counterNoteOptional}>
          {t.actions.counterNote}
        </Label>
        <textarea
          id={`${id}-note`}
          className={textareaClasses}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <History aria-hidden className="size-4" />
          {format(t.actions.counterSubmit, { n: latest.version + 1 })}
        </Button>
        <Button variant="ghost" onClick={() => setMode("idle")}>
          {t.actions.cancel}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ timeline */

/**
 * Every version, oldest first, with its side, amount, time, response
 * deadline and note (§22.11). Versions are only appended; the decision, when
 * there is one, closes the list.
 */
export function OfferTimeline() {
  const { locale, now, state, dealType } = useNegotiation();
  const t = offers[locale];
  const { offer, decision, demoVersions } = state;
  const open = isNegotiable(offer);

  return (
    <DealSection id="offer-timeline" title={t.detail.sections.timeline} icon={History} hint={t.list.historyNote}>
      {offer.versions.length === 0 ? (
        <p className="text-small text-fg-muted">{t.detail.timelineEmpty}</p>
      ) : (
        <ol className="space-y-0 border-l-2 border-border pl-4">
          {offer.versions.map((version, index) => {
            const isLatest = index === offer.versions.length - 1;
            const expired = isLatest && open && versionExpired(version, now);
            const demo = demoVersions.includes(version.version);
            return (
              <li key={version.version} className="relative pb-4 last:pb-0">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full border-2 border-surface",
                    isLatest ? "bg-primary" : "bg-border-strong",
                  )}
                />
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-small">
                  <span className="font-semibold text-fg">{sideLabel(locale, dealType, version.by)}</span>
                  <MoneyText locale={locale} value={version.amount} className="font-semibold text-fg" />
                  <span className="text-caption text-fg-muted">{format(t.detail.version, { n: version.version })}</span>
                  {isLatest ? <Badge>{t.detail.latestBadge}</Badge> : null}
                  {demo ? <Badge tone="info">{t.detail.demoBadge}</Badge> : null}
                </p>
                <p className="text-caption text-fg-muted">
                  <time dateTime={version.at}>{formatDateTime(locale, version.at)}</time>
                  {" · "}
                  <span className={cn(expired && "font-semibold text-danger-fg")}>
                    {version.expiresAt
                      ? format(expired ? t.detail.expired : t.detail.expires, {
                          date: formatDateTime(locale, version.expiresAt),
                        })
                      : t.detail.noExpiry}
                  </span>
                </p>
                {version.note ? (
                  <p lang={textLang(version.note)} className="mt-0.5 text-small text-fg">
                    «{version.note}»
                  </p>
                ) : null}
              </li>
            );
          })}
          {decision ? (
            <li className="relative pt-1">
              <span
                aria-hidden
                className="absolute top-2.5 -left-[1.3125rem] size-2.5 rounded-full border-2 border-surface bg-fg"
              />
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-small font-semibold text-fg">
                {decision.kind === "accepted"
                  ? format(t.detail.decisionAccepted, {
                      side: sideLabel(locale, dealType, decision.side),
                      n: decision.version,
                      amount: formatMoney(locale, offer.versions[offer.versions.length - 1].amount),
                    })
                  : format(t.detail.decisionDeclined, {
                      side: sideLabel(locale, dealType, decision.side),
                      n: decision.version,
                      reason: reasonText(locale, decision.reason ?? "other", decision.comment),
                    })}
                <Badge tone="info">{t.detail.demoBadge}</Badge>
              </p>
              <p className="text-caption text-fg-muted">
                <time dateTime={decision.at}>{formatDateTime(locale, decision.at)}</time>
              </p>
            </li>
          ) : !open ? (
            <li className="relative pt-1">
              <span
                aria-hidden
                className="absolute top-2.5 -left-[1.3125rem] size-2.5 rounded-full border-2 border-surface bg-fg"
              />
              <p className="flex flex-wrap items-center gap-2 text-small text-fg">
                <OfferStatusBadge locale={locale} status={offer.status} />
              </p>
            </li>
          ) : null}
        </ol>
      )}
    </DealSection>
  );
}

/* ---------------------------------------------------------- action bar */

/**
 * Sticky answer actions on phones (§14.3, §22.6). Each opens its form in
 * the state section, which scrolls into view. Hidden when the viewer has
 * nothing to answer or a form is already open.
 */
export function OfferActionBar() {
  const { locale, mode } = useNegotiation();
  const { canAnswer } = useTurn();
  // While a form is open its own buttons take over, and the bar would cover them.
  if (!canAnswer || mode !== "idle") return null;
  return (
    <div
      role="group"
      aria-label={offers[locale].actions.bar}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <ActionButtons
          compact
          onPick={() => document.getElementById(STATE_SECTION_ID)?.scrollIntoView({ block: "start" })}
        />
      </div>
    </div>
  );
}

/** Keeps the last section clear of the fixed bar on phones, only while the bar is shown. */
export function OfferBarSpacer() {
  const { canAnswer } = useTurn();
  return canAnswer ? <div aria-hidden className="h-20 lg:hidden" /> : null;
}
