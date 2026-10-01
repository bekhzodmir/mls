import type { Metadata } from "next";
import { ClipboardCheck, FilePen } from "lucide-react";
import { ConsentRow } from "@/components/app/consents/consent-row";
import {
  consentCounts,
  consentKey,
  consentListHref,
  consentPurposes,
  consentStates,
  consentSubjects,
  matchesConsentFilter,
  parseConsentFilters,
} from "@/components/app/consents/registry";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import consents from "@/i18n/messages/consents";
import domain from "@/i18n/messages/domain";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getViewer, listConsents } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: consents[locale].meta.title };
}

/**
 * Consent registry (§21.4 screen 40, §34.2 "Consent", §38.6 item 2): every
 * consent of the organization's clients and of the owners linked to its
 * listings or contracts — subject, purpose, channel, granted and revoked
 * dates, text version and the responsible agent; newest event first.
 * Filters: ?subject=client|owner, ?purpose=…, ?state=active|revoked.
 * Revoking is a demo action that records nothing on the server.
 */
export default async function ConsentsPage({ searchParams }: PageProps<"/[locale]/app/consents">) {
  const locale = await getLocale();
  const t = consents[locale];
  const d = domain[locale];
  const filter = parseConsentFilters(await searchParams);
  const [all, viewer] = await Promise.all([listConsents(), getViewer()]);
  const shown = all.filter((item) => matchesConsentFilter(item, filter));
  const filtered = Boolean(filter.subject || filter.purpose || filter.state);
  const nowIso = now().toISOString();
  // Each chip row counts within the other two filters, so a count is what the chip would show.
  const countFor = (next: typeof filter) => all.filter((item) => matchesConsentFilter(item, next)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={format(t.list.subtitle, consentCounts(all))}
        className="mb-0"
        actions={
          <ButtonLink href={appHref(locale, "contracts")} variant="secondary">
            <FilePen aria-hidden className="size-4" />
            {t.list.contracts}
          </ButtonLink>
        }
      >
        <p className="text-caption text-fg-muted">{t.list.note}</p>
      </PageHeader>

      {all.length > 0 ? (
        <div className="space-y-2">
          <ChipRow label={t.filters.subject}>
            <li>
              <ChipLink href={consentListHref(locale, { ...filter, subject: undefined })} active={!filter.subject}>
                {t.filters.allSubjects} <ChipCount n={countFor({ ...filter, subject: undefined })} />
              </ChipLink>
            </li>
            {consentSubjects.map((code) => (
              <li key={code}>
                <ChipLink href={consentListHref(locale, { ...filter, subject: code })} active={filter.subject === code}>
                  {t.filters[code]} <ChipCount n={countFor({ ...filter, subject: code })} />
                </ChipLink>
              </li>
            ))}
          </ChipRow>
          <ChipRow label={t.filters.purpose}>
            <li>
              <ChipLink href={consentListHref(locale, { ...filter, purpose: undefined })} active={!filter.purpose}>
                {t.filters.allPurposes} <ChipCount n={countFor({ ...filter, purpose: undefined })} />
              </ChipLink>
            </li>
            {consentPurposes.map((code) => (
              <li key={code}>
                <ChipLink href={consentListHref(locale, { ...filter, purpose: code })} active={filter.purpose === code}>
                  {d.consentPurpose[code]} <ChipCount n={countFor({ ...filter, purpose: code })} />
                </ChipLink>
              </li>
            ))}
          </ChipRow>
          <ChipRow label={t.filters.state}>
            <li>
              <ChipLink href={consentListHref(locale, { ...filter, state: undefined })} active={!filter.state}>
                {t.filters.allStates} <ChipCount n={countFor({ ...filter, state: undefined })} />
              </ChipLink>
            </li>
            {consentStates.map((code) => (
              <li key={code}>
                <ChipLink href={consentListHref(locale, { ...filter, state: code })} active={filter.state === code}>
                  {t.filters[code]} <ChipCount n={countFor({ ...filter, state: code })} />
                </ChipLink>
              </li>
            ))}
          </ChipRow>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <>
          <p role="status" className="text-body font-semibold text-fg">
            {format(plural(locale, shown.length, t.list.count), { n: shown.length })}
          </p>
          <ul aria-label={t.list.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((item) => (
              <li key={consentKey(item)}>
                <ConsentRow locale={locale} item={item} viewerId={viewer.agent.id} nowIso={nowIso} />
              </li>
            ))}
          </ul>
        </>
      ) : filtered && all.length > 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t.empty.filteredTitle}
          description={t.empty.filteredText}
          action={
            <ButtonLink href={consentListHref(locale)} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title={t.empty.title}
          description={t.empty.text}
          action={<ButtonLink href={appHref(locale, "clients")}>{t.empty.action}</ButtonLink>}
        />
      )}
    </div>
  );
}
