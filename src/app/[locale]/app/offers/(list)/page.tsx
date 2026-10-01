import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { OfferCard } from "@/components/app/offers/offer-card";
import { offerCounts, offerListHref, offerStatuses, parseOfferStatus, sortOffers } from "@/components/app/offers/offer-list";
import { viewingListHref } from "@/components/app/viewings/agenda";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import offers from "@/i18n/messages/offers";
import { getLocale } from "@/i18n/server";
import { listOffers } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: offers[locale].meta.list };
}

/**
 * Offers (§21.4 screen 68, §22.11): every price offer on the viewer's
 * clients' behalf with the latest amount against the asking price (as
 * money), whose answer it waits for, whether that answer is overdue, the
 * status and the deal. Answers needed come first. Filter: ?status=….
 */
export default async function OffersPage({ searchParams }: PageProps<"/[locale]/app/offers">) {
  const locale = await getLocale();
  const t = offers[locale];
  const d = domain[locale];
  const status = parseOfferStatus(await searchParams);
  const all = await listOffers();
  const shown = sortOffers(status ? all.filter((view) => view.offer.status === status) : all);
  const counts = offerCounts(all);

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={format(t.list.subtitle, counts)}
        className="mb-0"
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {all.length > 0 ? (
        <ChipRow label={t.list.statusFilter}>
          <li>
            <ChipLink href={offerListHref(locale)} active={!status}>
              {t.list.all} <ChipCount n={all.length} />
            </ChipLink>
          </li>
          {offerStatuses.map((code) => (
            <li key={code}>
              <ChipLink href={offerListHref(locale, code)} active={status === code}>
                {d.offerStatus[code]} <ChipCount n={all.filter((view) => view.offer.status === code).length} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>
      ) : null}

      {shown.length > 0 ? (
        <>
          <div className="space-y-1">
            <p role="status" className="text-body font-semibold text-fg">
              {status ? `${d.offerStatus[status]} · ` : ""}
              {format(plural(locale, shown.length, t.list.count), { n: shown.length })}
            </p>
            <p className="text-caption text-fg-muted">{t.list.historyNote}</p>
          </div>
          <ul aria-label={t.list.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((view) => (
              <li key={view.offer.id}>
                <OfferCard locale={locale} view={view} />
              </li>
            ))}
          </ul>
        </>
      ) : status && all.length > 0 ? (
        <EmptyState
          icon={HandCoins}
          title={format(t.empty.filteredTitle, { status: d.offerStatus[status] })}
          description={t.empty.filteredText}
          action={
            <ButtonLink href={offerListHref(locale)} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={HandCoins}
          title={t.empty.title}
          description={t.empty.text}
          action={<ButtonLink href={viewingListHref(locale)}>{t.empty.action}</ButtonLink>}
        />
      )}
    </div>
  );
}
