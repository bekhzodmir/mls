import Link from "next/link";
import { Briefcase, CalendarCheck, ListTodo, SearchX, UserRound, Users } from "lucide-react";
import { locationLine, typeLabel } from "@/components/app/inventory/labels";
import { MoneyText } from "@/components/domain/badges";
import { viewingListHref } from "@/components/app/viewings/agenda";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import type { DealView } from "@/lib/data/views";
import type { DealStage } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { DealStageBadge, MissingDocumentsBadge, MlsReportBadge, OverdueBadge } from "./deal-badges";
import { dealHref, dealListHref, headlinePrice, type StageGroup } from "./pipeline";

/**
 * Deal pipeline building blocks (§11.7, §22.12): stage chips with counts,
 * the per-deal card, the grouped list for phones and the horizontally
 * scrollable board for desktop. Server components.
 */

export function dealCountText(locale: Locale, n: number): string {
  return format(plural(locale, n, deals[locale].list.count), { n });
}

/** Stage filter as URL chips; the count tells the agent where deals pile up. */
export function StageChips({
  locale,
  groups,
  active,
  total,
}: {
  locale: Locale;
  groups: readonly StageGroup[];
  active?: DealStage;
  total: number;
}) {
  const t = deals[locale].list;
  return (
    <nav aria-label={t.stage.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2">
        <li>
          <ChipLink href={dealListHref(locale)} active={!active}>
            {t.stage.all}
            <span className="tabular opacity-75">{total}</span>
          </ChipLink>
        </li>
        {groups.map((group) => (
          <li key={group.stage}>
            <ChipLink href={dealListHref(locale, group.stage)} active={active === group.stage}>
              {domain[locale].dealStage[group.stage]}
              <span className="tabular opacity-75">{group.views.length}</span>
            </ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * One deal: property, client, agreed or asking price (labelled), stage,
 * next step with its due date, missing documents and partner (§22.12).
 */
export function DealCard({
  locale,
  view,
  compact = false,
  headingLevel = 3,
}: {
  locale: Locale;
  view: DealView;
  /** Board columns: fewer lines, same facts. */
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  const t = deals[locale].card;
  const { deal, listing, client, partner } = view;
  const price = headlinePrice(view);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const next = deal.nextAction;

  return (
    <Link
      href={dealHref(locale, deal.id)}
      className={cn(
        "block space-y-2 rounded-lg border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40",
        view.nextActionOverdue || view.mlsReport.state === "overdue" ? "border-danger-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="min-w-0 text-body font-semibold text-fg">
          {typeLabel(locale, listing.property)}
          <span className="block text-small font-normal text-fg-muted">{locationLine(locale, listing.property)}</span>
        </Heading>
        {compact ? null : <DealStageBadge locale={locale} stage={deal.stage} />}
      </div>

      <p className="text-small">
        <span className="text-fg-muted">{price.kind === "agreed" ? t.agreed : t.asking}: </span>
        <MoneyText locale={locale} value={price.value} className="font-semibold text-fg" />
      </p>

      <ul className="space-y-1 text-small">
        <li className="flex items-start gap-1.5 text-fg">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>{format(t.client, { name: client.name })}</span>
        </li>
        {partner ? (
          <li className="flex items-start gap-1.5 text-fg">
            <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span>{format(t.partner, { name: partner.name })}</span>
          </li>
        ) : null}
        <li className="flex items-start gap-1.5">
          <ListTodo aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          {next ? (
            <span className="min-w-0 text-fg">
              <span className="sr-only">{t.nextAction}: </span>
              {next.text}
              {next.dueAt ? (
                <span className="text-fg-muted"> · {format(t.due, { date: formatDateTime(locale, next.dueAt) })}</span>
              ) : null}
            </span>
          ) : (
            <span className="italic text-fg-muted">{t.noNextAction}</span>
          )}
        </li>
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {view.nextActionOverdue ? <OverdueBadge locale={locale} /> : null}
        <MissingDocumentsBadge locale={locale} count={view.missingRequiredDocuments} />
        <MlsReportBadge locale={locale} report={view.mlsReport} />
      </div>
      <span className="sr-only">{t.open}</span>
    </Link>
  );
}

/** Phones: deals grouped under stage headings, empty stages left out. */
export function DealStageList({ locale, groups }: { locale: Locale; groups: readonly StageGroup[] }) {
  return (
    <div className="space-y-6">
      {groups
        .filter((group) => group.views.length > 0)
        .map((group) => (
          <section key={group.stage} aria-labelledby={`stage-${group.stage}`} className="space-y-3">
            <h2 id={`stage-${group.stage}`} className="flex items-baseline justify-between gap-2 text-h2 text-fg">
              <span>{domain[locale].dealStage[group.stage]}</span>
              <span className="text-small font-normal text-fg-muted">{dealCountText(locale, group.views.length)}</span>
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {group.views.map((view) => (
                <li key={view.deal.id}>
                  <DealCard locale={locale} view={view} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** Desktop: one column per stage in pipeline order, scrolling sideways. */
export function DealBoard({ locale, groups }: { locale: Locale; groups: readonly StageGroup[] }) {
  const t = deals[locale].list;
  return (
    <div
      role="region"
      aria-label={t.board}
      tabIndex={0}
      className="-mx-8 overflow-x-auto px-8 pb-2 focus-visible:outline-offset-0"
    >
      <ol className="flex min-w-max items-start gap-3">
        {groups.map((group) => (
          <li
            key={group.stage}
            aria-labelledby={`column-${group.stage}`}
            className="w-72 shrink-0 space-y-3 rounded-lg bg-surface-muted p-3"
          >
            <h2 id={`column-${group.stage}`} className="flex items-center justify-between gap-2 text-small font-semibold text-fg">
              <span className="flex items-center gap-1.5">
                <DealStageBadge locale={locale} stage={group.stage} />
              </span>
              <span className="tabular text-fg-muted">{group.views.length}</span>
            </h2>
            {group.views.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-strong px-3 py-4 text-center text-caption text-fg-muted">
                {t.columnEmpty}
              </p>
            ) : (
              <ul className="space-y-3">
                {group.views.map((view) => (
                  <li key={view.deal.id}>
                    <DealCard locale={locale} view={view} compact headingLevel={3} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DealsEmpty({ locale, stage }: { locale: Locale; stage?: DealStage }) {
  const t = deals[locale].list;
  if (stage) {
    return (
      <EmptyState
        icon={SearchX}
        title={format(t.emptyStage.title, { stage: domain[locale].dealStage[stage] })}
        description={t.emptyStage.text}
        action={<ButtonLink href={dealListHref(locale)}>{t.emptyStage.reset}</ButtonLink>}
      />
    );
  }
  return (
    <EmptyState
      icon={Briefcase}
      title={t.empty.title}
      description={t.empty.text}
      action={
        <ButtonLink href={viewingListHref(locale)}>
          <CalendarCheck aria-hidden className="size-4" />
          {t.empty.action}
        </ButtonLink>
      }
    />
  );
}
