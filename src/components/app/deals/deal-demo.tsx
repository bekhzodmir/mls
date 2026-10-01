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
  BadgeCheck,
  Check,
  CheckCheck,
  Circle,
  FileText,
  FileWarning,
  FileX,
  HandCoins,
  History,
  Lock,
  OctagonAlert,
  Timer,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { offerHref } from "@/components/app/offers/offer-list";
import { MoneyText } from "@/components/domain/badges";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import type { ListingAccess } from "@/lib/data/views";
import { formatMoney, subtractMoney } from "@/lib/domain/money";
import { nextDealStage } from "@/lib/domain/lifecycle";
import type { AuditEvent, Deal, DealDocument, DealType, ID, Listing, Offer, OfferStatus, Viewing } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { ErrorSummary, InlineError, inputClasses, Label, textareaClasses } from "@/components/app/viewings/form-parts";
import { stageIcon } from "./deal-badges";
import { DealSection } from "./deal-section";
import {
  initialDealDemoState,
  reduceDealDemo,
  type DealDemoAction,
  type DealDemoContext,
  type DealDemoNotice,
  type DealDemoState,
} from "./demo-state";
import {
  answeringSide,
  isNegotiable,
  latestOfferVersion,
  parseAmount,
  representsSide,
  versionExpired,
  type OfferSide,
} from "./offers";
import { stageSteps } from "./pipeline";
import {
  auditActionText,
  auditReasonText,
  auditTargetText,
  describePrerequisite,
  prerequisiteSection,
  sectionId,
  stageLabel,
} from "./rules-text";

/**
 * Interactive islands of the Deal Workspace (§22.12, §36.3): the stage
 * stepper with "go to the next stage", price negotiation, documents, the
 * audit log and the sticky action bar. They share one local demo state
 * (`demo-state.ts`): the real stage rules run against it, and every change
 * is labelled as not saved. Server-rendered sections sit between them as
 * children of the provider.
 */

interface DealWorkspaceValue {
  locale: Locale;
  now: Date;
  state: DealDemoState;
  dispatch: (action: DealDemoAction) => void;
  access: ListingAccess;
  dealType: DealType;
  askingPrice: Listing["price"];
  listingAgentName: string;
  /** Names for audit actors and checklist authors; unknown ids stay unnamed. */
  agentNames: Record<ID, string>;
}

const DealWorkspaceContext = createContext<DealWorkspaceValue | null>(null);

function useDealWorkspace(): DealWorkspaceValue {
  const value = useContext(DealWorkspaceContext);
  if (!value) throw new Error("Deal islands must be rendered inside DealDemoProvider");
  return value;
}

export function DealDemoProvider({
  locale,
  deal,
  offers,
  viewerId,
  nowIso,
  viewings,
  listing,
  access,
  listingAgentName,
  agentNames,
  children,
}: {
  locale: Locale;
  deal: Deal;
  offers: Offer[];
  viewerId: ID;
  nowIso: string;
  viewings: Viewing[];
  listing: Listing;
  access: ListingAccess;
  listingAgentName: string;
  agentNames: Record<ID, string>;
  children: ReactNode;
}) {
  // The context never changes on the page: the reducer closes over it once.
  const [context] = useState<DealDemoContext>(() => ({ viewerId, nowIso, viewings, listing }));
  const [state, dispatch] = useReducer(
    (current: DealDemoState, action: DealDemoAction) => reduceDealDemo(current, action, context),
    undefined,
    () => initialDealDemoState(deal, offers),
  );
  const [now] = useState(() => new Date(nowIso));
  const value: DealWorkspaceValue = {
    locale,
    now,
    state,
    dispatch,
    access,
    dealType: listing.dealType,
    askingPrice: listing.price,
    listingAgentName,
    agentNames,
  };
  return <DealWorkspaceContext.Provider value={value}>{children}</DealWorkspaceContext.Provider>;
}

const linkClasses =
  "inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-primary underline-offset-2 hover:underline";

