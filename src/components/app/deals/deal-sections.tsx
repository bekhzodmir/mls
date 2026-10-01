import Link from "next/link";
import {
  ArrowRight,
  Building,
  CalendarCheck,
  Circle,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Coins,
  FileCheck2,
  ListTodo,
  OctagonAlert,
  Phone,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { AccessBadge, AttributeChips, ListingStatusBadge } from "@/components/app/inventory/listing-badges";
import { viewingHref } from "@/components/app/viewings/agenda";
import { ViewingStatusBadge } from "@/components/app/viewings/viewing-badges";
import { MoneyText, VerificationBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/i18n/format";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import type { DealDetailView } from "@/lib/data/views";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import type { Agent, ChecklistItem, ID, Organization, VerificationItem } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { summarizeCommission } from "./commission-view";
import { OverdueBadge } from "./deal-badges";
import { DealSection } from "./deal-section";
import { commissionSides, dealParties, type DealSide } from "./parties";
import { isOverdue } from "./pipeline";
import { checklistLabel, sectionId, termsIssueText } from "./rules-text";

/**
 * Server-rendered sections of the Deal Workspace (§22.12): next step,
 * parties, property, checklist, verification, commission, act and MLS
 * reporting. They read the repository view as it is stored; interactive
 * sections live in `deal-demo.tsx`.
 */

/* ---------------------------------------------------------- next action */

export function NextActionSection({ locale, view, now }: { locale: Locale; view: DealDetailView; now: Date }) {
  const t = deals[locale];
  const next = view.deal.nextAction;
  const openTasks = view.tasks.filter((task) => task.state !== "done");
  return (
    <DealSection id="deal-next" title={t.sections.nextAction} icon={ListTodo}>
      {next ? (
        <div
          className={cn(
            "space-y-1 rounded-md border p-3",
            view.nextActionOverdue ? "border-danger-border bg-danger-bg" : "border-border bg-surface-muted",
          )}
        >
          <p className="text-body font-semibold text-fg">{next.text}</p>
          {next.dueAt ? (
            <p className="flex flex-wrap items-center gap-2 text-small text-fg-muted">
              <Timer aria-hidden className="size-4 shrink-0" />
              {format(view.nextActionOverdue ? t.nextAction.overdue : t.nextAction.due, {
                date: formatDateTime(locale, next.dueAt),
              })}
              {view.nextActionOverdue ? <OverdueBadge locale={locale} /> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <Notice kind="warning">{t.nextAction.none}</Notice>
      )}

      <div className="space-y-2">
        <h3 className="text-small font-semibold text-fg">{t.sections.tasks}</h3>
        {openTasks.length === 0 ? (
          <p className="text-small text-fg-muted">{t.nextAction.noTasks}</p>
        ) : (
          <ul className="space-y-1.5">
            {openTasks.map(({ task }) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2 text-small text-fg">
                <ListTodo aria-hidden className="size-4 shrink-0 text-fg-muted" />
                <span>{format(t.nextAction.task, { title: task.title, date: formatDateTime(locale, task.dueAt) })}</span>
                {isOverdue(task.dueAt, now) ? <OverdueBadge locale={locale} /> : null}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={appPath(locale, "/tasks")}
          className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
        >
          {t.nextAction.openTasks}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </DealSection>
  );
}

/* -------------------------------------------------------------- parties */

function PartyRow({
  locale,
  name,
  role,
  you,
  phone,
  detail,
  href,
  linkLabel,
}: {
  locale: Locale;
  name: string;
  role: string;
  you?: boolean;
  phone?: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
}) {
  const t = deals[locale].parties;
  return (
    <li className="flex items-start gap-3 py-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{role}</p>
        <p className="text-small font-semibold text-fg">
          {name}
          {you ? <Badge className="ml-2 align-middle">{t.you}</Badge> : null}
        </p>
        {detail ? <p className="text-caption text-fg-muted">{detail}</p> : null}
        {href && linkLabel ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
          >
            {linkLabel}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
      {phone && !you ? (
        <a
          href={telHref(phone)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-fg hover:bg-surface-muted"
          aria-label={format(t.call, { name })}
          title={formatUzPhone(phone)}
        >
          <Phone aria-hidden className="size-4" />
        </a>
      ) : null}
    </li>
  );
}

/**
 * Every party with an explicit role (§22.12, §35.6): the client, each
 * professional's side, and the owner — whose contacts stay in the property
 * card for those with the right to see them (§18.2).
 */
export function PartiesSection({
  locale,
  view,
  viewerId,
  organizations,
}: {
  locale: Locale;
  view: DealDetailView;
  viewerId: ID;
  organizations: Record<ID, Organization>;
}) {
  const t = deals[locale].parties;
  const orgLine = (agent: Agent) => {
    const org = agent.organizationId ? organizations[agent.organizationId] : undefined;
    return org ? format(t.organization, { name: org.name }) : agent.organizationId ? undefined : t.noOrganization;
  };
  const sideLabel: Record<DealSide, string> = t.sides;
  const ownerKnown = view.listing.ownerData;
  return (
    <DealSection id="deal-parties" title={deals[locale].sections.parties} icon={Users}>
      <ul className="-my-3 divide-y divide-border">
        <PartyRow
          locale={locale}
          name={view.client.name}
          role={t.client[view.listing.listing.dealType]}
          phone={view.client.phones[0]}
          href={appPath(locale, `/clients/${encodeURIComponent(view.client.id)}`)}
          linkLabel={t.openClient}
        />
        {dealParties(view, viewerId).map((party) => (
          <PartyRow
            key={party.agent.id}
            locale={locale}
            name={party.agent.name}
            role={sideLabel[party.side]}
            you={party.isViewer}
            phone={party.agent.phone}
            detail={orgLine(party.agent)}
          />
        ))}
        {view.owner ? (
          <PartyRow
            locale={locale}
            name={view.owner.name}
            role={t.owner}
            phone={view.owner.phone}
            detail={t.ownerRestricted}
          />
        ) : (
          <li className="py-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.owner}</p>
            <p className="mt-1 text-small text-fg-muted">
              {ownerKnown ? t.ownerNotLinked : format(t.ownerPartner, { agent: view.listing.agent.name })}
            </p>
          </li>
        )}
      </ul>
    </DealSection>
  );
}

/* ------------------------------------------------------------- property */

export function PropertySection({ locale, view }: { locale: Locale; view: DealDetailView }) {
  const t = deals[locale];
  const { listing, property } = view.listing;
  return (
    <DealSection id={sectionId("property")} title={t.sections.property} icon={Building}>
      <div className="space-y-2">
        <p className="text-body font-semibold text-fg">{propertyTitle(locale, property)}</p>
        <p className="text-small text-fg-muted">{locationLine(locale, property)}</p>
        <AttributeChips locale={locale} facts={property} />
        <div className="flex flex-wrap gap-1.5">
          <ListingStatusBadge locale={locale} status={listing.status} />
          <AccessBadge locale={locale} access={view.listing.access} />
        </div>
        {view.listing.otherListingsOnProperty > 0 ? (
          <p className="text-caption text-fg-muted">
            {format(t.property.otherListings, { n: view.listing.otherListingsOnProperty })}
          </p>
        ) : null}
      </div>
      <Link
        href={appPath(locale, `/properties/${encodeURIComponent(listing.id)}`)}
        className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
      >
        {t.property.open}
        <ArrowRight aria-hidden className="size-4" />
      </Link>

      {view.viewings.length > 0 ? (
        <ul className="-mx-4 divide-y divide-border border-t border-border">
          {view.viewings.map((item) => (
            <li key={item.viewing.id}>
              <Link
                href={viewingHref(locale, item.viewing.id)}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-muted/60"
              >
                <span className="flex items-center gap-2 text-small text-fg">
                  <CalendarCheck aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  {formatDateTime(locale, item.viewing.startsAt)}
                </span>
                <ViewingStatusBadge locale={locale} status={item.viewing.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </DealSection>
  );
}

/* ------------------------------------------------------------ checklist */

export function ChecklistSection({
  locale,
  items,
  agentNames,
  serviceContract,
}: {
  locale: Locale;
  items: readonly ChecklistItem[];
  agentNames: Record<ID, string>;
  /** The deal's service contract, linked from the "contract signed" item. */
  serviceContract?: { number: string; href: string };
}) {
  const t = deals[locale].checklist;
  const required = items.filter((item) => item.required);
  const done = required.filter((item) => item.doneAt).length;
  return (
    <DealSection
      id={sectionId("checklist")}
      title={deals[locale].sections.checklist}
      icon={ClipboardList}
      hint={items.length > 0 ? format(t.progress, { done, total: required.length }) : undefined}
    >
      {items.length === 0 ? (
        <p className="text-small text-fg-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.doneAt ? CircleCheck : item.required ? Circle : CircleDashed;
            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <Icon
                  aria-hidden
                  className={cn("mt-0.5 size-5 shrink-0", item.doneAt ? "text-success-fg" : "text-fg-subtle")}
                />
                <div className="min-w-0 space-y-0.5">
                  <p className={cn("text-small", item.doneAt ? "text-fg" : "font-medium text-fg")}>
                    {checklistLabel(locale, item.labelKey)}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
                    <Badge tone={item.required ? "brand" : "neutral"}>{item.required ? t.required : t.optional}</Badge>
                    {item.doneAt ? (
                      format(t.done, {
                        date: formatDate(locale, item.doneAt),
                        who: (item.doneById && agentNames[item.doneById]) || deals[locale].audit.unknownActor,
                      })
                    ) : (
                      <span className="font-medium text-warning-fg">{t.open}</span>
                    )}
                  </p>
                  {item.labelKey === "checklist.service_contract" && serviceContract ? (
                    <Link
                      href={serviceContract.href}
                      className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {format(t.openContract, { number: serviceContract.number })}
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DealSection>
  );
}

/* --------------------------------------------------------- verification */

/**
 * One fact per badge, with method and date (§16.4, §38.2); unavailable ≠ verified.
 * The source and note only with `detailed` (sensitive owner data, §19).
 */
export function VerificationSection({
  locale,
  items,
  detailed,
}: {
  locale: Locale;
  items: readonly VerificationItem[];
  detailed: boolean;
}) {
  const t = deals[locale].verification;
  const d = domain[locale];
  return (
    <DealSection id={sectionId("verification")} title={deals[locale].sections.verification} icon={ShieldCheck}>
      {items.length === 0 ? (
        <p className="text-small text-fg-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="space-y-1">
              <VerificationBadge locale={locale} item={item} showSource={detailed} />
              <p className="text-caption text-fg-muted">
                {format(t.method, { method: d.verificationMethod[item.method] })} ·{" "}
                {detailed ? <>{format(t.source, { source: item.source })} · </> : null}
                {item.checkedAt ? format(t.checkedAt, { date: formatDate(locale, item.checkedAt) }) : t.notChecked}
                {item.expiresAt ? ` · ${format(t.expiresAt, { date: formatDate(locale, item.expiresAt) })}` : ""}
              </p>
              {detailed && item.note ? <p className="text-caption text-fg">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {items.some((item) => item.status === "unavailable") ? <Notice kind="info">{t.unavailableNote}</Notice> : null}
    </DealSection>
  );
}

/* ----------------------------------------------------------- commission */

/**
 * The split between two realtors with named roles, basis, currency, payout
 * condition and exact amounts; accrued and paid are separate lines and
 * accrued never reads as paid (§35.2 row 11, §41 D10).
 */
export function CommissionSection({ locale, view }: { locale: Locale; view: DealDetailView }) {
  const t = deals[locale].commission;
  const d = domain[locale];
  const summary = summarizeCommission(view.deal);
  const sides = commissionSides(view);
  const cooperation = view.cooperation;

  if (!summary) {
    return (
      <DealSection id={sectionId("commission")} title={deals[locale].sections.commission} icon={Coins} hint={t.disclaimer}>
        <p className="text-small text-fg-muted">{view.deal.cooperationId ? t.noneCoop : t.noneSolo}</p>
      </DealSection>
    );
  }

  const { terms, split } = summary;
  const accrualText =
    summary.accrual === "accrued"
      ? format(t.accruedYes, { condition: d.payoutCondition[terms.payoutCondition] })
      : summary.accrual === "not_accrued"
        ? format(t.accruedNo, { condition: d.payoutCondition[terms.payoutCondition] })
        : format(t.accruedUnknown, { note: terms.payoutNote ?? domain[locale].unknown });

  return (
    <DealSection id={sectionId("commission")} title={deals[locale].sections.commission} icon={Coins} hint={t.disclaimer}>
      {summary.issues.length > 0 ? (
        <Notice kind="danger">
          {format(t.invalid, { issues: summary.issues.map((issue) => termsIssueText(locale, issue.code)).join("; ") })}
        </Notice>
      ) : null}
      <dl className="divide-y divide-border">
        <Field label={t.scheme} value={d.splitPreset[terms.preset]} />
        <Field
          label={t.listingSide}
          value={
            <span>
              {sides.listing.name} · {format(t.share, { percent: terms.listingSidePercent })}
              {split ? (
                <>
                  {" · "}
                  <MoneyText locale={locale} value={split.listingSide} />
                </>
              ) : null}
            </span>
          }
        />
        <Field
          label={t.buyerSide}
          value={
            <span>
              {sides.buyer.name} · {format(t.share, { percent: terms.buyerSidePercent })}
              {split ? (
                <>
                  {" · "}
                  <MoneyText locale={locale} value={split.buyerSide} />
                </>
              ) : null}
            </span>
          }
        />
        <Field label={t.basis} value={d.commissionBasis[terms.basis]} />
        <Field
          label={terms.basis === "fixed_amount" ? t.fixed : t.gross}
          value={summary.base ? <MoneyText locale={locale} value={summary.base} /> : <span className="font-normal italic text-fg-muted">{t.grossUnknown}</span>}
        />
        <Field label={t.currency} value={terms.currency} />
        <Field label={t.payout} value={d.payoutCondition[terms.payoutCondition]} />
        {terms.payoutNote ? <Field label={t.payoutNote} value={terms.payoutNote} /> : null}
      </dl>

      <ul className="space-y-2">
        <li className="flex items-start gap-2 rounded-md border border-border p-3 text-small">
          {summary.accrual === "accrued" ? (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-fg" />
          ) : (
            <Timer aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          )}
          <span>
            <span className="font-semibold text-fg">{t.accrued}: </span>
            {accrualText}
          </span>
        </li>
        <li
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-small",
            summary.paidAt ? "border-success-border bg-success-bg" : "border-warning-border bg-warning-bg",
          )}
        >
          {summary.paidAt ? (
            <Wallet aria-hidden className="mt-0.5 size-4 shrink-0 text-success-fg" />
          ) : (
            <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
          )}
          <span>
            <span className="font-semibold text-fg">{t.paid}: </span>
            {summary.paidAt ? (
              format(t.paidAt, { date: formatDate(locale, summary.paidAt) })
            ) : (
              <>
                {t.notPaid}
                <span className="block text-caption text-fg-muted">{t.notPaidHint}</span>
              </>
            )}
          </span>
        </li>
      </ul>

      {cooperation ? (
        <p className="text-caption text-fg-muted">
          {cooperation.accepted ? format(t.via, { n: cooperation.accepted.version }) : null}{" "}
          <Link
            href={appPath(locale, `/mls/cooperation/${encodeURIComponent(cooperation.request.id)}`)}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t.openCooperation}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      ) : null}
    </DealSection>
  );
}

/* ------------------------------------------------------ act & MLS report */

/**
 * The completion act and the 3-working-day MLS reporting window (§17.5,
 * §38.5): the deadline, working days left or overdue — icon and text — and
 * how the deadline is counted.
 */
function mlsStatus(
  locale: Locale,
  report: DealDetailView["mlsReport"],
): { tone: "info" | "warning" | "danger" | "success"; icon: LucideIcon; text: string } {
  const t = deals[locale].act.mls;
  switch (report.state) {
    case "not_required":
      return { tone: "info", icon: FileCheck2, text: t.not_required };
    case "awaiting_act":
      return { tone: "info", icon: Timer, text: t.awaiting_act };
    case "reported":
      return { tone: "success", icon: CircleCheck, text: format(t.reported, { date: formatDateTime(locale, report.reportedAt) }) };
    case "due":
      return {
        tone: "warning",
        icon: Timer,
        text:
          report.workingDaysLeft > 0
            ? format(t.due, { date: formatDateTime(locale, report.dueAt), n: report.workingDaysLeft })
            : format(t.dueToday, { date: formatDateTime(locale, report.dueAt) }),
      };
    case "overdue":
      return { tone: "danger", icon: OctagonAlert, text: format(t.overdue, { date: formatDateTime(locale, report.dueAt) }) };
  }
}

export function ActSection({ locale, view }: { locale: Locale; view: DealDetailView }) {
  const t = deals[locale].act;
  const { deal, mlsReport } = view;
  const status = mlsStatus(locale, mlsReport);
  const toneClass = {
    info: "border-border bg-surface-muted text-fg",
    success: "border-success-border bg-success-bg text-success-fg",
    warning: "border-warning-border bg-warning-bg text-warning-fg",
    danger: "border-danger-border bg-danger-bg text-danger-fg",
  }[status.tone];
  const StatusIcon = status.icon;

  return (
    <DealSection id={sectionId("act")} title={deals[locale].sections.act} icon={FileCheck2}>
      <p className="flex items-center gap-2 text-small text-fg">
        {deal.actSignedAt ? (
          <>
            <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
            {format(t.signed, { date: formatDateTime(locale, deal.actSignedAt) })}
          </>
        ) : (
          <>
            <Circle aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            {t.notSigned}
          </>
        )}
      </p>
      <p className={cn("flex items-start gap-2 rounded-md border p-3 text-small font-medium", toneClass)}>
        <StatusIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{status.text}</span>
      </p>
      {mlsReport.state === "due" || mlsReport.state === "overdue" ? (
        <dl>
          <Field label={t.deadline} value={<time dateTime={mlsReport.dueAt}>{formatDateTime(locale, mlsReport.dueAt)}</time>} />
        </dl>
      ) : null}
      {mlsReport.state !== "not_required" ? <p className="text-caption text-fg-muted">{t.rule}</p> : null}
    </DealSection>
  );
}

