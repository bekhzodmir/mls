import Link from "next/link";
import { Handshake, Lock, Plus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import type { CooperationView, RequirementView } from "@/lib/data/views";
import { appPath } from "@/lib/routes";
import { criteriaRows, requirementLine } from "./cooperation-labels";
import { cooperationHref, partnerViewOf } from "./cooperation-model";
import { listingTitle } from "./listing-labels";
import { RequirementCriteria } from "./requirement-criteria";

/**
 * "Запросы покупателей" (§15.1): partners' buyers who were brought to the
 * viewer's listings, and the viewer's own requests exactly as partners would
 * see them. Criteria only — no client names, phones or notes until terms are
 * accepted (§16.3, §18.2).
 */
export function BuyerRequests({
  locale,
  incoming,
  own,
}: {
  locale: Locale;
  /** Incoming cooperation requests that carry a buyer request. */
  incoming: CooperationView[];
  /** The viewer's active requirements. */
  own: RequirementView[];
}) {
  const t = mls[locale].requests;
  const c = mls[locale].criteria;
  const d = domain[locale];

  return (
    <div className="space-y-8">
      <section aria-labelledby="mls-partner-requests" className="space-y-3">
        <SectionHeader id="mls-partner-requests" title={t.partnerTitle} />
        <p className="text-small text-fg-muted">{t.partnerText}</p>
        <Notice kind="info">{t.dataNote}</Notice>
        {incoming.length === 0 ? (
          <EmptyState icon={UsersRound} title={t.partnerNone} />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {incoming.map((view) => {
              const summary = view.requirement;
              if (!summary) return null;
              const titleId = `request-${view.request.id}`;
              return (
                <li key={view.request.id}>
                  <article
                    aria-labelledby={titleId}
                    className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info" icon={Handshake}>
                        {d.cooperationStatus[view.request.status]}
                      </Badge>
                    </div>
                    <h3 id={titleId} className="text-body font-semibold text-fg">
                      {format(t.fromAgent, { agent: view.fromAgent.name })}
                      {view.fromOrganization ? ` · ${view.fromOrganization.name}` : ""}
                    </h3>
                    <p className="text-small text-fg-muted">{listingTitle(locale, view.listing.property)}</p>
                    <RequirementCriteria rows={criteriaRows(locale, summary)} mustHaveLabel={c.mustHave} />
                    <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                      <Lock aria-hidden className="size-3.5" />
                      {summary.disclosed && summary.clientName
                        ? format(c.clientName, { name: summary.clientName })
                        : c.clientHidden}
                    </p>
                    <ButtonLink href={cooperationHref(locale, view.request.id)} aria-describedby={titleId}>
                      <Handshake aria-hidden className="size-4" />
                      {t.openCooperation}
                    </ButtonLink>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="mls-own-requests" className="space-y-3">
        <SectionHeader
          id="mls-own-requests"
          title={t.ownTitle}
          action={
            <ButtonLink href={appPath(locale, "/requirements/new")} variant="secondary">
              <Plus aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">{t.newRequirement}</span>
            </ButtonLink>
          }
        />
        <p className="text-small text-fg-muted">{t.ownText}</p>
        {own.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={t.ownNone}
            action={<ButtonLink href={appPath(locale, "/requirements/new")}>{t.newRequirement}</ButtonLink>}
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {own.map((view) => {
              const titleId = `own-${view.requirement.id}`;
              return (
                <li key={view.requirement.id}>
                  <article
                    aria-labelledby={titleId}
                    className="space-y-3 rounded-lg border border-border bg-surface p-4"
                  >
                    <h3 id={titleId} className="text-body font-semibold text-fg">
                      {requirementLine(locale, view.requirement)}
                    </h3>
                    <RequirementCriteria
                      rows={criteriaRows(locale, partnerViewOf(view.requirement))}
                      mustHaveLabel={c.mustHave}
                    />
                    <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                      <Lock aria-hidden className="size-3.5" />
                      {c.clientHidden}
                    </p>
                    <Link
                      href={appPath(locale, `/requirements/${encodeURIComponent(view.requirement.id)}`)}
                      aria-describedby={titleId}
                      className="inline-flex min-h-11 items-center text-small font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t.openRequirement}
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
