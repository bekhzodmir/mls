import { ArrowRight, CircleSlash, Coins, Filter, Wand2 } from "lucide-react";
import { listHref } from "@/components/app/today/links";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import search from "@/i18n/messages/search";
import { districtName } from "@/lib/domain/geo";
import { formatMoney } from "@/lib/domain/money";
import type { Range } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { choiceAmount, withCurrency, type QueryCriterion, type QueryInterpretation } from "./query-filters";

type Words = (typeof search)["ru"]["understood"];

function orList(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(intlLocale[locale], { type: "disjunction" }).format(items);
}

function range<T>(value: Range<T>, show: (item: T) => string, t: Words): string {
  const { min, max } = value;
  if (min !== undefined && max !== undefined) {
    const a = show(min);
    const b = show(max);
    return a === b ? a : format(t.range, { min: a, max: b });
  }
  if (min !== undefined) return format(t.from, { value: show(min) });
  if (max !== undefined) return format(t.upTo, { value: show(max) });
  return "";
}

/** Human value of one recognized criterion, e.g. «Чиланзар», «2», «до $70 000». */
export function criterionValue(locale: Locale, criterion: QueryCriterion): string {
  const t = search[locale].understood;
  const d = domain[locale];
  switch (criterion.kind) {
    case "dealType":
      return d.dealType[criterion.value];
    case "propertyType":
      return orList(locale, criterion.value.map((type) => d.propertyType[type]));
    case "district":
      return orList(locale, criterion.value.map((id) => districtName(id, locale)));
    case "rooms":
      return range(criterion.value, String, t);
    case "budget":
      return range(criterion.value, (money) => formatMoney(locale, money), t);
    case "amount":
      return range(criterion.value, (amount) => formatNumber(locale, amount), t);
    case "area":
      return format(t.sqm, { value: range(criterion.value, String, t) });
    case "floor": {
      const { notFirst, notLast, min, max } = criterion.value;
      const parts: string[] = [];
      if (notFirst) parts.push(t.floorNotFirst);
      if (notLast) parts.push(t.floorNotLast);
      const bounds = range({ min, max }, String, t);
      if (bounds) parts.push(bounds);
      return parts.join(", ");
    }
    case "buildingKind":
      return d.buildingKind[criterion.value];
    case "renovation":
      return orList(locale, criterion.value.map((state) => d.renovation[state]));
    case "mortgage":
      return criterion.value ? t.mortgageYes : t.mortgageNo;
    case "extras":
      return criterion.value.join(", ");
  }
}

/**
 * "Понял как …" (§9.3, §14.4): the structured reading of the query, what the
 * property-list link filters by, and an explicit currency choice when the
 * text named an amount without one (§35.5).
 */
export function UnderstoodPanel({ locale, interpretation }: { locale: Locale; interpretation: QueryInterpretation }) {
  const t = search[locale].understood;
  const { criteria, params, currencyChoice } = interpretation;
  const hasFilters = Object.keys(params).length > 0;
  const hasUnapplied = criteria.some((item) => !item.applied);

  return (
    <section aria-labelledby="search-understood">
      <Card className="space-y-3 p-4">
        <header className="space-y-1">
          <h2 id="search-understood" className="flex items-center gap-2 text-h2 text-fg">
            <Wand2 aria-hidden className="size-5 text-primary" />
            {t.title}
          </h2>
          <p className="text-caption text-fg-muted">{t.hint}</p>
        </header>

        <ul className="flex flex-wrap gap-2">
          {criteria.map(({ criterion, applied }) => {
            const Icon = applied ? Filter : CircleSlash;
            return (
              <li
                key={criterion.kind}
                title={applied ? undefined : t.notApplied}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-small",
                  applied
                    ? "border-primary/40 bg-primary-soft text-primary-soft-fg"
                    : "border-dashed border-border-strong bg-surface text-fg-muted",
                )}
              >
                <Icon aria-hidden className="size-3.5 shrink-0" />
                <span className="font-medium">{t.criterion[criterion.kind]}:</span>
                <span>{criterionValue(locale, criterion)}</span>
                {applied ? null : <span className="sr-only">({t.notApplied})</span>}
              </li>
            );
          })}
        </ul>

        {hasUnapplied ? <p className="text-caption text-fg-muted">{t.notAppliedNote}</p> : null}

        {currencyChoice ? (
          <Notice kind="warning" title={t.currencyTitle}>
            <p>{t.currencyText}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <ChipLink href={listHref(locale, "/properties", withCurrency(params, currencyChoice, "USD"))}>
                <Coins aria-hidden className="size-4" />
                {format(t.inUsd, { amount: formatMoney(locale, choiceAmount(currencyChoice, "USD")) })}
              </ChipLink>
              <ChipLink href={listHref(locale, "/properties", withCurrency(params, currencyChoice, "UZS"))}>
                <Coins aria-hidden className="size-4" />
                {format(t.inUzs, { amount: formatMoney(locale, choiceAmount(currencyChoice, "UZS")) })}
              </ChipLink>
            </div>
          </Notice>
        ) : null}

        {hasFilters ? (
          <ButtonLink href={listHref(locale, "/properties", params)} variant="soft" className="w-full sm:w-auto">
            {t.apply}
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        ) : null}
      </Card>
    </section>
  );
}
