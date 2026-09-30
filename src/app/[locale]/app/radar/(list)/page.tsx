import type { Metadata } from "next";
import { EyeOff, Radar as RadarIcon, SearchX, Upload } from "lucide-react";
import { PostCard } from "@/components/app/radar/post-card";
import { RadarFilters } from "@/components/app/radar/radar-filters";
import {
  hasRadarFilters,
  keepByStatus,
  parseRadarParams,
  radarHref,
  toTelegramFilter,
  type RadarParams,
} from "@/components/app/radar/radar-params";
import { SourceRegistry } from "@/components/app/radar/source-registry";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listTelegramListings, listTelegramSources } from "@/lib/data/repository";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: radar[locale].meta.list };
}

function NoPosts({ locale, params }: { locale: Locale; params: RadarParams }) {
  const t = radar[locale].empty;
  const importAction = (
    <ButtonLink href={appPath(locale, "/radar/import")} variant="secondary">
      <Upload aria-hidden className="size-4" />
      {t.importAction}
    </ButtonLink>
  );
  if (params.status === "hidden" && !params.district && !params.dealType && !params.q) {
    return <EmptyState icon={EyeOff} title={t.hiddenTitle} description={t.hiddenText} />;
  }
  if (hasRadarFilters(params)) {
    return (
      <EmptyState
        icon={SearchX}
        title={t.filteredTitle}
        description={t.filteredText}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={radarHref(locale)}>{t.resetAction}</ButtonLink>
            {importAction}
          </div>
        }
      />
    );
  }
  return <EmptyState icon={RadarIcon} title={t.noneTitle} description={t.noneText} action={importAction} />;
}

/**
 * Telegram Radar (§7.2, §13, §22.8): a professional work list, not an endless
 * feed — filters in the URL, one card per post with what the parser could
 * and could not read, and the original one tap away.
 */
export default async function RadarPage({ searchParams }: PageProps<"/[locale]/app/radar">) {
  const locale = await getLocale();
  const t = radar[locale];
  const params = parseRadarParams(await searchParams);
  const [views, sources] = await Promise.all([listTelegramListings(toTelegramFilter(params)), listTelegramSources()]);
  const posts = views.filter((view) => keepByStatus(view, params.status));
  const at = now();

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.list.title}
        subtitle={t.list.subtitle}
        className="mb-0"
        actions={
          <ButtonLink href={appPath(locale, "/radar/import")}>
            <Upload aria-hidden className="size-4" />
            {t.list.import}
          </ButtonLink>
        }
      />

      <RadarFilters locale={locale} params={params} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <p role="status" className="text-body font-semibold text-fg">
            {format(plural(locale, posts.length, t.list.count), { n: posts.length })}
          </p>
          {posts.length === 0 ? (
            <NoPosts locale={locale} params={params} />
          ) : (
            <ul className="grid gap-4">
              {posts.map((view) => (
                <li key={view.post.id}>
                  <PostCard locale={locale} view={view} now={at} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="lg:sticky lg:top-6">
          <SourceRegistry locale={locale} sources={sources} now={at} />
        </aside>
      </div>
    </div>
  );
}
