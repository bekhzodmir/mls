import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, UserRound } from "lucide-react";
import { propertyTitle } from "@/components/app/inventory/labels";
import { requirementDetailHref, targetFacts } from "@/components/app/matches/feed";
import { MatchCard } from "@/components/app/matches/match-card";
import { OriginalPhrase, RequirementCriteriaList } from "@/components/app/matches/requirement-view";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { format } from "@/i18n/define-messages";
import matchesScreen from "@/i18n/messages/matches-screen";
import requirementDetail from "@/i18n/messages/requirement-detail";
import { getLocale } from "@/i18n/server";
import { loadMatch } from "@/lib/data/cached";
import { appPath } from "@/lib/routes";


export async function generateMetadata({ params }: PageProps<"/[locale]/app/matches/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const match = await loadMatch(id);
  // The client's name stays out of the browser title (least exposure, §18.1).
  return { title: match ? propertyTitle(locale, targetFacts(match)) : matchesScreen[locale].meta.detail };
}

/**
 * One match in full (§12.4, §22.7): the card with every reason expanded,
 * next to the client's request it was matched against — hard and soft
 * criteria and the original phrase — so the agent can see exactly why.
 */
export default async function MatchPage({ params }: PageProps<"/[locale]/app/matches/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const match = await loadMatch(id);
  if (!match) notFound();

  const t = matchesScreen[locale].detail;
  const r = requirementDetail[locale];
  const target = propertyTitle(locale, targetFacts(match));
  const linkClass =
    "inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline";

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={format(t.title, { client: match.client.name, target })}
        backHref={appPath(locale, "/matches")}
        className="mb-0"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <section aria-label={t.target}>
          <MatchCard locale={locale} match={match} expanded linkTitle={false} headingLevel={2} showClient />
        </section>

        <section aria-labelledby="match-requirement">
          <Card className="space-y-4 p-4">
            <h2 id="match-requirement" className="flex items-center gap-2 text-h2 text-fg">
              <ClipboardList aria-hidden className="size-5 text-fg-muted" />
              {t.requirement}
            </h2>
            <RequirementCriteriaList locale={locale} requirement={match.requirement} compact />
            <div className="space-y-1">
              <h3 className="text-small font-semibold text-fg">{t.original}</h3>
              <OriginalPhrase locale={locale} requirement={match.requirement} />
            </div>
            <div className="flex flex-wrap gap-x-4">
              <Link href={appPath(locale, `/clients/${encodeURIComponent(match.client.id)}`)} className={linkClass}>
                <UserRound aria-hidden className="size-4" />
                {t.client}
              </Link>
              <Link href={requirementDetailHref(locale, match.requirement.id)} className={linkClass}>
                {t.shortlist}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <p className="text-caption text-fg-muted">{r.criteria.hardHint}</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
