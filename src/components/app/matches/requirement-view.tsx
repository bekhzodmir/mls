import { Lock, Quote, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import requirementDetail from "@/i18n/messages/requirement-detail";
import type { Requirement } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { textLang } from "@/components/app/inventory/labels";
import { requirementCriteria } from "./requirement-criteria";

/**
 * What the client asked for, criterion by criterion, each marked
 * "Обязательно" (hard, with a lock icon) or "Пожелание" (soft) — the
 * distinction the matching engine applies (§35.4 step 3). Criteria the
 * requirement leaves open are named, not filled in.
 */
export function RequirementCriteriaList({
  locale,
  requirement,
  compact = false,
}: {
  locale: Locale;
  requirement: Requirement;
  compact?: boolean;
}) {
  const t = requirementDetail[locale].criteria;
  const { items, unset } = requirementCriteria(locale, requirement);
  return (
    <div className="space-y-2">
      <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
        {items.map((item) => (
          <li
            key={item.key}
            className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <span className="min-w-0 text-small">
              <span className="text-fg-muted">{t.label[item.key]}: </span>
              <span className="font-medium text-fg">{item.value}</span>
            </span>
            {item.hard ? (
              <Badge tone="brand" icon={Lock} title={item.key === "dealType" ? t.dealTypeHint : undefined}>
                {t.hard}
              </Badge>
            ) : (
              <Badge icon={SlidersHorizontal}>{t.soft}</Badge>
            )}
          </li>
        ))}
      </ul>
      {!compact ? <p className="text-caption text-fg-muted">{t.hardHint}</p> : null}
      {unset.length > 0 ? (
        <p className="text-caption text-fg-muted">
          {format(t.unset, {
            list: new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(
              unset.map((key) => t.label[key].toLocaleLowerCase(intlLocale[locale])),
            ),
          })}
          {compact ? null : ` ${t.unsetHint}`}
        </p>
      ) : null}
    </div>
  );
}

/** The agent's original sentence, verbatim and in its own language (§14.4, §34.3). */
export function OriginalPhrase({ locale, requirement }: { locale: Locale; requirement: Requirement }) {
  const t = requirementDetail[locale].original;
  const text = requirement.naturalLanguageInput?.trim();
  if (!text) return <p className="text-small text-fg-muted">{t.none}</p>;
  return (
    <figure className="space-y-1">
      <blockquote
        lang={textLang(text)}
        className="flex gap-2 rounded-md border-l-4 border-primary bg-surface-muted/70 px-3 py-2 text-body text-fg"
      >
        <Quote aria-hidden className="mt-1 size-4 shrink-0 text-fg-muted" />
        <span>{text}</span>
      </blockquote>
      <figcaption className="text-caption text-fg-muted">{t.hint}</figcaption>
    </figure>
  );
}
