import type { Metadata } from "next";
import { RefreshCw, Route, ScrollText, UserRound, Users } from "lucide-react";
import { auditHref } from "@/components/app/audit/audit-model";
import { PageHeader } from "@/components/app/page-header";
import { memberOwnership, metricsCheck, routingEditCheck, assignCheck } from "@/components/app/team/access";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { ExceptionsPanel } from "@/components/app/team/exceptions-panel";
import { MemberCard } from "@/components/app/team/member-card";
import { MetricDefinitions, MetricsGrid } from "@/components/app/team/metrics";
import { PermissionNote } from "@/components/app/team/permission-note";
import { memberHref, routingHref, teamExceptions, teamHref } from "@/components/app/team/team-model";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getMyTeam, getRoutingContext, getTeamMember, getViewer } from "@/lib/data/repository";
import type { TeamMemberView } from "@/lib/data/views";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: team[locale].meta.overview };
}

/**
 * Team overview (screen 78, §5.3, §36.5): members with availability and,
 * where the role's reports reach them (§19 "Reports"), capacity left today
 * and workload counts; above them an exceptions panel instead of charts
 * (§33.2). An agency agent sees their own numbers and colleagues'
 * availability, with the right that would show more explained.
 * `?demoRole=` previews the screen with a manager's rights.
 */
