import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BellRing, Clock, Hourglass, Lock, LockOpen } from "lucide-react";
import { MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import cooperation from "@/i18n/messages/cooperation";
import domain from "@/i18n/messages/domain";
import type { CooperationView } from "@/lib/data/views";
import { termsLabels } from "./cooperation-labels";
import { cooperationHref, deadlineState, sideOf } from "./cooperation-model";
import { CooperationStatusBadge } from "./cooperation-status";
import { listingTitle } from "./listing-labels";
import { TermsSummary } from "./terms-summary";

/**
 * One co-broking request (§15.3, §22.9): who the partner is, which listing,
 * the status, the current terms with both roles, the respond-by countdown
 * and what has been disclosed so far.
 */
export function CooperationCard({
  locale,
  view,
  viewerId,
  now,
}: {
  locale: Locale;
  view: CooperationView;
  viewerId: string;
  now: Date;
}) {
  const t = cooperation[locale];
  const d = domain[locale];
  const { request, counterpart, listing, latest } = view;
  const titleId = `coop-${request.id}-title`;
  const deadline = deadlineState(request, now);
  const organization = view.direction === "incoming" ? view.fromOrganization : view.toOrganization;
  const side = sideOf(request, viewerId);
  const labels = termsLabels(locale);

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral" icon={view.direction === "incoming" ? ArrowDownLeft : ArrowUpRight}>
          {view.direction === "incoming" ? t.card.incoming : t.card.outgoing}
        </Badge>
        <CooperationStatusBadge status={request.status} label={d.cooperationStatus[request.status]} />
        {view.awaitingViewer ? (
          <Badge tone="warning" icon={BellRing}>
            {t.card.awaitingYou}
          </Badge>
        ) : deadline.kind === "open" ? (
          <Badge tone="neutral" icon={Clock}>
            {t.card.awaitingPartner}
          </Badge>
        ) : null}
        <Badge tone="neutral" icon={request.disclosure === "masked" ? Lock : LockOpen}>
          {t.disclosure[request.disclosure]}
        </Badge>
      </div>

      <div>
        <h2 id={titleId} className="text-body font-semibold text-fg">
          <Link href={cooperationHref(locale, request.id)} className="underline-offset-4 hover:underline">
            {counterpart.name}
            {organization ? ` · ${organization.name}` : ""}
          </Link>
        </h2>
        {side ? (
          <p className="text-caption text-fg-muted">
            {t.role.you}: {side === "listing" ? t.role.listing : t.role.buyer}
          </p>
        ) : null}
      </div>

      <p className="text-small text-fg">
        <span className="text-fg-muted">{t.card.listing}: </span>
        {listingTitle(locale, listing.property)} · <MoneyText locale={locale} value={listing.listing.price} />
      </p>

      <div className="space-y-1">
        <p className="text-caption font-medium text-fg-muted">
          {view.accepted ? t.detail.accepted : t.detail.current} · {format(t.card.version, { n: latest.version })}
        </p>
        <TermsSummary locale={locale} terms={(view.accepted ?? latest).terms} labels={labels} compact />
      </div>

      {deadline.kind === "open" ? (
        <p className="flex items-center gap-1.5 text-small text-fg">
          <Clock aria-hidden className="size-4 shrink-0 text-fg-muted" />
          {format(t.card.respondBy, {
            date: formatDateTime(locale, request.respondBy),
            relative: formatRelative(locale, request.respondBy, now),
          })}
        </p>
      ) : deadline.kind === "overdue" ? (
        <p className="flex items-center gap-1.5 text-small text-warning-fg">
          <Hourglass aria-hidden className="size-4 shrink-0" />
          {format(t.card.overdue, { relative: formatRelative(locale, request.respondBy, now) })}
        </p>
      ) : null}

      <ButtonLink
        href={cooperationHref(locale, request.id)}
        variant={view.awaitingViewer ? "primary" : "secondary"}
        aria-describedby={titleId}
      >
        {t.card.open}
      </ButtonLink>
    </article>
  );
}
