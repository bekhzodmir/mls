import type { Metadata } from "next";
import Form from "next/form";
import { KeyRound, Search, UserPlus, X } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { crmHref, firstParam, oneOf } from "@/components/app/crm/filters";
import { inputClasses } from "@/components/app/crm/form-controls";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { OwnerCard } from "@/components/app/owners/owner-card";
import { OWNER_SCOPES } from "@/components/app/owners/owner-model";
import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import owners from "@/i18n/messages/owners";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listOwners } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: owners[locale].meta.list };
}

/**
 * Owner list (§14.6, §21.4 #24): search by name, massif, landmark or
 * contract number (`?q=`, a GET form so the result is a shareable URL) and
 * whose owners (`?scope=own|agency`). Phones appear only where the viewer
 * may see them (§34.2); elsewhere the card says why.
 */
export default async function OwnersPage({ searchParams }: PageProps<"/[locale]/app/owners">) {
  const locale = await getLocale();
  const t = owners[locale];
  const params = await searchParams;
  const q = firstParam(params.q)?.slice(0, 80);
  const scope = oneOf(params.scope, OWNER_SCOPES);
  const at = now();

  const [all, matching] = await Promise.all([listOwners(), q ? listOwners({ q }) : listOwners()]);
  const shown = scope ? matching.filter((item) => item.scope === scope) : matching;
  const searchId = "owners-search";

  return (
    <>
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={format(t.list.subtitle, {
          total: all.length,
          own: all.filter((item) => item.scope === "own").length,
        })}
        actions={
          <ButtonLink href={appHref(locale, "ownersNew")}>
            <UserPlus aria-hidden className="size-4" />
            {t.list.add}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <div className="mb-4 space-y-3">
        <p className="text-small text-fg-muted">{t.list.intro}</p>

        <Form action={appHref(locale, "owners")} role="search" className="flex gap-2">
          <label htmlFor={searchId} className="sr-only">
            {t.list.searchLabel}
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            />
            <input
              id={searchId}
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t.list.searchPlaceholder}
              autoComplete="off"
              className={`${inputClasses} pl-9`}
            />
          </div>
          {scope ? <input type="hidden" name="scope" value={scope} /> : null}
          <Button type="submit" variant="secondary">
            {t.list.searchSubmit}
          </Button>
        </Form>

        {q ? (
          <p className="flex flex-wrap items-center gap-2 text-small text-fg-muted" aria-live="polite">
            {format(t.list.results, { n: shown.length })}
            <ButtonLink href={crmHref(locale, "/owners", { scope })} variant="ghost" className="h-11 px-2">
              <X aria-hidden className="size-4" />
              {t.list.searchReset}
            </ButtonLink>
          </p>
        ) : null}

        <ChipRow label={t.list.scopeFilter}>
          <li>
            <ChipLink href={crmHref(locale, "/owners", { q })} active={!scope}>
              {t.list.all} <ChipCount n={matching.length} />
            </ChipLink>
          </li>
          {OWNER_SCOPES.map((code) => (
            <li key={code}>
              <ChipLink href={crmHref(locale, "/owners", { scope: code, q })} active={scope === code}>
                {t.list.scope[code]} <ChipCount n={matching.filter((item) => item.scope === code).length} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>
      </div>

      {shown.length > 0 ? (
        <ul aria-label={t.list.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((item) => (
            <li key={item.owner.id}>
              <OwnerCard locale={locale} item={item} at={at} />
            </li>
          ))}
        </ul>
      ) : all.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={appHref(locale, "ownersNew")}>
              <UserPlus aria-hidden className="size-4" />
              {t.list.add}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={Search}
          title={t.empty.filteredTitle}
          description={t.empty.filteredText}
          action={
            <ButtonLink href={appHref(locale, "owners")} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
