import type { Metadata } from "next";
import Form from "next/form";
import { Search, UserPlus, Users, X } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { ClientCard, isOverdue } from "@/components/app/crm/client-card";
import { clientStatuses, crmHref, firstParam, oneOf } from "@/components/app/crm/filters";
import { inputClasses } from "@/components/app/crm/form-controls";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listClients } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: clients[locale].meta.title };
}

/**
 * Client list (§21.4 #17–18, §36.3): search by name or phone (a GET form, so
 * the result is a shareable URL), status chips, and cards with the
 * requirement summary, responsible agent, last contact and next step.
 */
export default async function ClientsPage({ searchParams }: PageProps<"/[locale]/app/clients">) {
  const locale = await getLocale();
  const t = clients[locale];
  const params = await searchParams;
  const status = oneOf(params.status, clientStatuses);
  const q = firstParam(params.q)?.slice(0, 80);
  const at = now();

  const [all, matching] = await Promise.all([listClients(), listClients({ q })]);
  const shown = status ? matching.filter((item) => item.client.status === status) : matching;
  const overdue = all.filter((item) => isOverdue(item.client.nextAction?.dueAt, at)).length;
  const searchId = "clients-search";

  return (
    <>
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={format(t.list.subtitle, { total: all.length, overdue })}
        actions={
          <ButtonLink href={appHref(locale, "clientsNew")}>
            <UserPlus aria-hidden className="size-4" />
            {t.list.add}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <div className="mb-4 space-y-3">
        <Form action={appHref(locale, "clients")} role="search" className="flex gap-2">
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
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <Button type="submit" variant="secondary">
            {t.list.searchSubmit}
          </Button>
        </Form>

        {q ? (
          <p className="flex flex-wrap items-center gap-2 text-small text-fg-muted" aria-live="polite">
            {format(t.list.results, { n: shown.length })}
            <ButtonLink href={crmHref(locale, "/clients", { status })} variant="ghost" className="h-11 px-2">
              <X aria-hidden className="size-4" />
              {t.list.searchReset}
            </ButtonLink>
          </p>
        ) : null}

        <ChipRow label={t.list.statusFilter}>
          <li>
            <ChipLink href={crmHref(locale, "/clients", { q })} active={!status}>
              {t.list.all} <ChipCount n={matching.length} />
            </ChipLink>
          </li>
          {clientStatuses.map((code) => (
            <li key={code}>
              <ChipLink href={crmHref(locale, "/clients", { status: code, q })} active={status === code}>
                {domain[locale].clientStatus[code]}{" "}
                <ChipCount n={matching.filter((item) => item.client.status === code).length} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>
      </div>

      {shown.length > 0 ? (
        <ul aria-label={t.list.listLabel} className="grid gap-3 lg:grid-cols-2">
          {shown.map((item) => (
            <li key={item.client.id}>
              <ClientCard locale={locale} item={item} at={at} />
            </li>
          ))}
        </ul>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={appHref(locale, "clientsNew")}>
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
            <ButtonLink href={appHref(locale, "clients")} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
