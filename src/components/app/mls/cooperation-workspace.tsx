"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  CalendarPlus,
  CheckCheck,
  CircleCheck,
  CircleX,
  Lock,
  LockOpen,
  MessageSquareText,
  PenLine,
  Phone,
  RotateCcw,
  Scale,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import { intlLocale, type Locale } from "@/i18n/config";
import { now } from "@/lib/clock";
import {
  acceptTerms,
  acceptedTerms,
  awaitingResponseFrom,
  cancelRequest,
  declineRequest,
  latestVersion,
  proposeTerms,
  type CooperationError,
  type CooperationResult,
  type TermsIssue,
} from "@/lib/domain/commission";
import type { CooperationRequest, CooperationStatus, ID } from "@/lib/domain/types";
import { DemoNote } from "../radar/card-actions";
import type { CooperationMessages, TermsLabels } from "./cooperation-labels";
import {
  changedFields,
  deadlineState,
  draftFromTerms,
  draftReady,
  isOpen,
  sideOf,
  type TermsDraft,
} from "./cooperation-model";
import { CooperationStatusBadge } from "./cooperation-status";
import { ExampleSplit } from "./example-split";
import { TermsEditor, type TermsEditorLabels } from "./terms-editor";
import { TermsSummary } from "./terms-summary";

type Mode = "accept" | "decline" | "counter" | "cancel" | "dispute" | null;

type Message = { kind: "ok"; text: string } | { kind: "error"; error: CooperationError; issues?: TermsIssue[] };

export interface WorkspaceLabels {
  c: CooperationMessages;
  terms: TermsLabels;
  editor: TermsEditorLabels;
  status: Record<CooperationStatus, string>;
}

/**
 * The negotiation itself (§15.3, §35.6, §36.3 "Cooperation Workspace"):
 * current terms with both roles, the full version history with what each
 * version changed, and accept / decline / counter-propose / withdraw /
 * dispute. Every change goes through `proposeTerms`, `acceptTerms`,
 * `declineRequest` or `cancelRequest` and lives in local demo state — the
 * screen says so and never pretends a partner was notified.
 */