export default async function TeamPage({ searchParams }: PageProps<"/[locale]/app/team">) {
  const locale = await getLocale();
  const t = team[locale];
  const params = await searchParams;
  const demoRole = parseDemoRole(params[DEMO_ROLE_PARAM]);
  const [viewer, myTeam, routing] = await Promise.all([getViewer(), getMyTeam(), getRoutingContext()]);
  const actor = actingRole(viewer.agent.role, demoRole);
  const at = now();
  const viewerId = viewer.agent.id;

  const banner = demoRole ? <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={teamHref(locale)} /> : null;
  const switcher = (
    <DemoRoleSwitcher
      locale={locale}
      viewerRole={viewer.agent.role}
      demoRole={demoRole}
      hrefFor={(role) => teamHref(locale, role)}
    />
  );

  if (!myTeam) {
    return (
      <div className="space-y-4">
        {banner}
        <PageHeader locale={locale} title={t.overview.title} className="mb-0" />
        <EmptyState
          icon={Users}
          title={t.overview.noTeam.title}
          description={t.overview.noTeam.text}
          action={<ButtonLink href={routingHref(locale, demoRole)}>{t.overview.noTeam.action}</ButtonLink>}
        />
        {switcher}
      </div>
    );
  }

  const teamIds = new Set(myTeam.team.memberIds);
  // Colleagues outside the team are agency records: shown when the role's reports reach the agency.
  const agencyReach = metricsCheck(actor, "agency").ok;
  const outside = agencyReach
    ? (
        await Promise.all(
          routing.agents.filter((agent) => !teamIds.has(agent.id)).map((agent) => getTeamMember(agent.id)),
        )
      ).filter((member): member is NonNullable<typeof member> => member !== undefined)
    : [];

  const inTeam = (member: TeamMemberView) => teamIds.has(member.agent.id);
  const checkFor = (member: TeamMemberView) =>
    metricsCheck(actor, memberOwnership({ isViewer: member.isViewer, inViewerTeam: inTeam(member) }));
  const everyone = [...myTeam.members, ...outside];
  const hidden = everyone.map(checkFor).find((check) => !check.ok);
  const ownVisible = myTeam.members.some((member) => member.isViewer && checkFor(member).ok);
  const colleaguesHidden = everyone.some((member) => !member.isViewer && !checkFor(member).ok);
  const teamTotals = metricsCheck(actor, "team").ok;
  const canDistribute = assignCheck(actor).ok || routingEditCheck(actor).ok;

  const names = Object.fromEntries(everyone.map((member) => [member.agent.id, member.agent.name]));
  const exceptions = teamExceptions({
    members: everyone,
    unassigned: routing.unassignedLeads,
    now: at,
    canSeeMetrics: (member) => checkFor(member).ok,
  });

  const subtitle = [
    format(t.overview.subtitle, {
      team: myTeam.team.name,
      organization: myTeam.organization?.name ?? t.overview.noOrganization,
    }),
    myTeam.team.branchName ? format(t.overview.branch, { name: myTeam.team.branchName }) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      {banner}
      <PageHeader
        locale={locale}
        title={t.overview.title}
        subtitle={subtitle}
        className="mb-0"
        actions={
          <>
            <ButtonLink href={routingHref(locale, demoRole)}>
              <Route aria-hidden className="size-4" />
              {t.overview.routing}
            </ButtonLink>
            <ButtonLink href={auditHref(locale, {}, demoRole)} variant="secondary">
              <ScrollText aria-hidden className="size-4" />
              {t.overview.audit}
            </ButtonLink>
          </>
        }
      >
        <p className="flex flex-wrap items-center gap-x-2 text-caption text-fg-muted">
          <time dateTime={at.toISOString()}>{format(t.snapshot, { time: formatDateTime(locale, at.toISOString()) })}</time>
          <a
            href={teamHref(locale, demoRole)}
            className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <RefreshCw aria-hidden className="size-3.5" />
            {t.refresh}
          </a>
        </p>
      </PageHeader>

      <ExceptionsPanel
        locale={locale}
        items={exceptions}
        names={names}
        now={at}
        hiddenNote={colleaguesHidden}
        links={{
          viewerId,
          distributeHref: canDistribute ? routingHref(locale, demoRole, "simulator") : undefined,
          inboxHref: appHref(locale, "leads"),
          myUrgentHref: `${appHref(locale, "leads")}?sla=urgent`,
          memberHref: (agentId) => memberHref(locale, agentId, demoRole),
        }}
      />

      <section aria-labelledby="team-members" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="team-members" className="text-h2 text-fg">
            {t.overview.members}
          </h2>
          <p className="text-small text-fg-muted">
            {format(plural(locale, myTeam.members.length, t.overview.membersCount), { n: myTeam.members.length })}
          </p>
        </div>
        {hidden && !hidden.ok ? (
          <PermissionNote
            locale={locale}
            explanation={hidden.explanation}
            next={ownVisible ? t.overview.metricsDeniedNext : t.overview.auditNext}
            action={
              ownVisible ? (
                <ButtonLink href={memberHref(locale, viewerId, demoRole)} variant="secondary">
                  <UserRound aria-hidden className="size-4" />
                  {t.overview.myProfile}
                </ButtonLink>
              ) : (
                <ButtonLink href={auditHref(locale, {}, demoRole)} variant="secondary">
                  <ScrollText aria-hidden className="size-4" />
                  {t.overview.audit}
                </ButtonLink>
              )
            }
          />
        ) : null}
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {myTeam.members.map((member) => (
            <li key={member.agent.id}>
              <MemberCard
                locale={locale}
                member={member}
                now={at}
                metricsVisible={checkFor(member).ok}
                href={memberHref(locale, member.agent.id, demoRole)}
              />
            </li>
          ))}
        </ul>
      </section>

      {teamTotals ? (
        <section aria-labelledby="team-totals" className="space-y-3">
          <h2 id="team-totals" className="text-h2 text-fg">
            {t.overview.totals}
          </h2>
          <MetricsGrid locale={locale} metrics={myTeam.totals} />
          <MetricDefinitions locale={locale} />
        </section>
      ) : ownVisible ? (
        <MetricDefinitions locale={locale} />
      ) : null}

      {outside.length > 0 ? (
        <section aria-labelledby="team-outside" className="space-y-3">
          <div className="space-y-1">
            <h2 id="team-outside" className="text-h2 text-fg">
              {t.overview.outside}
            </h2>
            <p className="text-small text-fg-muted">{t.overview.outsideText}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {outside.map((member) => (
              <li key={member.agent.id}>
                <MemberCard
                  locale={locale}
                  member={member}
                  now={at}
                  metricsVisible={checkFor(member).ok}
                  href={memberHref(locale, member.agent.id, demoRole)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {switcher}
    </div>
  );
}
