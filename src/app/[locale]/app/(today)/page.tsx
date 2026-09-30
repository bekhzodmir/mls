import type { Metadata } from "next";
import { Building, CircleCheckBig, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchForm } from "@/components/app/search/search-form";
import { firstName } from "@/components/app/today/labels";
import { listHref } from "@/components/app/today/links";
import { dayPeriod, nextStep, planTodayBlocks } from "@/components/app/today/today-plan";
import {
  NextStepCard,
  OnboardingChecklist,
  QuickActions,
  TodayBlockSection,
  type OnboardingProgress,
} from "@/components/app/today/today-sections";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "@/i18n/define-messages";
import { formatDate, formatTime } from "@/i18n/format";
import today from "@/i18n/messages/today";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import {
  getTodayFeed,
  listClients,
  listListings,
  listRequirements,
  listTelegramSources,
} from "@/lib/data/repository";
import type { ViewerView } from "@/lib/data/views";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: today[locale].meta.title };
}

/** «среда, 30 сентября» → «Среда, 30 сентября» (CSS `capitalize` would touch every word). */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

async function onboardingProgress(viewer: ViewerView, clientCount: number): Promise<OnboardingProgress> {
  const [requirements, ownListings, sources] = await Promise.all([
    listRequirements(),
    listListings({ scope: "mine" }),
    listTelegramSources(),
  ]);
  return {
    profile:
      viewer.agent.professionalStatus !== "unconfirmed" &&
      viewer.agent.verifications.some((item) => item.status === "confirmed"),
    client: clientCount > 0,
    requirement: requirements.length > 0,
    property: ownListings.length > 0,
    radar: sources.some((source) => source.status === "enabled"),
  };
}

/**
 * Home / Today workspace (§9.4, §22.1, §36.2): what needs attention now,
 * most urgent first, with the next step one tap away. Every block leads to
 * the matching list with its filter already applied.
 */
export default async function TodayPage() {
  const locale = await getLocale();
  const t = today[locale];
  const at = now();
  const [feed, clients] = await Promise.all([getTodayFeed(), listClients()]);
  const blocks = planTodayBlocks(feed, at);
  const step = nextStep(blocks, at);
  const isNewUser = clients.length === 0;
  const progress = isNewUser ? await onboardingProgress(feed.viewer, clients.length) : undefined;

  const { agent, organization } = feed.viewer;
  const workplace = organization
    ? [organization.name, organization.branchName].filter(Boolean).join(" · ")
    : t.independent;

  return (
    <div className="space-y-5">
      <PageHeader
        locale={locale}
        title={format(t.greeting[dayPeriod(at)], { name: firstName(agent.name) })}
        subtitle={
          <>
            {workplace}
            <span aria-hidden> · </span>
            {capitalize(formatDate(locale, feed.generatedAt, { weekday: "long", day: "numeric", month: "long" }))}
            <span aria-hidden> · </span>
            {format(t.updatedAt, { time: formatTime(locale, feed.generatedAt) })}
          </>
        }
        className="mb-0"
      >
        <SearchForm locale={locale} compact id="today-search" />
      </PageHeader>

      <QuickActions locale={locale} />

      {progress ? <OnboardingChecklist locale={locale} progress={progress} /> : null}

      {step ? <NextStepCard locale={locale} step={step} at={at} /> : null}

      {blocks.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {blocks.map((block) => (
            <TodayBlockSection key={block.key} locale={locale} block={block} at={at} />
          ))}
        </div>
      ) : isNewUser ? null : (
        <EmptyState
          icon={CircleCheckBig}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={listHref(locale, "/matches")} variant="soft">
                <Sparkles aria-hidden className="size-4" />
                {t.empty.matches}
              </ButtonLink>
              <ButtonLink href={listHref(locale, "/properties/new")} variant="secondary">
                <Building aria-hidden className="size-4" />
                {t.empty.property}
              </ButtonLink>
            </div>
          }
        />
      )}
    </div>
  );
}