function DemoNote({ locale, text }: { locale: Locale; text: string }) {
  return (
    <div className="space-y-1 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
      <p className="flex items-start gap-2 font-semibold">
        <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{text}</span>
      </p>
      <p>{deals[locale].advance.demo}</p>
    </div>
  );
}

function noticeText(locale: Locale, notice: DealDemoNotice): string {
  const t = deals[locale];
  switch (notice.kind) {
    case "advanced":
      return format(t.advance.advanced, { stage: stageLabel(locale, notice.stage) });
    case "accepted":
      return format(t.offers.acceptedDone, { amount: formatMoney(locale, notice.amount) });
    case "countered":
      return format(t.offers.counteredDone, { n: notice.version, amount: formatMoney(locale, notice.amount) });
    case "uploaded":
      return format(t.documents.uploaded, { type: domain[locale].documentType[notice.type] });
  }
}

/* --------------------------------------------------------------- stage */

/**
 * Stepper over every stage with the current one marked `aria-current="step"`,
 * and the "go to the next stage" check: either the stage moves (locally) or
 * each unmet condition is named with a link to where it is fixed (§36.3).
 */
export function DealStagePanel() {
  const { locale, state, dispatch } = useDealWorkspace();
  const t = deals[locale];
  const { deal, lastAttempt, notice } = state;
  const steps = stageSteps(deal.stage);
  const current = steps.find((step) => step.state === "current");
  const next = nextDealStage(deal.stage);
  const resultRef = useRef<HTMLDivElement>(null);

  // Each attempt moves focus to its result, so the outcome is announced and visible.
  useEffect(() => {
    if (lastAttempt) resultRef.current?.focus();
  }, [lastAttempt]);

  const blocked = lastAttempt && !lastAttempt.check.ok && lastAttempt.from === deal.stage ? lastAttempt : undefined;

  return (
    <DealSection
      id={sectionId("stage")}
      title={t.sections.stage}
      hint={current ? format(t.stepper.position, { n: current.position, total: steps.length }) : undefined}
    >
      <ol aria-label={t.stepper.label} className="flex flex-wrap gap-1">
        {steps.map((step) => {
          const Icon = step.state === "done" ? Check : step.state === "current" ? stageIcon[step.stage] : Circle;
          return (
            <li
              key={step.stage}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-caption font-medium",
                step.state === "current" && "border-primary bg-primary text-primary-fg",
                step.state === "done" && "border-success-border bg-success-bg text-success-fg",
                step.state === "upcoming" && "border-border bg-surface text-fg-muted",
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span>{domain[locale].dealStage[step.stage]}</span>
              <span className="sr-only">
                {" — "}
                {t.stepper[step.state]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-caption text-fg-muted">{t.advance.rule}</p>

      <div ref={resultRef} tabIndex={-1} className="space-y-3 outline-none" aria-live="polite">
        {notice?.kind === "advanced" ? <DemoNote locale={locale} text={noticeText(locale, notice)} /> : null}
        {blocked && !blocked.check.ok ? (
          <div className="space-y-2 rounded-md border border-danger-border bg-danger-bg p-3 text-small text-danger-fg">
            <p className="flex items-start gap-2 font-semibold">
              <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {format(t.advance.blockedTitle, { stage: stageLabel(locale, blocked.to) })}
            </p>
            <p>{t.advance.blockedText}</p>
            <ul className="space-y-2">
              {blocked.check.missing.map((prerequisite, index) => {
                const section = prerequisiteSection(prerequisite.code);
                return (
                  <li key={`${prerequisite.code}-${index}`} className="rounded-sm bg-surface/70 p-2 text-fg">
                    <p>{describePrerequisite(locale, prerequisite)}</p>
                    {section !== "stage" ? (
                      <a
                        href={`#${sectionId(section)}`}
                        className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {format(t.advance.goTo, { section: t.sections[section] })}
                        <ArrowRight aria-hidden className="size-4" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {next ? (
        <Button onClick={() => dispatch({ type: "advance" })} className="hidden lg:inline-flex">
          <ArrowRight aria-hidden className="size-4" />
          {format(t.advance.button, { stage: stageLabel(locale, next) })}
        </Button>
      ) : (
        <p className="text-small text-fg-muted">{t.advance.last}</p>
      )}
    </DealSection>
  );
}

/* ---------------------------------------------------------- financials */

const offerStatusStyle: Record<OfferStatus, { tone: Tone; icon: LucideIcon }> = {
  open: { tone: "info", icon: HandCoins },
  countered: { tone: "info", icon: History },
  accepted: { tone: "success", icon: BadgeCheck },
  declined: { tone: "neutral", icon: FileX },
  expired: { tone: "warning", icon: Timer },
  withdrawn: { tone: "neutral", icon: FileX },
};

function sideLabel(locale: Locale, dealType: DealType, side: OfferSide): string {
  const t = deals[locale].offers;
  return dealType === "rent" ? t.byRent[side] : t.by[side];
}

function OfferActions({ offer }: { offer: Offer }) {
  const { locale, now, dispatch, access, dealType, listingAgentName } = useDealWorkspace();
  const t = deals[locale].offers;
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"idle" | "accept" | "counter">("idle");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<"invalid" | "same" | null>(null);
  const latest = latestOfferVersion(offer);
  if (!latest || !isNegotiable(offer)) return null;

  const side = answeringSide(offer);
  const sideName = sideLabel(locale, dealType, side);
  if (!representsSide(side, access)) {
    return (
      <p className="flex items-start gap-2 text-small text-fg-muted">
        <Timer aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {format(t.waiting, { side: sideName })} {format(t.waitingPartner, { agent: listingAgentName })}
        </span>
      </p>
    );
  }
  const expired = versionExpired(latest, now);
  const currency = latest.amount.currency;

  return (
    <div className="space-y-3">
      <p className="text-small text-fg-muted">{format(t.waiting, { side: sideName })}</p>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {expired ? null : (
            <Button onClick={() => setMode("accept")}>
              <BadgeCheck aria-hidden className="size-4" />
              {format(t.accept, { amount: formatMoney(locale, latest.amount) })}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setMode("counter")}>
            <History aria-hidden className="size-4" />
            {t.counter}
          </Button>
        </div>
      ) : null}

      {mode === "accept" ? (
        <div role="group" aria-labelledby={`${id}-accept`} className="space-y-2 rounded-md border border-border bg-surface-muted p-3">
          <p id={`${id}-accept`} className="text-small font-semibold text-fg">
            {format(t.acceptTitle, { side: sideLabel(locale, dealType, latest.by) })}
          </p>
          <p className="text-small text-fg-muted">
            {format(t.acceptText, { by: sideName, amount: formatMoney(locale, latest.amount) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: "accept", offerId: offer.id })}>{t.acceptConfirm}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              {t.acceptCancel}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "counter" ? (
        <form
          noValidate
          className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
          aria-labelledby={`${id}-counter`}
          onSubmit={(event) => {
            event.preventDefault();
            const money = parseAmount(amount, currency);
            if (!money) {
              setError("invalid");
              summaryRef.current?.focus();
              return;
            }
            if (money.amountMinor === latest.amount.amountMinor) {
              setError("same");
              summaryRef.current?.focus();
              return;
            }
            setError(null);
            dispatch({ type: "counter", offerId: offer.id, amount: money, by: side, note });
            setMode("idle");
            setAmount("");
            setNote("");
          }}
        >
          <p id={`${id}-counter`} className="text-small font-semibold text-fg">
            {format(t.counterTitle, { side: sideName })}
          </p>
          <ErrorSummary
            title={t.counter}
            errors={error ? [{ id: `${id}-amount`, text: error === "invalid" ? t.counterInvalid : t.counterSame }] : []}
            summaryRef={summaryRef}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-amount`}>{format(t.counterAmount, { currency })}</Label>
            <input
              id={`${id}-amount`}
              inputMode="decimal"
              autoComplete="off"
              className={inputClasses}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-amount-error` : undefined}
            />
            {error ? (
              <InlineError id={`${id}-amount-error`}>{error === "invalid" ? t.counterInvalid : t.counterSame}</InlineError>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`} note={t.counterNoteOptional}>
              {t.counterNote}
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
            <Button type="submit">{t.counterSubmit}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              {t.acceptCancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Asking vs agreed price and the negotiation timeline (§22.11): every
 * version with its side, amount, time, expiry and note, oldest first.
 * History is only appended to; acceptance is an explicit confirm step.
 */
export function DealFinancials() {
  const { locale, now, state, dealType, askingPrice } = useDealWorkspace();
  const t = deals[locale];
  const d = domain[locale];
  const agreed = state.deal.agreedPrice;
  const difference =
    agreed && agreed.currency === askingPrice.currency ? subtractMoney(askingPrice, agreed) : undefined;
  const notice = state.notice?.kind === "accepted" || state.notice?.kind === "countered" ? state.notice : undefined;

  return (
    <DealSection id={sectionId("financials")} title={t.sections.financials} icon={HandCoins}>
      <dl className="divide-y divide-border">
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-small text-fg-muted">{t.financials.asking}</dt>
          <dd className="text-right text-small font-semibold text-fg">
            <MoneyText locale={locale} value={askingPrice} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-small text-fg-muted">{t.financials.agreed}</dt>
          <dd className="text-right text-small font-semibold text-fg">
            {agreed ? (
              <>
                <MoneyText locale={locale} value={agreed} />
                {difference && difference.amountMinor !== 0 ? (
                  <span className="block text-caption font-normal text-fg-muted">
                    {format(difference.amountMinor > 0 ? t.financials.discount : t.financials.premium, {
                      amount: formatMoney(locale, { ...difference, amountMinor: Math.abs(difference.amountMinor) }),
                    })}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="font-normal italic text-fg-muted">{t.financials.notAgreed}</span>
            )}
          </dd>
        </div>
      </dl>

      <div aria-live="polite">{notice ? <DemoNote locale={locale} text={noticeText(locale, notice)} /> : null}</div>

      <div className="space-y-2">
        <h3 className="text-body font-semibold text-fg">{t.offers.title}</h3>
        <p className="text-caption text-fg-muted">{t.offers.historyNote}</p>
      </div>

      {state.offers.length === 0 ? (
        <p className="text-small text-fg-muted">{t.offers.none}</p>
      ) : (
        <ul className="space-y-4">
          {state.offers.map((offer) => {
            const style = offerStatusStyle[offer.status];
            return (
              <li key={offer.id} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{offer.id}</p>
                  <Badge tone={style.tone} icon={style.icon}>
                    {d.offerStatus[offer.status]}
                  </Badge>
                </div>
                <ol className="space-y-0 border-l-2 border-border pl-4">
                  {offer.versions.map((version, index) => {
                    const isLatest = index === offer.versions.length - 1;
                    const expired = versionExpired(version, now);
                    return (
                      <li key={version.version} className="relative pb-3 last:pb-0">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full border-2 border-surface",
                            isLatest ? "bg-primary" : "bg-border-strong",
                          )}
                        />
                        <p className="flex flex-wrap items-baseline gap-x-2 text-small">
                          <span className="font-semibold text-fg">{sideLabel(locale, dealType, version.by)}</span>
                          <MoneyText locale={locale} value={version.amount} className="font-semibold text-fg" />
                          <span className="text-caption text-fg-muted">{format(t.offers.version, { n: version.version })}</span>
                          {isLatest ? <Badge>{t.offers.latest}</Badge> : null}
                        </p>
                        <p className="text-caption text-fg-muted">
                          <time dateTime={version.at}>{formatDateTime(locale, version.at)}</time>
                          {version.expiresAt ? (
                            <>
                              {" · "}
                              {format(expired && isLatest && isNegotiable(offer) ? t.offers.expired : t.offers.expires, {
                                date: formatDateTime(locale, version.expiresAt),
                              })}
                            </>
                          ) : null}
                        </p>
                        {version.note ? <p className="mt-0.5 text-small text-fg">«{version.note}»</p> : null}
                      </li>
                    );
                  })}
                </ol>
                {isNegotiable(offer) ? (
                  <OfferActions offer={offer} />
                ) : (
                  <p className="text-small text-fg-muted">{format(t.offers.decided, { status: d.offerStatus[offer.status] })}</p>
                )}
                <Link
                  href={offerHref(locale, offer.id)}
                  aria-label={format(t.offers.openLabel, { id: offer.id })}
                  className={linkClasses}
                >
                  {t.offers.open}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DealSection>
  );
}

/* ----------------------------------------------------------- documents */

const documentStyle: Record<DealDocument["status"], { tone: Tone; icon: LucideIcon }> = {
  missing: { tone: "warning", icon: FileWarning },
  uploaded: { tone: "info", icon: FileText },
  verified: { tone: "success", icon: BadgeCheck },
  rejected: { tone: "danger", icon: FileX },
};

/** A contract concluded for the deal, as the documents section links it. */
export interface DealContractLink {
  id: ID;
  number: string;
  href: string;
  /** «С покупателем», «Сотрудничество»… — the contract kind in the page language. */
  kindLabel: string;
  /** A client or owner service contract (not a co-broking agreement). */
  service: boolean;
}

/**
 * Documents with status, sensitivity and a demo upload (§16.3, §18.2), and
 * the contracts concluded for the deal; the service contract document links
 * to its contract.
 */
export function DealDocuments({ contracts = [] }: { contracts?: DealContractLink[] }) {
  const { locale, state, dispatch } = useDealWorkspace();
  const t = deals[locale].documents;
  const d = domain[locale];
  const docs = state.deal.documents;
  const missing = docs.filter((doc) => doc.status === "missing" || doc.status === "rejected").length;
  const anyRestricted = docs.some((doc) => doc.sensitivity === "restricted");
  const notice = state.notice?.kind === "uploaded" ? state.notice : undefined;
  const serviceContract = contracts.find((contract) => contract.service);

  return (
    <DealSection
      id={sectionId("documents")}
      title={deals[locale].sections.documents}
      icon={FileText}
      hint={docs.length === 0 ? undefined : missing > 0 ? format(t.missingCount, { n: missing }) : t.complete}
    >
      <div aria-live="polite">{notice ? <DemoNote locale={locale} text={noticeText(locale, notice)} /> : null}</div>
      {docs.length === 0 ? (
        <p className="text-small text-fg-muted">{t.empty}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {docs.map((doc) => {
            const style = documentStyle[doc.status];
            const canUpload = doc.status === "missing" || doc.status === "rejected";
            const type = d.documentType[doc.type];
            return (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-small font-semibold text-fg">{type}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={style.tone} icon={style.icon}>
                      {d.documentStatus[doc.status]}
                    </Badge>
                    {doc.sensitivity === "restricted" ? <Badge icon={Lock}>{t.restricted}</Badge> : null}
                  </div>
                  <p className="text-caption text-fg-muted">
                    {doc.uploadedAt ? format(t.uploadedAt, { date: formatDateTime(locale, doc.uploadedAt) }) : t.notUploaded}
                  </p>
                  {doc.type === "service_contract" && serviceContract ? (
                    <Link href={serviceContract.href} className={linkClasses}>
                      {format(t.openContract, { number: serviceContract.number })}
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  ) : null}
                </div>
                {canUpload ? (
                  <Button
                    variant="secondary"
                    onClick={() => dispatch({ type: "upload", documentId: doc.id })}
                    aria-label={format(t.uploadLabel, { type })}
                  >
                    <Upload aria-hidden className="size-4" />
                    {doc.status === "rejected" ? t.reupload : t.upload}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {anyRestricted ? (
        <Notice kind="permission" title={t.restricted}>
          {t.restrictedText}
        </Notice>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-body font-semibold text-fg">{t.contracts}</h3>
        {contracts.length === 0 ? (
          <p className="text-small text-fg-muted">{t.contractsNone}</p>
        ) : (
          <ul>
            {contracts.map((contract) => (
              <li key={contract.id}>
                <Link
                  href={contract.href}
                  aria-label={format(t.openContract, { number: contract.number })}
                  className={linkClasses}
                >
                  <FileText aria-hidden className="size-4 shrink-0" />
                  <span>
                    {contract.kindLabel} · <span className="tabular">{contract.number}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DealSection>
  );
}

/* --------------------------------------------------------------- audit */

/**
 * Append-only audit trail (§17.6): stored events, then this page's demo
 * events; `journalHref` opens the organization journal filtered to deals.
 */
export function DealAudit({ journalHref }: { journalHref?: string }) {
  const { locale, state, agentNames } = useDealWorkspace();
  const t = deals[locale].audit;
  const entries: (AuditEvent & { demo?: boolean })[] = [
    ...state.deal.audit,
    ...state.events.map((event) => ({ ...event, demo: true })),
  ];
  return (
    <DealSection id="deal-audit" title={deals[locale].sections.audit} icon={History} hint={t.appendOnly}>
      {entries.length === 0 ? (
        <p className="text-small text-fg-muted">{t.empty}</p>
      ) : (
        <ol className="-mx-4 divide-y divide-border">
          {entries.map((event) => (
            <li key={event.id} className="space-y-0.5 px-4 py-2.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-small">
                <span className="font-semibold text-fg">{auditActionText(locale, event.action)}</span>
                {event.demo ? <Badge tone="info">{t.demo}</Badge> : null}
              </p>
              <p className="text-caption text-fg-muted">
                <time dateTime={event.at}>{formatDateTime(locale, event.at)}</time>
                {" · "}
                {agentNames[event.actorId] ?? t.unknownActor}
                {" · "}
                {auditTargetText(locale, event.target)}
              </p>
              {event.reason ? (
                <p className="text-caption text-fg">{format(t.reason, { reason: auditReasonText(locale, event.reason) })}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {journalHref ? (
        <Link href={journalHref} className={linkClasses}>
          {t.journal}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </DealSection>
  );
}

/* ---------------------------------------------------------- action bar */

/**
 * Sticky primary actions on phones (§14.3, §22.6): go to the next stage —
 * the result appears in the stage section, which receives focus — and
 * jumps to documents and offers.
 */
export function DealActionBar() {
  const { locale, state, dispatch } = useDealWorkspace();
  const t = deals[locale];
  const next = nextDealStage(state.deal.stage);
  const label = next ? format(t.advance.button, { stage: stageLabel(locale, next) }) : t.advance.last;
  return (
    <div
      role="group"
      aria-label={t.bar.label}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 py-2 px-4 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <Button
          className="min-w-0 flex-1"
          disabled={!next}
          aria-label={label}
          onClick={() => {
            dispatch({ type: "advance" });
            document.getElementById(sectionId("stage"))?.scrollIntoView({ block: "start" });
          }}
        >
          <ArrowRight aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{next ? `${t.advance.short}: ${stageLabel(locale, next)}` : t.advance.last}</span>
        </Button>
        <a
          href={`#${sectionId("documents")}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg hover:bg-surface-muted"
        >
          <FileText aria-hidden className="size-4" />
          <span className="sr-only">{t.bar.documents}</span>
        </a>
        <a
          href={`#${sectionId("financials")}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg hover:bg-surface-muted"
        >
          <HandCoins aria-hidden className="size-4" />
          <span className="sr-only">{t.bar.offers}</span>
        </a>
      </div>
    </div>
  );
}
