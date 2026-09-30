import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Lock, Phone, UserRound } from "lucide-react";
import { criteriaRows, termsLabels } from "@/components/app/mls/cooperation-labels";
import { cooperationListHref, deadlineState } from "@/components/app/mls/cooperation-model";
import { CooperationWorkspace } from "@/components/app/mls/cooperation-workspace";
import { listingTitle } from "@/components/app/mls/listing-labels";
import { MlsListingCard } from "@/components/app/mls/mls-listing-card";
import { RequirementCriteria } from "@/components/app/mls/requirement-criteria";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import cooperation from "@/i18n/messages/cooperation";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadCooperation } from "@/lib/data/cached";
import { getViewer } from "@/lib/data/repository";
import type { CooperationView } from "@/lib/data/views";
import type { SplitSide } from "@/lib/domain/commission";
import { formatUzPhone, maskUzPhone, telHref } from "@/lib/domain/phone";
import type { Agent, CooperationInitiatorRole, Organization } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/mls/cooperation/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  return { title: format(cooperation[locale].meta.detail, { id }) };
}

function Participant({
  locale,
  side,
  agent,
  organization,
  isViewer,
  shared,
  role,
}: {
  locale: Locale;
  side: SplitSide;
  agent: Agent;
  organization?: Organization;
  isViewer: boolean;
  shared: boolean;
  /** The requesting side's stated role; `null` = not stated (unknown), `undefined` = not applicable. */
  role?: CooperationInitiatorRole | null;
}) {
  const t = cooperation[locale];
  const d = domain[locale];
  return (
    <div className="space-y-1 rounded-lg border border-border bg-surface p-4">
      <p className="text-caption font-semibold tracking-wide text-fg-subtle uppercase">
        {side === "listing" ? t.role.listing : t.role.buyer}
        {isViewer ? ` (${t.role.you})` : ""}
      </p>
      <p className="text-caption text-fg-muted">{side === "listing" ? t.role.listingHint : t.role.buyerHint}</p>
      <p className="flex items-center gap-2 pt-1 text-body font-semibold text-fg">
        <UserRound aria-hidden className="size-4 text-fg-muted" />
        {agent.name}
      </p>
      <p className="text-small text-fg">
        <span className="text-fg-muted">{t.detail.agency}: </span>
        {organization?.name ?? t.detail.noAgency}
      </p>
      {role !== undefined ? (
        <p className="text-small text-fg">
          <span className="text-fg-muted">{t.detail.initiatorRole}: </span>
          {role ? d.initiatorRole[role] : d.unknown}
        </p>
      ) : null}
      <p className="text-small text-fg-muted">{d.professionalStatus[agent.professionalStatus]}</p>
      {isViewer ? null : shared ? (
        <p className="flex items-center gap-2 text-small">
          <Phone aria-hidden className="size-4 text-fg-muted" />
          <a
            href={telHref(agent.phone)}
            className="inline-flex min-h-11 items-center tabular text-primary underline-offset-4 hover:underline"
          >
            {formatUzPhone(agent.phone)}
          </a>
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 text-small text-fg">
          <Lock aria-hidden className="size-4 text-fg-muted" />
          <span className="tabular">{maskUzPhone(agent.phone)}</span>
          <span className="text-caption text-fg-muted">({t.detail.phoneHidden})</span>
        </p>
      )}
    </div>
  );
}

