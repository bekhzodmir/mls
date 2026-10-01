import type { Metadata } from "next";
import { History, Lock, ScrollText, SearchX, Users } from "lucide-react";
import { AuditFilters } from "@/components/app/audit/audit-filters";
import {
  actionOptions,
  actorOptions,
  auditHref,
  filterEvents,
  groupByDay,
  hasFilters,
  parseAuditParams,
  targetOptions,
  visibleEvents,
} from "@/components/app/audit/audit-model";
import { AuditRow } from "@/components/app/audit/audit-row";
import { ExportDemo } from "@/components/app/audit/export-demo";
import { PageHeader } from "@/components/app/page-header";
import { auditCheck, auditReach, exportCheck } from "@/components/app/team/access";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { PermissionNote } from "@/components/app/team/permission-note";
import { teamHref } from "@/components/app/team/team-model";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import { compareText, formatDateTime, formatDay } from "@/i18n/format";
import audit from "@/i18n/messages/audit";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getRoutingContext, getViewer, listAuditEvents } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: audit[locale].meta.title };
}

/**
 * Audit log (screen 99, §17.6, §18.1, §38.6 item 7, §39.3): an append-only
 * list, newest first, of who did what to which record and why. The role's
 * audit level (§19: agent "Own history", team lead "Team", owner "Agency",
 * administrator "Full org") decides which entries exist on the page at all;
 * filters live in the URL. Exporting is explained, not performed.
 */
export default async function AuditPage({ searchParams }: PageProps<"/[locale]/app/audit">) {
  const locale = await getLocale();
  const t = audit[locale];
  const raw = await searchParams;
  const params = parseAuditParams(raw);
  const demoRole = parseDemoRole(raw[DEMO_ROLE_PARAM]);
  const [viewer, events, routing] = await Promise.all([getViewer(), listAuditEvents(), getRoutingContext()]);
  const actor = actingRole(viewer.agent.role, demoRole);
  const at = now();
  const reach = auditReach(actor);
  const widest = reach.at(-1);
  const readable = visibleEvents(events, actor);
  const shown = filterEvents(readable, params);
  const filtered = hasFilters(params);
  const own = auditCheck(actor, "own");
  // The next level up that the role does not reach, if any: that is the right a refusal names.
  const wider = widest === "own" ? auditCheck(actor, "team") : widest === "team" ? auditCheck(actor, "agency") : undefined;
  const exportAccess = exportCheck(actor);
  const names = new Map(routing.agents.map((agent) => [agent.id, agent.name]));
  for (const view of readable) if (view.actor) names.set(view.actor.id, view.actor.name);
  const agentName = (id: string) => names.get(id);

  return (
    <div className="space-y-5">
      {demoRole ? (
        <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={auditHref(locale, params)} />
      ) : null}
      <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} className="mb-0">
        <p className="text-caption text-fg-muted">
          <time dateTime={at.toISOString()}>{format(t.snapshot, { time: formatDateTime(locale, at.toISOString()) })}</time>
        </p>
      </PageHeader>

      <Notice kind="info" title={t.appendOnly.title}>
        <span className="inline-flex items-start gap-1.5">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.appendOnly.text}
        </span>
      </Notice>

      {!own.ok ? (
        // No audit level at all for this role: the page shows the reason and no entries.
        <PermissionNote locale={locale} explanation={own.explanation} />
      ) : wider && !wider.ok ? (
        <PermissionNote
          locale={locale}
          explanation={wider.explanation}
          next={
            <>
              {widest ? t.reach[widest] : null} {widest === "own" ? t.ownOnlyNext : null}
            </>
          }
          action={
            widest === "own" ? (
              <ButtonLink href={teamHref(locale, demoRole)} variant="secondary">
                <Users aria-hidden className="size-4" />
                {team[locale].notFound.back}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <p className="flex items-start gap-1.5 text-small text-fg-muted">
          <History aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.reach.agency}
        </p>
      )}

      <ExportDemo
        locale={locale}
        visibleCount={readable.length}
        selfCanGrant={exportAccess.explanation.selfCanGrant}
        permission={<PermissionNote locale={locale} explanation={exportAccess.explanation} need={t.export.title} next={t.export.next} />}
      />

      {readable.length > 0 ? (
        <AuditFilters
          locale={locale}
          params={params}
          demoRole={demoRole}
          actors={actorOptions(readable, (a, b) => compareText(locale, a, b))}
          actions={actionOptions(readable)}
          targets={targetOptions(readable)}
        />
      ) : null}

      <p role="status" className="text-body font-semibold text-fg">
        {format(plural(locale, shown.length, t.count), { n: shown.length })}
      </p>

      {shown.length === 0 ? (
        filtered && readable.length > 0 ? (
          <EmptyState
            icon={SearchX}
            title={t.empty.filteredTitle}
            description={t.empty.filteredText}
            action={<ButtonLink href={auditHref(locale, {}, demoRole)}>{t.filters.reset}</ButtonLink>}
          />
        ) : (
          <EmptyState icon={ScrollText} title={t.empty.title} description={t.empty.text} />
        )
      ) : (
        <div aria-label={t.listLabel} role="region" className="space-y-5">
          {groupByDay(shown).map((group) => (
            <section key={group.day} aria-labelledby={`audit-day-${group.day}`} className="space-y-2">
              <h2 id={`audit-day-${group.day}`} className="text-small font-semibold text-fg-muted">
                {formatDay(locale, group.views[0].event.at)}
              </h2>
              <ol className="space-y-2">
                {group.views.map((view) => (
                  <AuditRow
                    key={`${view.log}-${view.event.id}`}
                    locale={locale}
                    view={view}
                    viewerId={viewer.agent.id}
                    agentName={agentName}
                    showScope={reach.length > 1}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <DemoRoleSwitcher
        locale={locale}
        viewerRole={viewer.agent.role}
        demoRole={demoRole}
        hrefFor={(role) => auditHref(locale, params, role)}
      />
    </div>
  );
}