export function CooperationWorkspace({
  locale,
  viewerId,
  initial,
  names,
  labels,
  versionTimes,
  deadlineText,
  respondByText,
  scheduleHref,
  counterpartPhone,
}: {
  locale: Locale;
  viewerId: ID;
  initial: CooperationRequest;
  /** Agent id → "Name · Agency". */
  names: Record<ID, string>;
  labels: WorkspaceLabels;
  /** Version number → formatted time, rendered on the server so hydration matches. */
  versionTimes: Record<number, string>;
  /** "Ответ до … · через 9 часов", pre-formatted; undefined when no deadline runs. */
  deadlineText?: string;
  /** The respond-by instant, pre-formatted for the overdue notice. */
  respondByText: string;
  scheduleHref: string;
  /** Present only when contacts were already shared on the server. */
  counterpartPhone?: { text: string; href: string };
}) {
  const { c, status: statusLabel } = labels;
  const [request, setRequest] = useState<CooperationRequest>(initial);
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState<TermsDraft | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [localTimes, setLocalTimes] = useState<Record<number, string>>({});
  const actionsRef = useRef<HTMLElement>(null);
  const actionsHeadingRef = useRef<HTMLHeadingElement>(null);

  const latest = latestVersion(request);
  const accepted = acceptedTerms(request);
  const current = accepted ?? latest;
  const open = isOpen(request.status);
  const awaiting = awaitingResponseFrom(request) === viewerId;
  const overdue = open && deadlineState(request, now()).kind === "overdue";
  const viewerSide = sideOf(request, viewerId);
  const changed = request !== initial;
  const times = { ...versionTimes, ...localTimes };
  const list = (items: string[]) => new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(items);

  function start(next: Exclude<Mode, null>) {
    setMode(next);
    setReason("");
    setMessage(null);
    if (next === "counter" && latest) setDraft(draftFromTerms(latest.terms));
    // Bring the opened panel into view and move keyboard focus there, away from the sticky bar.
    requestAnimationFrame(() => {
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      actionsHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function apply(result: CooperationResult, success: (value: CooperationRequest) => string) {
    if (!result.ok) {
      setMessage({ kind: "error", error: result.error, issues: result.issues });
      return;
    }
    const version = result.event.version;
    if (result.event.action === "terms_proposed" && version !== undefined) {
      setLocalTimes((existing) => ({ ...existing, [version]: formatDateTime(locale, result.event.at) }));
    }
    setRequest(result.value);
    setMode(null);
    setMessage({ kind: "ok", text: success(result.value) });
  }

  function reset() {
    setRequest(initial);
    setMode(null);
    setMessage(null);
    setLocalTimes({});
  }

  const at = () => now().toISOString();

  /* ------------------------------------------------------------ actions */

  const barButtons: ReactNode[] = [];
  if (open && !overdue && awaiting && latest) {
    barButtons.push(
      <Button key="accept" className="min-w-0 flex-1 lg:flex-none" onClick={() => start("accept")}>
        <CircleCheck aria-hidden className="size-4 shrink-0" />
        <span className="truncate lg:hidden">{c.actions.acceptShort}</span>
        <span className="hidden lg:inline">{format(c.actions.accept, { n: latest.version })}</span>
      </Button>,
      <Button
        key="counter"
        variant="secondary"
        className="min-w-0 flex-1 lg:flex-none"
        onClick={() => start("counter")}
      >
        <PenLine aria-hidden className="size-4 shrink-0" />
        <span className="truncate lg:hidden">{c.actions.counterShort}</span>
        <span className="hidden lg:inline">{c.actions.counter}</span>
      </Button>,
      <Button key="decline" variant="ghost" className="shrink-0" onClick={() => start("decline")}>
        <CircleX aria-hidden className="size-4 shrink-0" />
        {c.actions.decline}
      </Button>,
    );
  } else if (open && !overdue) {
    barButtons.push(
      <Button
        key="counter"
        variant="secondary"
        className="min-w-0 flex-1 lg:flex-none"
        onClick={() => start("counter")}
      >
        <PenLine aria-hidden className="size-4 shrink-0" />
        {c.actions.newVersion}
      </Button>,
      <Button key="cancel" variant="ghost" className="shrink-0" onClick={() => start("cancel")}>
        <Undo2 aria-hidden className="size-4 shrink-0" />
        {c.actions.cancel}
      </Button>,
    );
  } else if (open && overdue) {
    barButtons.push(
      <Button key="cancel" variant="secondary" className="flex-1 lg:flex-none" onClick={() => start("cancel")}>
        <Undo2 aria-hidden className="size-4 shrink-0" />
        {c.actions.cancel}
      </Button>,
    );
  } else if (request.status === "accepted") {
    barButtons.push(
      <Link
        key="schedule"
        href={scheduleHref}
        className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-small font-semibold text-primary-fg shadow-card hover:bg-primary-hover lg:flex-none"
      >
        <CalendarPlus aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{c.actions.schedule}</span>
      </Link>,
      <Button key="dispute" variant="ghost" className="shrink-0" onClick={() => start("dispute")}>
        <Scale aria-hidden className="size-4 shrink-0" />
        {c.dispute.open}
      </Button>,
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      {/* Status */}
      <section aria-labelledby="coop-status" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="coop-status" className="sr-only">
            {c.list.statusLabel}
          </h2>
          <CooperationStatusBadge status={request.status} label={statusLabel[request.status]} />
          {open && deadlineText && !overdue ? <span className="text-small text-fg-muted">{deadlineText}</span> : null}
        </div>
        {open && !overdue ? (
          <p className="text-small text-fg">{awaiting ? c.actions.waitingYou : c.actions.waitingPartner}</p>
        ) : null}
        {overdue ? <Notice kind="warning">{format(c.actions.overdue, { date: respondByText })}</Notice> : null}
        {request.status === "accepted" ? (
          <Notice kind="info" title={c.actions.lockedTitle}>
            <p>{c.actions.lockedText}</p>
            <p className="pt-1">{c.actions.legal}</p>
          </Notice>
        ) : null}
        {!open && request.status !== "accepted" && request.status !== "draft" ? (
          <Notice kind="permission">{format(c.actions.closed, { status: statusLabel[request.status] })}</Notice>
        ) : null}
      </section>

      {barButtons.length > 0 ? (
        <div
          role="group"
          aria-label={c.actions.label}
          data-sticky-actions
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 py-2 px-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <div className="mx-auto flex max-w-3xl gap-2 lg:mx-0">{barButtons}</div>
        </div>
      ) : null}

      {/* Current terms */}
      {current ? (
        <section aria-labelledby="coop-current" className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="coop-current" className="text-h2 text-fg">
              {accepted ? c.detail.accepted : c.detail.current}
            </h2>
            <span className="text-caption text-fg-muted">
              {format(c.detail.versionTitle, { n: current.version })} ·{" "}
              {format(c.detail.proposedBy, {
                agent: names[current.proposedById] ?? "",
                date: times[current.version] ?? "",
              })}
            </span>
          </div>
          <TermsSummary
            locale={locale}
            terms={current.terms}
            labels={labels.terms}
            viewerSide={viewerSide}
            changed={changedFields(request, request.versions.indexOf(current))}
          />
          {current.note ? (
            <p className="flex items-start gap-2 text-small text-fg">
              <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              <span>
                <span className="text-fg-muted">{c.terms.note}: </span>
                {current.note}
              </span>
            </p>
          ) : null}
          <ExampleSplit locale={locale} terms={current.terms} labels={c.example} termsLabels={labels.terms} />
        </section>
      ) : null}

      {/* Actions */}
      <section ref={actionsRef} aria-labelledby="coop-actions" className="scroll-mt-20 space-y-3">
        <h2 id="coop-actions" ref={actionsHeadingRef} tabIndex={-1} className="text-h2 text-fg outline-none">
          {c.actions.label}
        </h2>

        {message ? (
          message.kind === "ok" ? (
            <div className="space-y-1 rounded-md border border-border bg-surface-muted p-3">
              <p role="status" className="flex items-start gap-2 text-small text-fg">
                <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                {message.text}
              </p>
              <DemoNote text={c.actions.demo} />
            </div>
          ) : (
            <Notice kind="danger">
              <p>{c.error[message.error]}</p>
              {message.issues?.length ? (
                <ul className="list-disc pl-4">
                  {message.issues.map((issue) => (
                    <li key={`${issue.code}-${issue.field}`}>{c.issue[issue.code]}</li>
                  ))}
                </ul>
              ) : null}
            </Notice>
          )
        ) : null}

        {mode === "accept" && latest ? (
          <Panel title={format(c.actions.accept, { n: latest.version })}>
            <p className="text-small text-fg">{format(c.actions.acceptConfirm, { n: latest.version })}</p>
            <p className="text-caption text-fg-muted">{c.actions.legal}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  apply(acceptTerms(request, latest.version, viewerId, at()), (value) =>
                    format(c.result.accepted, { n: value.acceptedVersion ?? latest.version }),
                  )
                }
              >
                <CircleCheck aria-hidden className="size-4" />
                {format(c.actions.accept, { n: latest.version })}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>
                {c.actions.back}
              </Button>
            </div>
          </Panel>
        ) : null}

        {mode === "decline" || mode === "cancel" ? (
          <Panel title={mode === "decline" ? c.actions.declineTitle : c.actions.cancelTitle}>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (mode === "decline") {
                  apply(declineRequest(request, viewerId, at(), reason), () => c.result.declined);
                } else {
                  apply(cancelRequest(request, viewerId, at(), reason), () => c.result.cancelled);
                }
              }}
            >
              <div className="space-y-1">
                <label htmlFor="coop-reason" className="block text-caption font-medium text-fg-muted">
                  {mode === "decline" ? c.actions.declineReason : c.actions.cancelReason}
                </label>
                <textarea
                  id="coop-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface p-3 text-small text-fg focus-visible:border-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="danger">
                  {mode === "decline" ? c.actions.declineConfirm : c.actions.cancelConfirm}
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>
                  {c.actions.back}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}

        {mode === "counter" && draft && latest ? (
          <Panel title={c.actions.counterTitle}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                apply(proposeTerms(request, draft.terms, viewerId, at(), draft.note), (value) =>
                  format(c.result.proposed, { n: latestVersion(value)?.version ?? latest.version + 1 }),
                );
              }}
            >
              <TermsEditor
                locale={locale}
                labels={labels.editor}
                draft={draft}
                onChange={setDraft}
                viewerSide={viewerSide}
                idPrefix="coop-counter"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="lg" disabled={!draftReady(draft)}>
                  {format(c.actions.counterSubmit, { n: latest.version + 1 })}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setMode(null)}>
                  {c.actions.back}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}

        {mode === "dispute" ? (
          <Panel title={c.dispute.title}>
            <Notice kind="info">{c.dispute.text}</Notice>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setMode(null);
                setMessage({ kind: "ok", text: c.dispute.done });
              }}
            >
              <div className="space-y-1">
                <label htmlFor="coop-dispute" className="block text-caption font-medium text-fg-muted">
                  {c.dispute.describe}
                </label>
                <textarea
                  id="coop-dispute"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface p-3 text-small text-fg focus-visible:border-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" disabled={!reason.trim()}>
                  <Scale aria-hidden className="size-4" />
                  {c.dispute.submit}
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>
                  {c.actions.back}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {request.status !== "accepted" && request.status !== "draft" && mode !== "dispute" ? (
            <Button variant="ghost" onClick={() => start("dispute")}>
              <Scale aria-hidden className="size-4" />
              {c.dispute.open}
            </Button>
          ) : null}
          {changed ? (
            <Button variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden className="size-4" />
              {c.actions.reset}
            </Button>
          ) : null}
        </div>
      </section>

      {/* History */}
      <section aria-labelledby="coop-timeline" className="space-y-3">
        <h2 id="coop-timeline" className="text-h2 text-fg">
          {c.detail.timeline}
        </h2>
        <p className="text-caption text-fg-muted">{c.detail.timelineHint}</p>
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {request.versions.map((version, index) => {
            const diff = changedFields(request, index);
            const isLatest = index === request.versions.length - 1;
            return (
              <li key={version.version} className="relative space-y-1">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[1.4rem] size-3 rounded-full border-2 border-surface bg-border-strong"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-small font-semibold text-fg">
                    {format(c.detail.versionTitle, { n: version.version })}
                  </h3>
                  {request.acceptedVersion === version.version ? (
                    <Badge tone="success" icon={CircleCheck}>
                      {c.detail.acceptedBadge}
                    </Badge>
                  ) : isLatest && open ? (
                    <Badge tone="info">{c.detail.currentBadge}</Badge>
                  ) : null}
                </div>
                <p className="text-caption text-fg-muted">
                  {format(c.detail.proposedBy, {
                    agent: names[version.proposedById] ?? "",
                    date: times[version.version] ?? "",
                  })}
                </p>
                <TermsSummary locale={locale} terms={version.terms} labels={labels.terms} compact />
                <p className="text-caption text-fg-muted">
                  {index === 0
                    ? c.detail.initial
                    : format(c.detail.changed, { list: list(diff.map((field) => c.terms.field[field])) })}
                </p>
                {version.note ? (
                  <p className="text-small text-fg">
                    <span className="text-fg-muted">{c.terms.note}: </span>
                    {version.note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Disclosure */}
      <section aria-labelledby="coop-contacts" className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h2 id="coop-contacts" className="text-body font-semibold text-fg">
          {c.detail.contacts}
        </h2>
        <p className="flex items-start gap-2 text-small text-fg">
          {request.disclosure === "masked" ? (
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          ) : (
            <LockOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          )}
          <span>
            <span className="font-medium">{c.disclosure[request.disclosure]}. </span>
            {request.disclosure === "masked" ? c.disclosure.maskedText : c.disclosure.sharedText}
          </span>
        </p>
        {initial.disclosure === "masked" && request.disclosure === "contacts_shared" ? (
          <p className="text-caption text-fg-muted">{c.contacts.demoAccepted}</p>
        ) : null}
        {counterpartPhone ? (
          <p className="flex items-center gap-2 text-small">
            <Phone aria-hidden className="size-4 text-fg-muted" />
            <a
              href={counterpartPhone.href}
              className="inline-flex min-h-11 items-center tabular text-primary underline-offset-4 hover:underline"
            >
              {counterpartPhone.text}
            </a>
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-surface p-4 shadow-card">
      <h3 className="text-body font-semibold text-fg">{title}</h3>
      {children}
    </div>
  );
}
