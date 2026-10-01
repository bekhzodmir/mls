import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FilePen, Search, X } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { ContractCard } from "@/components/app/contracts/contract-card";
import {
  contractKinds,
  contractListHref,
  contractStatusFilters,
  displayStatus,
  issuesOf,
  parseContractListParams,
} from "@/components/app/contracts/contract-rules";
import { CleanGetForm } from "@/components/app/inventory/clean-get-form";
import { PageHeader } from "@/components/app/page-header";
import { Label } from "@/components/app/viewings/form-parts";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import contracts from "@/i18n/messages/contracts";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listContracts } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: contracts[locale].meta.list };
}

/**
 * Service contracts of the organization (§17.5, §35.2 row 8, §38.5): number,
 * kind, customer, property, period, display status and the issues the rules
 * find. Expiring first, then awaiting signature and drafts. Filters:
 * ?status= (display status, incl. `expiring`), ?kind=, ?q=.
 */
export default async function ContractsPage({ searchParams }: PageProps<"/[locale]/app/contracts">) {
  const locale = await getLocale();
  const t = contracts[locale];
  const params = parseContractListParams(await searchParams);
  const { status, kind, q } = params;
  const at = now();

  const [everything, matching] = await Promise.all([listContracts(), q ? listContracts({ q }) : undefined]);
  const all = matching ?? everything;
  const statusOf = new Map(all.map((view) => [view.contract.id, displayStatus(view, at)]));
  const byKind = kind ? all.filter((view) => view.contract.kind === kind) : all;
  const byStatus = status ? all.filter((view) => statusOf.get(view.contract.id) === status) : all;
  const shown = byKind.filter((view) => byStatus.includes(view));
  const issues = new Map(everything.map((view) => [view.contract.id, issuesOf(view)]));

  const summary = format(t.list.subtitle, {
    expiring: everything.filter((view) => displayStatus(view, at) === "expiring").length,
    awaiting: everything.filter((view) => view.contract.status === "awaiting_signature").length,
    issues: everything.filter((view) => (issues.get(view.contract.id)?.length ?? 0) > 0).length,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={summary}
        className="mb-0"
        actions={
          <ButtonLink href={appHref(locale, "consents")} variant="secondary">
            <ClipboardCheck aria-hidden className="size-4" />
            {t.list.consents}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {everything.length > 0 ? (
        <>
          <CleanGetForm action={contractListHref(locale)} aria-label={t.list.search} className="space-y-1.5">
            <Label htmlFor="contracts-q">{t.list.searchLabel}</Label>
            <div className="flex gap-2">
              <input
                id="contracts-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t.list.searchPlaceholder}
                autoComplete="off"
                className={inputClasses}
              />
              {status ? <input type="hidden" name="status" value={status} /> : null}
              {kind ? <input type="hidden" name="kind" value={kind} /> : null}
              <Button type="submit" variant="secondary">
                <Search aria-hidden className="size-4" />
                {t.list.searchSubmit}
              </Button>
            </div>
            {q ? (
              <Link
                href={contractListHref(locale, { status, kind })}
                className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
              >
                <X aria-hidden className="size-4" />
                {t.list.searchClear}
              </Link>
            ) : null}
          </CleanGetForm>

          <div className="space-y-2">
            <ChipRow label={t.list.statusFilter}>
              <li>
                <ChipLink href={contractListHref(locale, { kind, q })} active={!status}>
                  {t.list.all} <ChipCount n={byKind.length} />
                </ChipLink>
              </li>
              {contractStatusFilters.map((code) => (
                <li key={code}>
                  <ChipLink href={contractListHref(locale, { status: code, kind, q })} active={status === code}>
                    {t.status[code]}{" "}
                    <ChipCount n={byKind.filter((view) => statusOf.get(view.contract.id) === code).length} />
                  </ChipLink>
                </li>
              ))}
            </ChipRow>
            <ChipRow label={t.list.kindFilter}>
              <li>
                <ChipLink href={contractListHref(locale, { status, q })} active={!kind}>
                  {t.list.allKinds} <ChipCount n={byStatus.length} />
                </ChipLink>
              </li>
              {contractKinds.map((code) => (
                <li key={code}>
                  <ChipLink href={contractListHref(locale, { status, kind: code, q })} active={kind === code}>
                    {t.kind[code]} <ChipCount n={byStatus.filter((view) => view.contract.kind === code).length} />
                  </ChipLink>
                </li>
              ))}
            </ChipRow>
          </div>
        </>
      ) : null}

      {shown.length > 0 ? (
        <>
          <div className="space-y-1">
            <p role="status" className="text-body font-semibold text-fg">
              {q ? `${format(t.list.searchActive, { q })} · ` : ""}
              {format(plural(locale, shown.length, t.list.count), { n: shown.length })}
            </p>
            <p className="text-caption text-fg-muted">{t.list.order}</p>
          </div>
          <ul aria-label={t.list.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((view) => (
              <li key={view.contract.id}>
                <ContractCard locale={locale} view={view} issues={issues.get(view.contract.id) ?? []} now={at} />
              </li>
            ))}
          </ul>
        </>
      ) : everything.length > 0 ? (
        <EmptyState
          icon={FilePen}
          title={t.empty.filteredTitle}
          description={q ? `${format(t.list.searchActive, { q })}. ${t.empty.filteredText}` : t.empty.filteredText}
          action={
            <ButtonLink href={contractListHref(locale)} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={FilePen}
          title={t.empty.title}
          description={t.empty.text}
          action={<ButtonLink href={appHref(locale, "properties")}>{t.empty.action}</ButtonLink>}
        />
      )}
    </div>
  );
}
