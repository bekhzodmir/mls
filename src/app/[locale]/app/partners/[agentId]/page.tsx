import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Clock,
  Handshake,
  Lock,
  LockOpen,
  MapPin,
  Network,
  Phone,
  Send,
  Users,
} from "lucide-react";
import { DealStageBadge } from "@/components/app/deals/deal-badges";
import { telegramHref } from "@/components/app/crm/lead-card";
import { AccessBadge, ListingStatusBadge } from "@/components/app/inventory/listing-badges";
import { listingHref } from "@/components/app/inventory/property-card";
import { cooperationHref, newCooperationHref } from "@/components/app/mls/cooperation-model";
import { CooperationStatusBadge } from "@/components/app/mls/cooperation-status";
import { listingPlace, listingTitle } from "@/components/app/mls/listing-labels";
import { PageHeader } from "@/components/app/page-header";
import { activeRequestByListing, contactState, partnerHref, partnersHref } from "@/components/app/partners/partner-model";
import { cooperationCheck, partnersCheck } from "@/components/app/team/access";
import { ProfessionalStatusBadge } from "@/components/app/team/badges";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { FactRow } from "@/components/app/team/fact-row";
import { PermissionNote } from "@/components/app/team/permission-note";
import { teamHref } from "@/components/app/team/team-model";
import { AGENT_FACT_SUBJECTS, extraFactSubjects, factOf } from "@/components/app/team/verification";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import { MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Chip } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { formatDate, formatDateTime, formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import partners from "@/i18n/messages/partners";
import { getLocale } from "@/i18n/server";
import { loadPartner } from "@/lib/data/cached";
import { getViewer } from "@/lib/data/repository";
import { districtName } from "@/lib/domain/geo";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import { appHref, appPath } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/partners/[agentId]">): Promise<Metadata> {
  const locale = await getLocale();
  const { agentId } = await params;
  const partner = await loadPartner(agentId);
  return { title: format(partners[locale].meta.detail, { name: partner?.agent.name ?? agentId }) };
}

/**
 * Partner profile (screen 57, §5.6, §15, §18.2): who the partner is, checked
 * facts as results only (§19), contacts only after an accepted cooperation
 * with shared contacts — otherwise the reason and the path to request one
 * through an MLS listing — then the cooperation history with the viewer,
 * the partner's listings and joint deals.
 */
