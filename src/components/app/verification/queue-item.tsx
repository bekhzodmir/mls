import Link from "next/link";
import { Building, Building2, Lock, RotateCcw, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { propertyLabel } from "@/components/app/crm/object-label";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDate } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import verification from "@/i18n/messages/verification";
import type { VerificationQueueItem, VerificationTargetKind } from "@/lib/data/views";
import type { ID } from "@/lib/domain/types";
import { FACT_SUBJECTS } from "./request";
import { BucketBadge, FactBadge, QueueScopeBadge } from "./queue-badges";
import { bucketOf, canRequestAgain, expiryInfo, requestHref, targetHref } from "./queue";

const targetIcon: Record<VerificationTargetKind, LucideIcon> = {
  listing: Building,
  agent: UserRound,
  organization: Building2,
};

/** Privacy-safe name of what was checked: a listing never shows its full address here. */
export function targetLabel(locale: Locale, target: VerificationQueueItem["target"], viewerId: ID): string {
  switch (target.kind) {
    case "listing":
      return propertyLabel(locale, target.view.property);
    case "agent":
      return target.agent.id === viewerId
        ? `${target.agent.name} (${verification[locale].item.you})`
        : target.agent.name;
    case "organization":
      return target.organization.name;
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </>
  );
}

/**
 * One fact in the queue (§16.1): target, subject and status, then method,
 * source, checked date, performer and validity. A result-only item (§19)
 * says so instead of leaving the source blank; an unknown value reads
 * "Неизвестно", never a guess.
 */
export function QueueItemCard({
  locale,
  entry,
  at,
  viewerId,
  performers,
  showTarget = true,
}: {
  locale: Locale;
  entry: VerificationQueueItem;
  at: Date;
  viewerId: ID;
  /** Agent names by id, for `performedById`. */
  performers: Record<ID, string>;
  showTarget?: boolean;
}) {
  const t = verification[locale].item;
  const d = domain[locale];
  const { item } = entry;
  const bucket = bucketOf(entry);
  const expiry = expiryInfo(entry, at);
  const TargetIcon = targetIcon[entry.target.kind];
  const resultOnly = (
    <span className="inline-flex items-center gap-1 text-fg-muted">
      <Lock aria-hidden className="size-3.5 shrink-0" />
      {t.resultOnly}
    </span>
  );
  const unknown = <span className="italic text-fg-muted">{d.unknown}</span>;
  const prefill = FACT_SUBJECTS[item.subject] ? item.subject : undefined;

  let validity: ReactNode;
  switch (expiry.kind) {
    case "none":
      validity = <span className="text-fg-muted">{t.noExpiry}</span>;
      break;
    case "valid":
      validity = formatDate(locale, expiry.at);
      break;
    case "expired":
      validity = (
        <span className="font-medium text-danger-fg">
          {formatDate(locale, expiry.at)} ·{" "}
          {expiry.daysAgo === 0 ? t.expiredToday : format(plural(locale, expiry.daysAgo, t.expiredAgo), { n: expiry.daysAgo })}
        </span>
      );
      break;
    case "expiring":
      validity = (
        <span className="font-medium text-warning-fg">
          {formatDate(locale, expiry.at)} ·{" "}
          {expiry.daysLeft === 0
            ? t.expiringToday
            : format(plural(locale, expiry.daysLeft, t.expiringIn), { n: expiry.daysLeft })}
        </span>
      );
      break;
  }

  const hint =
    bucket === "unavailable" ? t.unavailable : bucket === "problem" ? t.problem : bucket === "pending" ? t.pending : undefined;

  return (
    <article className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <FactBadge locale={locale} entry={entry} />
        {bucket === "expired" || bucket === "expiring" ? <BucketBadge locale={locale} bucket={bucket} /> : null}
        <QueueScopeBadge locale={locale} scope={entry.scope} />
      </div>

      {showTarget ? (
        <p className="flex items-center gap-2 text-small">
          <TargetIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
          <span className="min-w-0">
            <span className="text-fg-muted">{t.target[entry.target.kind]}: </span>
            <Link
              href={targetHref(locale, entry.target, viewerId)}
              className="inline-flex min-h-11 items-center font-semibold text-fg underline-offset-2 hover:underline"
            >
              {targetLabel(locale, entry.target, viewerId)}
            </Link>
          </span>
        </p>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
        <Row label={t.method}>{d.verificationMethod[item.method]}</Row>
        <Row label={t.source}>{entry.detailed ? (item.source ?? unknown) : resultOnly}</Row>
        <Row label={t.checked}>
          {item.checkedAt ? (
            <time dateTime={item.checkedAt}>{formatDate(locale, item.checkedAt)}</time>
          ) : (
            <span className="text-fg-muted">{t.notChecked}</span>
          )}
        </Row>
        <Row label={t.performer}>
          {!entry.detailed
            ? resultOnly
            : item.performedById
              ? (performers[item.performedById] ?? unknown)
              : unknown}
        </Row>
        <Row label={t.validUntil}>{validity}</Row>
        {entry.detailed && item.note ? <Row label={t.note}>{item.note}</Row> : null}
      </dl>

      {hint ? <p className="text-caption text-fg-muted">{hint}</p> : null}
      {!entry.detailed ? <p className="text-caption text-fg-subtle">{t.resultOnlyHint[entry.target.kind]}</p> : null}

      {canRequestAgain(entry) && entry.target.kind === "listing" ? (
        <ButtonLink
          href={requestHref(locale, { listingId: entry.target.view.listing.id, subject: prefill })}
          variant="soft"
        >
          <RotateCcw aria-hidden className="size-4" />
          {t.requestAgain}
        </ButtonLink>
      ) : null}
    </article>
  );
}
