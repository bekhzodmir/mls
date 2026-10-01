import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { leadHref } from "@/components/app/crm/lead-card";
import { describeSla } from "@/components/app/crm/sla";
import { PageHeader } from "@/components/app/page-header";
import { assignCheck, memberOwnership, metricsCheck, routingEditCheck } from "@/components/app/team/access";
import { AvailabilityBadge } from "@/components/app/team/badges";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { PermissionNote } from "@/components/app/team/permission-note";
import { RoutingWorkspace, type QueueLead } from "@/components/app/team/routing-workspace";
import { availabilityState, memberHref, routingHref, teamHref } from "@/components/app/team/team-model";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";
import { getMyTeam, getRoutingContext, getViewer } from "@/lib/data/repository";
import { routingInputFromLead } from "@/lib/domain/routing";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: team[locale].meta.routing };
}

/**
 * Lead routing (screen 81, §14.2, §35.3 step 4, §36.5): who takes leads now,
 * the rules in the order they are tried, and a simulator that explains each
 * decision step by step. Rules can be edited (demo, not saved) by the roles
 * that distribute leads or own the CRM settings; everyone else sees them
 * read-only with the right that is missing explained. Assigning a lead by
 * hand needs a reason and is an audit event.
 */
export default async function RoutingPage({ searchParams }: PageProps<"/[locale]/app/team/routing">) {
  const locale = await getLocale();
  const t = team[locale];
  const demoRole = parseDemoRole((await searchParams)[DEMO_ROLE_PARAM]);
  const [viewer, context, myTeam] = await Promise.all([getViewer(), getRoutingContext(), getMyTeam()]);
  const actor = actingRole(viewer.agent.role, demoRole);
  const edit = routingEditCheck(actor);
  const assign = assignCheck(actor);
  const teamIds = new Set(myTeam?.team.memberIds ?? [viewer.agent.id]);
  const workloadVisible = context.agents
    .filter(
      (agent) =>
        metricsCheck(actor, memberOwnership({ isViewer: agent.id === viewer.agent.id, inViewerTeam: teamIds.has(agent.id) }))
          .ok,
    )
    .map((agent) => agent.id);
  const at = new Date(context.generatedAt);

  const queue: QueueLead[] = context.unassignedLeads.map((view) => {
    const item: QueueLead = {
      id: view.lead.id,
      source: view.lead.source,
      sla: describeSla(locale, view.lead, view.sla),
      input: routingInputFromLead(view.lead),
      href: leadHref(locale, view.lead.id),
    };
    if (view.lead.name) item.name = view.lead.name;
    return item;
  });

  return (
    <div className="space-y-6">
      {demoRole ? <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={routingHref(locale)} /> : null}
      <PageHeader
        locale={locale}
        backHref={teamHref(locale, demoRole)}
        title={t.routing.title}
        subtitle={t.routing.subtitle}
        className="mb-0"
      >
        <p className="text-caption text-fg-muted">
          <time dateTime={context.generatedAt}>
            {format(t.routing.simulator.snapshot, { time: formatDateTime(locale, context.generatedAt) })}
          </time>
        </p>
      </PageHeader>

      <section aria-labelledby="routing-agents" className="space-y-3">
        <div className="space-y-1">
          <h2 id="routing-agents" className="text-h2 text-fg">
            {t.routing.agentsTitle}
          </h2>
          <p className="text-small text-fg-muted">{t.routing.agentsText}</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {context.agents.map((agent, index) => {
            const workload = context.workload[index];
            const availability = context.availability[index];
            const showLoad = workloadVisible.includes(agent.id);
            return (
              <li key={agent.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                <Avatar name={agent.name} />
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={memberHref(locale, agent.id, demoRole)}
                    className="inline-flex min-h-11 items-center text-small font-semibold text-fg underline-offset-4 hover:underline"
                  >
                    {agent.name}
                  </Link>
                  <div className="flex flex-wrap gap-1.5">
                    <AvailabilityBadge locale={locale} state={availabilityState(availability, at)} />
                  </div>
                  <p className="text-caption text-fg-muted">
                    {showLoad
                      ? workload.remaining === 0
                        ? format(t.capacity.over, { used: workload.assignedToday, capacity: workload.capacity })
                        : format(t.capacity.left, { left: workload.remaining, capacity: workload.capacity })
                      : t.capacity.hidden}
                    {availability.specializations.length > 0
                      ? ` · ${formatList(
                          locale,
                          availability.specializations.map((type) => domain[locale].propertyType[type]),
                        )}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {!edit.ok ? (
        <PermissionNote locale={locale} explanation={edit.explanation} next={t.routing.editDeniedNext} />
      ) : null}

      <RoutingWorkspace
        locale={locale}
        rules={context.rules}
        availability={context.availability}
        workloadToday={context.workloadToday}
        roundRobinCursor={context.roundRobinCursor}
        generatedAt={context.generatedAt}
        agents={context.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          href: memberHref(locale, agent.id, demoRole),
        }))}
        workloadVisible={workloadVisible}
        queue={queue}
        canEdit={edit.ok}
        canAssign={assign.ok}
        assignDenied={
          assign.ok ? undefined : (
            <PermissionNote
              locale={locale}
              explanation={assign.explanation}
              next={t.routing.assign.deniedNext}
              action={
                <ButtonLink href={appHref(locale, "leads")} variant="secondary">
                  <Inbox aria-hidden className="size-4" />
                  {t.exceptions.actions.inbox}
                </ButtonLink>
              }
            />
          )
        }
      />

      <DemoRoleSwitcher
        locale={locale}
        viewerRole={viewer.agent.role}
        demoRole={demoRole}
        hrefFor={(role) => routingHref(locale, role)}
      />
    </div>
  );
}