export default async function PartnerPage({ params, searchParams }: PageProps<"/[locale]/app/partners/[agentId]">) {
  const locale = await getLocale();
  const { agentId } = await params;
  const demoRole = parseDemoRole((await searchParams)[DEMO_ROLE_PARAM]);
  const [detail, viewer] = await Promise.all([loadPartner(agentId), getViewer()]);
  if (!detail) notFound();

  const t = partners[locale].detail;
  const d = domain[locale];
  const actor = actingRole(viewer.agent.role, demoRole);
  const access = partnersCheck(actor);
  const { agent, organization } = detail;

  const banner = demoRole ? (
    <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={partnerHref(locale, agent.id)} />
  ) : null;
  const switcher = (
    <DemoRoleSwitcher
      locale={locale}
      viewerRole={viewer.agent.role}
      demoRole={demoRole}
      hrefFor={(role) => partnerHref(locale, agent.id, role)}
    />
  );

  if (!access.ok) {
    return (
      <div className="space-y-4">
        {banner}
        <PageHeader locale={locale} backHref={partnersHref(locale, {}, demoRole)} title={t.back} className="mb-0" />
        <PermissionNote
          locale={locale}
          explanation={access.explanation}
          next={partners[locale].list.deniedNext}
          action={
            <ButtonLink href={teamHref(locale, demoRole)} variant="secondary">
              <Users aria-hidden className="size-4" />
              {partners[locale].list.toTeam}
            </ButtonLink>
          }
        />
        {switcher}
      </div>
    );
  }

  const cooperation = cooperationCheck(actor);
  const contacts = contactState(detail);
  const requests = activeRequestByListing(detail.cooperationHistory);
  const target = contacts.kind === "hidden" && contacts.listingId
    ? detail.listings.find((view) => view.listing.id === contacts.listingId)
    : undefined;
  const orgFacts = organization
    ? ([
        ["org_registry", organization.registry],
        ["insurance", organization.insurance],
      ] as const)
    : [];
  const stats = detail.cooperation;

  return (
    <div className="space-y-6">
      {banner}
      <PageHeader
        locale={locale}
        backHref={partnersHref(locale, {}, demoRole)}
        title={agent.name}
        subtitle={`${organization?.name ?? partners[locale].card.noOrganization} · ${d.role[agent.role]}`}
        className="mb-0"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Avatar name={agent.name} className="size-12 text-body" />
          <ProfessionalStatusBadge locale={locale} status={displayedProfessionalStatus(agent)} />
          {detail.contactsShared ? (
            <Badge tone="success" icon={LockOpen}>
              {partners[locale].card.contactsShared}
            </Badge>
          ) : (
            <Badge tone="neutral" icon={Lock}>
              {partners[locale].card.contactsHidden}
            </Badge>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-caption text-fg-muted">
          <Clock aria-hidden className="size-3.5" />
          {detail.lastInteractionAt
            ? format(t.lastInteraction, { date: formatDateTime(locale, detail.lastInteractionAt) })
            : t.lastInteractionNone}
        </p>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="partner-about" className="space-y-3">
          <h2 id="partner-about" className="text-h2 text-fg">
            {t.about}
          </h2>
          <Card className="space-y-3 p-4">
            <dl className="divide-y divide-border">
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-small text-fg-muted">{t.organization}</dt>
                <dd className="flex items-center gap-1.5 text-right text-small font-medium text-fg">
                  <Building2 aria-hidden className="size-4 text-fg-muted" />
                  {organization?.name ?? partners[locale].card.noOrganization}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-small text-fg-muted">{t.role}</dt>
                <dd className="text-right text-small font-medium text-fg">{d.role[agent.role]}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-small text-fg-muted">{t.status}</dt>
                <dd className="text-right text-small font-medium text-fg">{d.professionalStatus[displayedProfessionalStatus(agent)]}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-small text-fg-muted">{t.languages}</dt>
                <dd className="text-right text-small font-medium text-fg">
                  {formatList(
                    locale,
                    agent.languages.map((language) => leads[locale].language[language]),
                  )}
                </dd>
              </div>
            </dl>
            <div className="space-y-1">
              <p className="text-caption font-medium text-fg-muted">{t.territory}</p>
              {agent.territory.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {agent.territory.map((district) => (
                    <li key={district}>
                      <Chip>
                        <MapPin aria-hidden className="size-3.5" />
                        {districtName(district, locale)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-fg-muted">{t.territoryNone}</p>
              )}
            </div>
          </Card>

          <section aria-labelledby="partner-contacts" className="space-y-3">
            <h2 id="partner-contacts" className="text-h2 text-fg">
              {t.contacts}
            </h2>
            {contacts.kind === "shared" ? (
              <Card className="space-y-3 p-4">
                <p className="flex items-start gap-1.5 text-small text-fg-muted">
                  <LockOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t.sharedNote}
                </p>
                <div className="flex flex-wrap gap-2">
                  {contacts.phone ? (
                    <ButtonAnchor href={telHref(contacts.phone)} aria-label={format(t.call, { name: agent.name })}>
                      <Phone aria-hidden className="size-4" />
                      <span className="tabular">{formatUzPhone(contacts.phone)}</span>
                    </ButtonAnchor>
                  ) : null}
                  {contacts.telegramUsername ? (
                    <ButtonAnchor
                      href={telegramHref(contacts.telegramUsername)}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                    >
                      <Send aria-hidden className="size-4" />@{contacts.telegramUsername}
                    </ButtonAnchor>
                  ) : null}
                </div>
              </Card>
            ) : (
              <Notice kind="permission" title={t.hiddenTitle}>
                <p>{t.hiddenReason}</p>
                {contacts.kind === "pending" ? (
                  <div className="space-y-2 pt-2">
                    <p>{t.pending}</p>
                    <ButtonLink href={cooperationHref(locale, contacts.requestId)} variant="secondary">
                      <Handshake aria-hidden className="size-4" />
                      {t.openPending}
                    </ButtonLink>
                  </div>
                ) : !cooperation.ok ? null : target ? (
                  <div className="space-y-2 pt-2">
                    <p>{t.requestPath}</p>
                    <p className="text-caption">{format(t.requestOn, { listing: listingTitle(locale, target.property) })}</p>
                    <ButtonLink href={newCooperationHref(locale, target.listing.id)}>
                      <Handshake aria-hidden className="size-4" />
                      {t.requestAction}
                    </ButtonLink>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <p>{t.noListings}</p>
                    <ButtonLink href={appHref(locale, "mls")} variant="secondary">
                      <Network aria-hidden className="size-4" />
                      {t.toMls}
                    </ButtonLink>
                  </div>
                )}
              </Notice>
            )}
            {!cooperation.ok ? (
              <PermissionNote locale={locale} explanation={cooperation.explanation} next={t.cooperationDeniedNext} />
            ) : null}
          </section>
        </section>

        <section aria-labelledby="partner-facts" className="space-y-3">
          <h2 id="partner-facts" className="text-h2 text-fg">
            {t.facts}
          </h2>
          <p className="text-small text-fg-muted">{t.factsText}</p>
          <Card className="overflow-hidden">
            <h3 className="px-4 pt-4 text-small font-semibold text-fg-muted">
              {t.agentFacts} · {agent.name}
            </h3>
            <ul className="divide-y divide-border">
              {[...AGENT_FACT_SUBJECTS, ...extraFactSubjects(agent.verifications)].map((subject) => (
                <FactRow
                  key={subject}
                  locale={locale}
                  subject={subject}
                  fact={factOf(agent.verifications, subject)}
                  showSource={false}
                />
              ))}
            </ul>
          </Card>
          {organization ? (
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-4 text-small font-semibold text-fg-muted">
                {t.orgFacts} · {organization.name}
              </h3>
              <ul className="divide-y divide-border">
                {orgFacts.map(([subject, fact]) => (
                  <FactRow key={subject} locale={locale} subject={subject} fact={fact} showSource={false} />
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="partner-cooperation" className="space-y-3">
        <h2 id="partner-cooperation" className="text-h2 text-fg">
          {t.cooperationTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["total", "accepted", "inProgress", "declined", "other"] as const).map((key) => (
            <div key={key} className="rounded-md bg-surface-muted px-3 py-2">
              <dt className="text-caption text-fg-muted">{t.stats[key]}</dt>
              <dd className="text-h2 tabular text-fg">{stats[key]}</dd>
            </div>
          ))}
        </dl>
        <h3 className="text-body font-semibold text-fg">{t.history}</h3>
        {detail.cooperationHistory.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.historyEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {detail.cooperationHistory.map((view) => (
              <li key={view.request.id}>
                <Link
                  href={cooperationHref(locale, view.request.id)}
                  aria-label={format(t.openRequest, { id: view.request.id })}
                  className="flex min-h-11 flex-col gap-1.5 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-muted/40"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CooperationStatusBadge status={view.request.status} label={d.cooperationStatus[view.request.status]} />
                    <Badge tone="neutral" icon={view.direction === "incoming" ? ArrowDownLeft : ArrowUpRight}>
                      {view.direction === "incoming" ? t.incoming : t.outgoing}
                    </Badge>
                    <span className="text-caption text-fg-muted">{view.request.id}</span>
                  </span>
                  <span className="text-small font-medium text-fg">{listingTitle(locale, view.listing.property)}</span>
                  <span className="text-caption text-fg-muted">
                    {format(t.proposed, { date: formatDateTime(locale, view.latest.proposedAt) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="partner-listings" className="space-y-3">
        <h2 id="partner-listings" className="text-h2 text-fg">
          {t.listingsTitle}
        </h2>
        <p className="text-small text-fg-muted">{t.listingsText}</p>
        {detail.listings.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.listingsEmpty}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {detail.listings.map((view) => {
              const title = listingTitle(locale, view.property);
              const requestId = requests.get(view.listing.id);
              const canRequest =
                cooperation.ok && !requestId && view.listing.status === "active_mls" && view.access === "partner_masked";
              return (
                <li key={view.listing.id} className="space-y-2 rounded-lg border border-border bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap gap-1.5">
                    <ListingStatusBadge locale={locale} status={view.listing.status} />
                    <AccessBadge locale={locale} access={view.access} />
                  </div>
                  <h3 className="text-body font-semibold text-fg">
                    <Link href={listingHref(locale, view.listing.id)} className="underline-offset-4 hover:underline">
                      {title}
                    </Link>
                  </h3>
                  <p className="text-small text-fg-muted">{listingPlace(locale, view.property)}</p>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <MoneyText locale={locale} value={view.listing.price} className="text-body font-semibold text-fg" />
                    <span className="text-caption text-fg-muted">{d.dealType[view.listing.dealType]}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    {requestId ? (
                      <ButtonLink href={cooperationHref(locale, requestId)} variant="soft">
                        <Handshake aria-hidden className="size-4" />
                        {format(t.openRequest, { id: requestId })}
                      </ButtonLink>
                    ) : canRequest ? (
                      <ButtonLink
                        href={newCooperationHref(locale, view.listing.id)}
                        aria-label={format(t.requestFor, { title })}
                      >
                        <Handshake aria-hidden className="size-4" />
                        {t.requestAction}
                      </ButtonLink>
                    ) : null}
                    <ButtonLink
                      href={listingHref(locale, view.listing.id)}
                      variant="secondary"
                      aria-label={format(t.openListing, { title })}
                    >
                      {t.openListingShort}
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="partner-deals" className="space-y-3">
        <h2 id="partner-deals" className="text-h2 text-fg">
          {t.dealsTitle}
        </h2>
        {detail.deals.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.dealsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {detail.deals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={appPath(locale, `/deals/${encodeURIComponent(deal.id)}`)}
                  aria-label={format(t.openDeal, { id: deal.id })}
                  className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-muted/40"
                >
                  <span className="text-small font-semibold text-fg">{format(t.deal, { id: deal.id })}</span>
                  <DealStageBadge locale={locale} stage={deal.stage} />
                  <span className="text-caption text-fg-muted">
                    {format(t.dealCreated, { date: formatDate(locale, deal.createdAt) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {switcher}
    </div>
  );
}
