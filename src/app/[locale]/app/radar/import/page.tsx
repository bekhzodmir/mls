import type { Metadata } from "next";
import { Copilot } from "@/components/app/radar/copilot";
import { copilotPool, duplicateListLabels, fieldListLabels } from "@/components/app/radar/labels";
import { convertHref, radarHref, radarPostHref } from "@/components/app/radar/radar-params";
import { PageHeader } from "@/components/app/page-header";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";
import { listListings, listTelegramListings } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: radar[locale].meta.import };
}

/**
 * Telegram Listing Copilot (§35.5): the server prepares what the pasted post
 * is compared against — listings and posts the viewer may see, with access
 * rules already applied — and the client parses as the agent types.
 */
export default async function RadarImportPage() {
  const locale = await getLocale();
  const t = radar[locale];
  const [posts, listings] = await Promise.all([listTelegramListings(), listListings()]);

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        backHref={radarHref(locale)}
        title={t.copilot.title}
        subtitle={t.copilot.subtitle}
        className="mb-0"
      />
      <Copilot
        locale={locale}
        t={t}
        fieldLabels={fieldListLabels(locale)}
        duplicateLabels={duplicateListLabels(locale)}
        pool={copilotPool(locale, posts, listings)}
        knownPosts={posts.map((view) => ({
          url: view.post.sourceUrl,
          id: view.post.id,
          source: view.source.title,
          detailHref: radarPostHref(locale, view.post.id),
          convertHref: convertHref(locale, view.post.id),
        }))}
      />
    </div>
  );
}
