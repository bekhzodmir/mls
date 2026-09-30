import type { Metadata } from "next";
import { Handshake, Network, SearchX } from "lucide-react";
import { CooperationCard } from "@/components/app/mls/cooperation-card";
import {
  cooperationListHref,
  directions,
  filterCooperation,
  parseCooperationParams,
  statusGroups,
  type CooperationListParams,
} from "@/components/app/mls/cooperation-model";
import { mlsHref } from "@/components/app/mls/mls-params";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import cooperation from "@/i18n/messages/cooperation";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getViewer, listCooperation } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: cooperation[locale].meta.list };
}

/**
 * Cooperation list (§15.3, §36.3): incoming and outgoing co-broking
 * requests, the ones waiting for the viewer first, filterable by direction
 * and status in the URL.
 */
export default async function CooperationListPage({ searchParams }: PageProps<"/[locale]/app/mls/cooperation">) {
  const locale = await getLocale();
  const t = cooperation[locale].list;
  const params = parseCooperationParams(await searchParams);
  const [views, viewer] = await Promise.all([listCooperation(), getViewer()]);
  const visible = filterCooperation(views, params);
  const at = now();
  const filtered = Boolean(params.direction || params.status);
  const chip = (next: CooperationListParams) => cooperationListHref(locale, next);

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={t.subtitle}
        backHref={mlsHref(locale)}
        className="mb-0"
        actions={
          <ButtonLink href={mlsHref(locale)} variant="secondary">
            <Network aria-hidden className="size-4" />
            {t.toMls}
          </ButtonLink>
        }
      />

      <div className="space-y-2" aria-label={t.filters} role="group">
        <div role="group" aria-label={t.directionLabel} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-2">
            <li>
              <ChipLink href={chip({ ...params, direction: undefined })} active={!params.direction}>
                {t.direction.all}
              </ChipLink>
            </li>
            {directions.map((direction) => (
              <li key={direction}>
                <ChipLink href={chip({ ...params, direction })} active={params.direction === direction}>
                  {t.direction[direction]}
                </ChipLink>
              </li>
            ))}
          </ul>
        </div>
        <div role="group" aria-label={t.statusLabel} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-2">
            <li>
              <ChipLink href={chip({ ...params, status: undefined })} active={!params.status}>
                {t.status.all}
              </ChipLink>
            </li>
            {statusGroups.map((status) => (
              <li key={status}>
                <ChipLink href={chip({ ...params, status })} active={params.status === status}>
                  {t.status[status]}
                </ChipLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p role="status" className="text-body font-semibold text-fg">
        {format(plural(locale, visible.length, t.count), { n: visible.length })}
      </p>

      {visible.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title={t.emptyFilteredTitle}
            description={t.emptyFilteredText}
            action={<ButtonLink href={cooperationListHref(locale)}>{t.reset}</ButtonLink>}
          />
        ) : (
          <EmptyState
            icon={Handshake}
            title={t.emptyTitle}
            description={t.emptyText}
            action={<ButtonLink href={mlsHref(locale)}>{t.toMlsAction}</ButtonLink>}
          />
        )
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((view) => (
            <li key={view.request.id}>
              <CooperationCard locale={locale} view={view} viewerId={viewer.agent.id} now={at} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
