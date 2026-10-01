import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Crown, MapPin, Route, Settings, UserRound, Users } from "lucide-react";
import { ListingStatusBadge } from "@/components/app/inventory/listing-badges";
import { listingHref } from "@/components/app/inventory/property-card";
import { listingTitle } from "@/components/app/mls/listing-labels";
import { PageHeader } from "@/components/app/page-header";
import { checkAccess, memberOwnership, metricsCheck } from "@/components/app/team/access";
import { AvailabilityBadge, ProfessionalStatusBadge, RuleStateBadge } from "@/components/app/team/badges";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { FactRow } from "@/components/app/team/fact-row";
import { CapacityLine, MetricDefinitions, MetricsGrid } from "@/components/app/team/metrics";
import { PermissionNote } from "@/components/app/team/permission-note";
import { dimensionValues } from "@/components/app/team/routing-trace";
import { ruleConditions, sortRules } from "@/components/app/team/routing-model";
import { availabilityState, capacityState, memberHref, routingHref, teamHref } from "@/components/app/team/team-model";
import { AGENT_FACT_SUBJECTS, factOf } from "@/components/app/team/verification";
import { MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Chip } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadTeamMember } from "@/lib/data/cached";
import { getRoutingContext, getViewer } from "@/lib/data/repository";
import { districtName } from "@/lib/domain/geo";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import { appHref } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/team/[agentId]">): Promise<Metadata> {
  const locale = await getLocale();
  const { agentId } = await params;
  const member = await loadTeamMember(agentId);
  return { title: format(team[locale].meta.member, { name: member?.agent.name ?? agentId }) };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="text-right text-small font-medium text-fg">{children}</dd>
    </div>
  );
}

/**
 * Agent profile (screen 79, §5.2–5.3, §36.5): role, the professional status
 * as checked (§38.2), one fact per row, territory, languages, availability,
 * workload within the role's reports level (§19), the routing rules that can
 * send leads to this person, and their listings in work.
 */
