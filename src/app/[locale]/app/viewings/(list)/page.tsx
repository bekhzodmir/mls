import type { Metadata } from "next";
import { CalendarPlus, ListTodo } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { PageHeader } from "@/components/app/page-header";
import {
  filterViewings,
  groupByDay,
  needingAttention,
  newViewingHref,
  parseViewingListParams,
} from "@/components/app/viewings/agenda";
import { AgendaDays, ViewingCard, ViewingFilters, ViewingsEmpty, viewingCountText } from "@/components/app/viewings/agenda-view";
import { ButtonLink } from "@/components/ui/button";
import viewings from "@/i18n/messages/viewings";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listViewings } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: viewings[locale].meta.list };
}

/**
 * Viewing calendar (§14.8, §22.10, §36.3): an agenda grouped by Tashkent
 * day, filtered by period and status in the URL. Viewings that ended
 * without an outcome or a next step are pulled to the top whatever the
 * filter — the agent must not lose a client between meetings.
 */
export default async function ViewingsPage({ searchParams }: PageProps<"/[locale]/app/viewings">) {
  const locale = await getLocale();
  const t = viewings[locale].list;
  const params = parseViewingListParams(await searchParams);
  const at = now();
  const all = await listViewings();
  const shown = filterViewings(all, params, at);
  const days = groupByDay(shown, at);
  const attention = needingAttention(all, at);

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={t.subtitle}
        className="mb-0"
        actions={
          <ButtonLink href={newViewingHref(locale)}>
            <CalendarPlus aria-hidden className="size-4" />
            {t.add}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {attention.length > 0 ? (
        <section aria-labelledby="viewings-attention" className="space-y-3 rounded-lg border border-warning-border bg-warning-bg/40 p-4">
          <div className="space-y-1">
            <h2 id="viewings-attention" className="flex items-center gap-2 text-h2 text-fg">
              <ListTodo aria-hidden className="size-5 shrink-0 text-warning-fg" />
              {t.attention.title}
            </h2>
            <p className="text-small text-fg-muted">{t.attention.text}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {attention.map((view) => (
              <li key={view.viewing.id}>
                <ViewingCard locale={locale} view={view} all={all} now={at} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ViewingFilters locale={locale} params={params} />

      <p role="status" className="pt-1 text-body font-semibold text-fg">
        {viewingCountText(locale, shown.length)}
      </p>

      {days.length === 0 ? (
        <ViewingsEmpty locale={locale} params={params} />
      ) : (
        <AgendaDays locale={locale} days={days} all={all} now={at} />
      )}
    </div>
  );
}
