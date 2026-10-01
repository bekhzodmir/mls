import type { Metadata } from "next";
import { Handshake, Network, Search, SearchX, Users } from "lucide-react";
import { GetForm } from "@/components/app/mls/get-form";
import { PageHeader } from "@/components/app/page-header";
import { PartnerCard } from "@/components/app/partners/partner-card";
import { parsePartnerParams, partnerHref, partnersHref } from "@/components/app/partners/partner-model";
import { partnersCheck } from "@/components/app/team/access";
import { DemoRoleBanner, DemoRoleSwitcher } from "@/components/app/team/demo-role-banner";
import { actingRole, DEMO_ROLE_PARAM, parseDemoRole } from "@/components/app/team/demo-role";
import { PermissionNote } from "@/components/app/team/permission-note";
import { teamHref } from "@/components/app/team/team-model";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { format, plural } from "@/i18n/define-messages";
import partners from "@/i18n/messages/partners";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getViewer, listPartners } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: partners[locale].meta.list };
}

/**
 * Partners (screen 57, §5.6, §15): professionals outside the viewer's
 * organization, most recent interaction first, searchable by name, agency
 * or district (`?q=`). Contacts stay hidden until an accepted cooperation
 * with shared contacts (§18.2); facts are results only (§19).
 */
export default async function PartnersPage({ searchParams }: PageProps<"/[locale]/app/partners">) {
  const locale = await getLocale();
  const t = partners[locale].list;
  const raw = await searchParams;
  const params = parsePartnerParams(raw);
  const demoRole = parseDemoRole(raw[DEMO_ROLE_PARAM]);
  const viewer = await getViewer();
  const actor = actingRole(viewer.agent.role, demoRole);
  const access = partnersCheck(actor);
  const at = now();

  const banner = demoRole ? (
    <DemoRoleBanner locale={locale} demoRole={demoRole} exitHref={partnersHref(locale, params)} />
  ) : null;
  const switcher = (
    <DemoRoleSwitcher
      locale={locale}
      viewerRole={viewer.agent.role}
      demoRole={demoRole}
      hrefFor={(role) => partnersHref(locale, params, role)}
    />
  );

  if (!access.ok) {
    return (
      <div className="space-y-4">
        {banner}
        <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} className="mb-0" />
        <PermissionNote
          locale={locale}
          explanation={access.explanation}
          next={t.deniedNext}
          action={
            <ButtonLink href={teamHref(locale, demoRole)} variant="secondary">
              <Users aria-hidden className="size-4" />
              {t.toTeam}
            </ButtonLink>
          }
        />
        {switcher}
      </div>
    );
  }

  const items = await listPartners(params.q ? { q: params.q } : {});
  const action = partnersHref(locale);

  return (
    <div className="space-y-4">
      {banner}
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={t.subtitle}
        className="mb-0"
        actions={
          <ButtonLink href={appHref(locale, "cooperation")} variant="secondary">
            <Handshake aria-hidden className="size-4" />
            {t.toCooperation}
          </ButtonLink>
        }
      />

      <GetForm action={action} role="search" aria-label={t.search} className="space-y-1.5">
        <label htmlFor="partners-q" className="text-small font-semibold text-fg">
          {t.searchLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="partners-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            maxLength={80}
            placeholder={t.searchPlaceholder}
            className={inputClasses}
          />
          {demoRole ? <input type="hidden" name={DEMO_ROLE_PARAM} value={demoRole} /> : null}
          <Button type="submit">
            <Search aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{t.submit}</span>
          </Button>
        </div>
      </GetForm>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-body font-semibold text-fg">
          {format(plural(locale, items.length, t.count), { n: items.length })}
          {params.q ? <span className="font-normal text-fg-muted"> · {format(t.query, { q: params.q })}</span> : null}
        </p>
        {params.q ? (
          <ButtonLink href={partnersHref(locale, {}, demoRole)} variant="ghost">
            {t.reset}
          </ButtonLink>
        ) : null}
      </div>

      {items.length === 0 ? (
        params.q ? (
          <EmptyState
            icon={SearchX}
            title={t.emptyFilteredTitle}
            description={t.emptyFilteredText}
            action={<ButtonLink href={partnersHref(locale, {}, demoRole)}>{t.reset}</ButtonLink>}
          />
        ) : (
          <EmptyState
            icon={Handshake}
            title={t.emptyTitle}
            description={t.emptyText}
            action={
              <ButtonLink href={appHref(locale, "mls")}>
                <Network aria-hidden className="size-4" />
                {t.toMls}
              </ButtonLink>
            }
          />
        )
      ) : (
        <ul aria-label={t.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li key={item.agent.id}>
              <PartnerCard locale={locale} item={item} now={at} href={partnerHref(locale, item.agent.id, demoRole)} />
            </li>
          ))}
        </ul>
      )}

      {switcher}
    </div>
  );
}
