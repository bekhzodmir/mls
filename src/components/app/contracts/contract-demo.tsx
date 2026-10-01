"use client";

import Link from "next/link";
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
import {
  ArrowRight,
  CheckCheck,
  CircleCheck,
  CopyPlus,
  FileX,
  Flag,
  OctagonAlert,
  Send,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { stickyActionClasses } from "@/components/app/crm/layout-parts";
import { DealSection } from "@/components/app/deals/deal-section";
import { Hint, InlineError, Label, textareaClasses } from "@/components/app/viewings/form-parts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatList } from "@/i18n/format";
import contracts from "@/i18n/messages/contracts";
import {
  canActivate,
  contractDisplayStatus,
  contractIssues,
  daysUntilEnd,
  type ContractContext,
  type ContractIssue,
} from "@/lib/domain/contracts";
import type { Contract, ID } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { ContractStatusBadge } from "./contract-badges";
import {
  availableActions,
  contractHref,
  type ContractAction,
  type SignatureSide,
} from "./contract-rules";
import {
  initialContractDemoState,
  reduceContractDemo,
  type ContractDemoAction,
  type ContractDemoContext,
  type ContractDemoNotice,
  type ContractDemoState,
} from "./contract-demo-state";
import { daysText, issueText } from "./contract-text";

/**
 * Interactive part of the contract workspace: the current status with the
 * domain check (`canActivate` / `contractIssues`), the demo actions —
 * renew, terminate with a reason, send for signature — and the sticky
 * action bar on phones. Every change is local and labelled as not sent.
 */

type Mode = "idle" | "terminate";

interface ContractDemoValue {
  locale: Locale;
  now: Date;
  state: ContractDemoState;
  dispatch: (action: ContractDemoAction) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  rules: ContractContext;
  holderNames: Record<ID, string>;
  /** The responsible agent (or management) may act; a colleague sees why not. */
  canManage: boolean;
  agentName: string;
  existingRenewal?: { id: ID; number: string };
}

const ContractDemoContextValue = createContext<ContractDemoValue | null>(null);

function useContractDemo(): ContractDemoValue {
  const value = useContext(ContractDemoContextValue);
  if (!value) throw new Error("Contract islands must be rendered inside ContractDemoProvider");
  return value;
}

export const STATUS_SECTION_ID = "contract-status";

export function ContractDemoProvider({
  locale,
  contract,
  nowIso,
  rules,
  holderNames,
  canManage,
  agentName,
  existingRenewal,
  children,
}: {
  locale: Locale;
  contract: Contract;
  nowIso: string;
  rules: ContractContext;
  holderNames: Record<ID, string>;
  canManage: boolean;
  agentName: string;
  existingRenewal?: { id: ID; number: string };
  children: ReactNode;
}) {
  // The context never changes on the page: the reducer closes over it once.
  const [context] = useState<ContractDemoContext>(() => ({ nowIso, rules }));
  const [state, dispatch] = useReducer(
    (current: ContractDemoState, action: ContractDemoAction) => reduceContractDemo(current, action, context),
    contract,
    initialContractDemoState,
  );
  const [mode, setMode] = useState<Mode>("idle");
  const [now] = useState(() => new Date(nowIso));
  const value: ContractDemoValue = {
    locale,
    now,
    state,
    dispatch,
    mode,
    setMode,
    rules,
    holderNames,
    canManage,
    agentName,
    existingRenewal,
  };
  return <ContractDemoContextValue.Provider value={value}>{children}</ContractDemoContextValue.Provider>;
}

/** Actions the viewer can start now: by status, minus a renewal that already exists. */
function useActions(): ContractAction[] {
  const { state, now, canManage, existingRenewal } = useContractDemo();
  if (!canManage) return [];
  return availableActions(state.contract, now).filter(
    (action) => action !== "renew" || (!existingRenewal && !state.renewal),
  );
}

function partyLabel(locale: Locale, contract: Contract, side: SignatureSide): string {
  const t = contracts[locale].signatures.party;
  if (side === "agent") return t.agent;
  return contract.kind === "cooperation" ? t.partner : t.customer;
}

function noticeText(locale: Locale, contract: Contract, notice: ContractDemoNotice): string {
  const t = contracts[locale].done;
  switch (notice.kind) {
    case "renewed":
      return format(t.renewed, { from: formatDate(locale, notice.startsAt), to: formatDate(locale, notice.endsAt) });
    case "terminated":
      return format(t.terminated, { reason: notice.reason });
    case "sent":
      return notice.parties.length === 0
        ? t.sentNobody
        : format(t.sent, {
            parties: formatList(
              locale,
              notice.parties.map((side) => partyLabel(locale, contract, side)),
            ),
          });
  }
}

function IssueList({
  locale,
  issues,
  names,
  kind,
}: {
  locale: Locale;
  issues: readonly ContractIssue[];
  names: Record<ID, string>;
  kind: Contract["kind"];
}) {
  return (
    <ul className="space-y-1.5">
      {issues.map((issue, index) => {
        const Icon = issue.severity === "error" ? OctagonAlert : TriangleAlert;
        return (
          <li
            key={`${issue.code}-${index}`}
            className={cn(
              "flex items-start gap-2 text-small",
              issue.severity === "error" ? "text-danger-fg" : "text-warning-fg",
            )}
          >
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{issueText(locale, issue, names, kind)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What the domain rules say about the contract as it stands locally: an
 * active one lists its issues; a draft or one awaiting signature gets the
 * `canActivate` result with every unmet condition; a closed one cannot
 * become active.
 */
function ContractCheck({ contract }: { contract: Contract }) {
  const { locale, now, rules, holderNames } = useContractDemo();
  const t = contracts[locale].check;
  const status = contractDisplayStatus(contract, now);

  if (status === "expired" || status === "terminated") {
    return <p className="text-small text-fg-muted">{t.closed}</p>;
  }
  if (status === "active" || status === "expiring") {
    const issues = contractIssues(contract, rules);
    return issues.length === 0 ? (
      <p className="flex items-start gap-2 text-small text-success-fg">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t.activeOk}
      </p>
    ) : (
      <div className="space-y-2">
        <p className="text-small font-semibold text-fg">{t.activeIssues}</p>
        <IssueList locale={locale} issues={issues} names={holderNames} kind={contract.kind} />
      </div>
    );
  }
  const check = canActivate(contract, now, rules);
  return (
    <div className="space-y-2">
      {check.ok ? (
        <p className="flex items-start gap-2 text-small text-success-fg">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.canActivate}
        </p>
      ) : (
        <>
          <p className="text-small font-semibold text-fg">{t.cannotActivate}</p>
          <IssueList locale={locale} issues={check.issues} names={holderNames} kind={contract.kind} />
        </>
      )}
      {check.warnings.length > 0 ? (
        <>
          <p className="text-small font-semibold text-fg">{t.warnings}</p>
          <IssueList locale={locale} issues={check.warnings} names={holderNames} kind={contract.kind} />
        </>
      ) : null}
    </div>
  );
}

export function ContractStatusPanel() {
  const { locale, now, state, dispatch, mode, setMode, canManage, agentName, existingRenewal, holderNames } =
    useContractDemo();
  const t = contracts[locale];
  const { contract, notice, blocked, renewal } = state;
  const status = contractDisplayStatus(contract, now);
  const days = daysText(locale, status, daysUntilEnd(contract, now));
  const actions = useActions();
  const resultRef = useRef<HTMLDivElement>(null);
  const showRenewalExists =
    canManage && existingRenewal !== undefined && availableActions(contract, now).includes("renew");

  // Each finished action moves focus to its result, so it is announced and visible.
  useEffect(() => {
    if (notice || blocked) resultRef.current?.focus();
  }, [notice, blocked]);

  return (
    <DealSection id={STATUS_SECTION_ID} title={t.detail.sections.status} icon={Flag}>
      <div className="flex flex-wrap items-center gap-2">
        <ContractStatusBadge locale={locale} status={status} daysLeft={daysUntilEnd(contract, now)} />
        {days && status !== "expiring" ? <span className="text-small text-fg-muted">{days}</span> : null}
      </div>
      {contract.status === "terminated" && contract.terminatedAt ? (
        <p className="text-small text-fg">
          {format(t.service.terminated, { date: formatDate(locale, contract.terminatedAt) })}
          {contract.terminationReason ? (
            <span className="block text-fg-muted">
              {t.service.terminationReason}: {contract.terminationReason}
            </span>
          ) : null}
        </p>
      ) : null}

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="space-y-2 outline-none">
        {notice ? (
          <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
            <p className="flex items-start gap-2 font-semibold">
              <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{noticeText(locale, contract, notice)}</span>
            </p>
            {notice.kind === "sent" ? <p>{t.signatures.buttonNote}</p> : null}
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
        {blocked ? (
          <div className="space-y-2 rounded-md border border-danger-border bg-danger-bg p-3">
            <p className="flex items-start gap-2 text-small font-semibold text-danger-fg">
              <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.actions.sendBlocked}
            </p>
            <IssueList locale={locale} issues={blocked} names={holderNames} kind={contract.kind} />
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-body font-semibold text-fg">{t.check.title}</h3>
        <ContractCheck contract={contract} />
      </div>

      {renewal ? <RenewalCard renewal={renewal} /> : null}

      <div className="space-y-3 border-t border-border pt-3">
        {!canManage ? (
          <Notice kind="permission">{format(t.actions.permission, { agent: agentName })}</Notice>
        ) : (
          <>
            {showRenewalExists && existingRenewal ? (
              <Notice
                kind="info"
                action={
                  <Link
                    href={contractHref(locale, existingRenewal.id)}
                    className="inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-2 hover:underline"
                  >
                    {format(t.actions.openRenewal, { number: existingRenewal.number })}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                }
              >
                {format(t.actions.renewalExists, { number: existingRenewal.number })}
              </Notice>
            ) : null}
            {actions.length === 0 && !showRenewalExists && !renewal ? (
              <p className="text-small text-fg-muted">{t.actions.none}</p>
            ) : null}
            {mode === "idle" && actions.length > 0 ? (
              <div className="hidden flex-wrap gap-2 lg:flex">
                <ActionButtons />
              </div>
            ) : null}
            {mode === "terminate" ? <TerminateForm /> : null}
          </>
        )}
      </div>
    </DealSection>
  );
}

function RenewalCard({ renewal }: { renewal: Contract }) {
  const { locale } = useContractDemo();
  const t = contracts[locale].actions;
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-small font-semibold text-fg">
        <CopyPlus aria-hidden className="size-4 shrink-0" />
        {t.renewTitle}
      </p>
      <p className="text-small text-fg-muted">{t.renewNumber}</p>
      <p className="text-small text-fg">
        {format(t.renewPeriod, { from: formatDate(locale, renewal.startsAt), to: formatDate(locale, renewal.endsAt) })}
      </p>
      <p className="text-caption text-fg-muted">{t.renewNote}</p>
      <ContractCheck contract={renewal} />
    </div>
  );
}

const barPrimary = "bg-primary text-primary-fg hover:bg-primary-hover";
const barSecondary = "border border-border bg-surface text-fg hover:bg-surface-muted";

/**
 * The actions the status allows. Full buttons in the status section on
 * desktop; in the phone bar, icon over a short label so they fit one row.
 */
function ActionButtons({ compact = false, onPick }: { compact?: boolean; onPick?: () => void }) {
  const { locale, state, dispatch, setMode } = useContractDemo();
  const t = contracts[locale].actions;
  const available = useActions();
  const run = (action: ContractAction) => {
    if (action === "terminate") setMode("terminate");
    else dispatch({ type: action });
    onPick?.();
  };
  const sendLabel = state.contract.status === "awaiting_signature" ? t.resend : t.send;
  const actions: { key: ContractAction; icon: typeof Send; label: string; short: string; primary: boolean }[] = [
    { key: "send", icon: Send, label: sendLabel, short: t.sendShort, primary: true },
    { key: "renew", icon: CopyPlus, label: t.renew, short: t.renew, primary: true },
    { key: "terminate", icon: FileX, label: t.terminate, short: t.terminate, primary: false },
  ];
  return (
    <>
      {actions
        .filter((action) => available.includes(action.key))
        .map(({ key, icon: Icon, label, short, primary }) =>
          compact ? (
            <button
              key={key}
              type="button"
              aria-label={label}
              className={cn(stickyActionClasses, primary ? barPrimary : barSecondary)}
              onClick={() => run(key)}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              {short}
            </button>
          ) : (
            <Button key={key} variant={primary ? "primary" : "secondary"} onClick={() => run(key)}>
              <Icon aria-hidden className="size-4 shrink-0" />
              {label}
            </Button>
          ),
        )}
    </>
  );
}

/** Termination is final and needs a reason in words; the reason stays with the contract. */
function TerminateForm() {
  const { locale, state, dispatch, setMode } = useContractDemo();
  const t = contracts[locale].actions;
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 3) {
          setError(true);
          fieldRef.current?.focus();
          return;
        }
        setError(false);
        dispatch({ type: "terminate", reason });
        setMode("idle");
      }}
    >
      <p id={`${id}-title`} className="text-small font-semibold text-fg">
        {format(t.terminateTitle, { number: state.contract.number })}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`}>{t.terminateReason}</Label>
        <textarea
          ref={fieldRef}
          id={`${id}-reason`}
          className={textareaClasses}
          rows={3}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(`${id}-hint`, error && `${id}-error`)}
        />
        <Hint id={`${id}-hint`}>{t.terminateHint}</Hint>
        {error ? <InlineError id={`${id}-error`}>{t.terminateMissing}</InlineError> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger">
          <FileX aria-hidden className="size-4" />
          {t.terminateConfirm}
        </Button>
        <Button variant="ghost" onClick={() => setMode("idle")}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Sticky contract actions on phones (§14.3, §22.6). The outcome appears in
 * the status section, which scrolls into view. Hidden when there is nothing
 * the viewer can do.
 */
export function ContractActionBar() {
  const { locale, mode } = useContractDemo();
  const actions = useActions();
  if (actions.length === 0 || mode !== "idle") return null;
  return (
    <div
      role="group"
      aria-label={contracts[locale].actions.bar}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <ActionButtons
          compact
          onPick={() => document.getElementById(STATUS_SECTION_ID)?.scrollIntoView({ block: "start" })}
        />
      </div>
    </div>
  );
}

/** Keeps the last section clear of the fixed bar on phones, only while the bar is shown. */
export function ContractBarSpacer() {
  const actions = useActions();
  return actions.length > 0 ? <div aria-hidden className="h-20 lg:hidden" /> : null;
}