function RequirementBlock({ locale, view }: { locale: Locale; view: CooperationView }) {
  const t = cooperation[locale].detail;
  const c = mls[locale].criteria;
  const summary = view.requirement;
  return (
    <section aria-labelledby="coop-requirement" className="space-y-2 rounded-lg border border-border bg-surface p-4">
      <h2 id="coop-requirement" className="text-body font-semibold text-fg">
        {t.requirement}
      </h2>
      {summary ? (
        <>
          <p className="text-caption text-fg-muted">{t.requirementLimited}</p>
          <RequirementCriteria rows={criteriaRows(locale, summary)} mustHaveLabel={c.mustHave} />
          <p className="flex items-center gap-1.5 text-small text-fg">
            {summary.disclosed && summary.clientName ? (
              <>
                <UserRound aria-hidden className="size-4 text-fg-muted" />
                {format(c.clientName, { name: summary.clientName })}
              </>
            ) : (
              <>
                <Lock aria-hidden className="size-4 text-fg-muted" />
                {c.clientHidden}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-small text-fg-muted">{t.requirementNone}</p>
      )}
    </section>
  );
}

/**
 * Cooperation workspace (§15.3, §35.6, §36.3): who is on which side, the
 * listing, the buyer request within the allowed disclosure, and the
 * negotiation with every version kept. Accepted terms are locked; legal
 * force comes from the signed contract, not from this screen.
 */
export default async function CooperationPage({ params }: PageProps<"/[locale]/app/mls/cooperation/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const [view, viewer] = await Promise.all([loadCooperation(id), getViewer()]);
  if (!view) notFound();

  const t = cooperation[locale];
  const d = domain[locale];
  const at = now();
  const { request } = view;
  const viewerId = viewer.agent.id;
  const shared = request.disclosure === "contacts_shared";
  const nameOf = (agent: Agent, organization?: Organization) =>
    `${agent.name} · ${organization?.name ?? t.detail.noAgency}`;
  const deadline = deadlineState(request, at);
  const versionTimes = Object.fromEntries(
    request.versions.map((version) => [version.version, formatDateTime(locale, version.proposedAt)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        locale={locale}
        backHref={cooperationListHref(locale)}
        title={t.detail.title}
        subtitle={listingTitle(locale, view.listing.property)}
        className="mb-0"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" icon={view.direction === "incoming" ? ArrowDownLeft : ArrowUpRight}>
            {view.direction === "incoming" ? t.card.incoming : t.card.outgoing}
          </Badge>
          <Badge tone="neutral">{request.id}</Badge>
        </div>
      </PageHeader>

      <section aria-labelledby="coop-participants" className="space-y-3">
        <h2 id="coop-participants" className="text-h2 text-fg">
          {t.detail.participants}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Participant
            locale={locale}
            side="listing"
            agent={view.toAgent}
            organization={view.toOrganization}
            isViewer={view.toAgent.id === viewerId}
            shared={shared}
          />
          <Participant
            locale={locale}
            side="buyer"
            agent={view.fromAgent}
            organization={view.fromOrganization}
            isViewer={view.fromAgent.id === viewerId}
            shared={shared}
            role={request.initiatorRole ?? null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <CooperationWorkspace
          locale={locale}
          viewerId={viewerId}
          initial={request}
          names={{
            [view.fromAgent.id]: nameOf(view.fromAgent, view.fromOrganization),
            [view.toAgent.id]: nameOf(view.toAgent, view.toOrganization),
          }}
          labels={{
            c: t,
            terms: termsLabels(locale),
            editor: { editor: t.editor, issue: t.issue, example: t.example, terms: termsLabels(locale) },
            status: d.cooperationStatus,
          }}
          versionTimes={versionTimes}
          respondByText={formatDateTime(locale, request.respondBy)}
          deadlineText={
            deadline.kind === "open"
              ? format(t.card.respondBy, {
                  date: formatDateTime(locale, request.respondBy),
                  relative: formatRelative(locale, request.respondBy, at),
                })
              : undefined
          }
          scheduleHref={`${appPath(locale, "/viewings/new")}?${new URLSearchParams({ listingId: request.listingId }).toString()}`}
          counterpartPhone={
            shared ? { text: formatUzPhone(view.counterpart.phone), href: telHref(view.counterpart.phone) } : undefined
          }
        />

        <div className="space-y-4">
          <section aria-labelledby="coop-listing" className="space-y-2">
            <h2 id="coop-listing" className="text-body font-semibold text-fg">
              {t.detail.listing}
            </h2>
            <MlsListingCard locale={locale} view={view.listing} now={at} variant="summary" headingLevel={3} />
          </section>
          <RequirementBlock locale={locale} view={view} />
        </div>
      </div>
    </div>
  );
}
