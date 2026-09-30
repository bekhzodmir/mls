import type { Metadata } from "next";
import { CrmTabs } from "@/components/app/crm-tabs";
import { PageHeader } from "@/components/app/page-header";
import { groupByStage, parseDealStage } from "@/components/app/deals/pipeline";
import { DealBoard, DealCard, DealsEmpty, DealStageList, StageChips, dealCountText } from "@/components/app/deals/pipeline-view";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import { getLocale } from "@/i18n/server";
import { listDeals } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: deals[locale].meta.list };
}

/**
 * Deal pipeline (§11.7, §22.12). `?stage=` narrows to one stage on every
 * screen size. Without it, phones get the deals grouped under stage
 * headings and desktops a board with one column per stage, scrolling
 * sideways. Cards lead with what needs doing: next step, overdue, missing
 * documents, the MLS reporting window.
 */
export default async function DealsPage({ searchParams }: PageProps<"/[locale]/app/deals">) {
  const locale = await getLocale();
  const t = deals[locale].list;
  const stage = parseDealStage(await searchParams);
  const views = await listDeals();
  const groups = groupByStage(views);
  const shown = stage ? views.filter((view) => view.deal.stage === stage) : views;

  return (
    <div className="space-y-4">
      <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} className="mb-0">
        <CrmTabs locale={locale} />
      </PageHeader>

      {views.length > 0 ? <StageChips locale={locale} groups={groups} active={stage} total={views.length} /> : null}

      <p role="status" className="pt-1 text-body font-semibold text-fg">
        {stage ? `${domain[locale].dealStage[stage]} · ` : ""}
        {dealCountText(locale, shown.length)}
      </p>

      {shown.length === 0 ? (
        <DealsEmpty locale={locale} stage={views.length > 0 ? stage : undefined} />
      ) : stage ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((view) => (
            <li key={view.deal.id}>
              <DealCard locale={locale} view={view} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="lg:hidden">
            <DealStageList locale={locale} groups={groups} />
          </div>
          <div className="hidden lg:block">
            <DealBoard locale={locale} groups={groups} />
          </div>
        </>
      )}
    </div>
  );
}