export default async function TeamMemberPage({ params, searchParams }: PageProps<"/[locale]/app/team/[agentId]">) {
  const locale = await getLocale();
  const { agentId } = await params;
  const demoRole = parseDemoRole((await searchParams)[DEMO_ROLE_PARAM]);
  const [member, viewer, routing] = await Promise.all([loadTeamMember(agentId), getViewer(), getRoutingContext()]);
  if (!member) notFound();

  const t = team[locale];
  const d = domain[locale];
  const at = now();
  const actor = actingRole(viewer.agent.role, demoRole);
  const { agent, availability } = member;
  const ownership = memberOwnership({ isViewer: member.isViewer, inViewerTeam: member.team !== undefined });
  const metrics = metricsCheck(actor, ownership);
  const listingsAccess = checkAccess(actor, member.isViewer ? "own_properties" : "agency_base", { ownership });
  const allRules = sortRules(routing.rules);
  const rules = sortRules(member.routingRules);
  const agentName = (id: string) => routing.agents.find((item) => item.id === id)?.name ?? id;
  const organization = viewer.organization;
  const subtitle = [d.role[agent.role], organization?.name].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {demoRole ? (
        <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={memberHref(locale, agent.id)} />
      ) : null}
      <PageHeader locale={locale} backHref={teamHref(locale, demoRole)} title={agent.name} subtitle={subtitle} className="mb-0">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar name={agent.name} className="size-12 text-body" />
          <ProfessionalStatusBadge locale={locale} status={displayedProfessionalStatus(agent)} />
          <AvailabilityBadge locale={locale} state={availabilityState(availability, at)} />
          {member.isViewer ? (
            <Badge tone="brand" icon={UserRound}>
              {t.overview.you}
            </Badge>
          ) : null}
          {member.isLead ? (
            <Badge tone="neutral" icon={Crown}>
              {t.overview.lead}
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="member-profile" className="space-y-3">
          <h2 id="member-profile" className="sr-only">
            {t.member.role}
          </h2>
          <Card className="p-4">
            <dl className="divide-y divide-border">
              <Row label={t.member.role}>{d.role[agent.role]}</Row>
              <Row label={t.member.status}>{d.professionalStatus[displayedProfessionalStatus(agent)]}</Row>
              <Row label={t.member.organization}>{organization?.name ?? t.member.noOrganization}</Row>
              <Row label={t.member.team}>
                {member.team
                  ? member.isLead
                    ? format(t.member.teamLead, { team: member.team.name })
                    : member.team.name
                  : t.member.noTeam}
              </Row>
            </dl>
            {member.isViewer ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-small text-fg-muted">{t.member.own}</p>
                <ButtonLink href={appHref(locale, "more")} variant="secondary">
                  <Settings aria-hidden className="size-4" />
                  {t.member.ownSettings}
                </ButtonLink>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-body font-semibold text-fg">{t.member.work}</h3>
            <div className="space-y-1">
              <p className="text-caption font-medium text-fg-muted">{t.member.territory}</p>
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
                <p className="text-small text-fg-muted">{t.member.territoryNone}</p>
              )}
            </div>
            <p className="text-small text-fg">
              <span className="text-fg-muted">{t.member.languages}: </span>
              {formatList(
                locale,
                agent.languages.map((language) => leads[locale].language[language]),
              )}
            </p>
            <p className="text-small text-fg">
              <span className="text-fg-muted">{t.member.specializations}: </span>
              {availability.specializations.length > 0
                ? formatList(
                    locale,
                    availability.specializations.map((type) => d.propertyType[type]),
                  )
                : t.member.specializationsNone}
            </p>
          </Card>
        </section>

        <section aria-labelledby="member-facts" className="space-y-3">
          <h2 id="member-facts" className="text-h2 text-fg">
            {t.member.facts}
          </h2>
          <p className="text-small text-fg-muted">{t.member.factsText}</p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {AGENT_FACT_SUBJECTS.map((subject) => (
                <FactRow
                  key={subject}
                  locale={locale}
                  subject={subject}
                  fact={factOf(agent.verifications, subject)}
                  showSource={member.isViewer}
                />
              ))}
            </ul>
          </Card>
        </section>
      </div>

      <section aria-labelledby="member-load" className="space-y-3">
        <h2 id="member-load" className="text-h2 text-fg">
          {t.member.availabilityTitle}
        </h2>
        <Card className="space-y-3 p-4">
          <p className="flex flex-wrap items-center gap-2 text-small text-fg">
            <span className="text-fg-muted">{t.availability.label}:</span>
            <AvailabilityBadge locale={locale} state={availabilityState(availability, at)} />
          </p>
          {metrics.ok ? (
            <>
              <CapacityLine locale={locale} capacity={capacityState(member)} />
              <MetricsGrid locale={locale} metrics={member.metrics} />
            </>
          ) : (
            <PermissionNote
              locale={locale}
              explanation={metrics.explanation}
              next={t.member.metricsDeniedNext}
              action={
                <ButtonLink href={teamHref(locale, demoRole)} variant="secondary">
                  <Users aria-hidden className="size-4" />
                  {t.notFound.back}
                </ButtonLink>
              }
            />
          )}
        </Card>
        {metrics.ok ? <MetricDefinitions locale={locale} /> : null}
      </section>

      <section aria-labelledby="member-rules" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="member-rules" className="text-h2 text-fg">
            {t.member.rules}
          </h2>
          <ButtonLink href={routingHref(locale, demoRole)} variant="secondary">
            <Route aria-hidden className="size-4" />
            {t.member.openRouting}
          </ButtonLink>
        </div>
        <p className="text-small text-fg-muted">{t.member.rulesText}</p>
        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.member.rulesNone}</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => {
              const conditions = ruleConditions(rule);
              return (
                <li key={rule.id} className="space-y-2 rounded-md border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption font-semibold text-fg-muted">
                      {format(t.routing.position, { n: allRules.findIndex((item) => item.id === rule.id) + 1 })}
                    </span>
                    <Link
                      href={routingHref(locale, demoRole, `rule-${rule.id}`)}
                      className="inline-flex min-h-11 items-center text-small font-semibold text-fg underline-offset-4 hover:underline"
                    >
                      {rule.name}
                    </Link>
                    <RuleStateBadge locale={locale} active={rule.active} />
                  </div>
                  <p className="text-caption text-fg-muted">
                    {conditions.length === 0
                      ? t.routing.any
                      : conditions
                          .map(
                            (condition) =>
                              `${t.routing.dimensions[condition.dimension]}: ${dimensionValues(locale, condition.dimension, condition.values)}`,
                          )
                          .join(" · ")}
                    {" · "}
                    {t.routing.strategies[rule.strategy]}
                    {rule.agentIds.length > 1
                      ? ` · ${formatList(
                          locale,
                          rule.agentIds.map((id) => agentName(id)),
                        )}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="member-listings" className="space-y-3">
        <h2 id="member-listings" className="text-h2 text-fg">
          {t.member.listings}
        </h2>
        {!listingsAccess.ok ? (
          <PermissionNote locale={locale} explanation={listingsAccess.explanation} />
        ) : member.listings.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.member.listingsNone}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {member.listings.map((view) => {
              const title = listingTitle(locale, view.property);
              return (
                <li key={view.listing.id}>
                  <Link
                    href={listingHref(locale, view.listing.id)}
                    aria-label={format(t.member.openListing, { title })}
                    className="flex min-h-11 flex-col gap-1.5 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-muted/40"
                  >
                    <span className="text-small font-semibold text-fg">{title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <MoneyText locale={locale} value={view.listing.price} className="text-small font-semibold text-fg" />
                      <ListingStatusBadge locale={locale} status={view.listing.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DemoRoleSwitcher
        locale={locale}
        viewerRole={viewer.agent.role}
        demoRole={demoRole}
        hrefFor={(role) => memberHref(locale, agent.id, role)}
      />
    </div>
  );
}
