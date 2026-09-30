import Link from "next/link";
import { Building, CircleCheck, CircleMinus, Copy, Eye, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import type { DedupConflict, DuplicateRecommendation } from "@/lib/domain/dedup";
import type { DuplicateSignal } from "@/lib/domain/types";

/** One possible duplicate: a Telegram post or a listing in the base (Property ≠ Listing ≠ post). */
export interface DuplicateEntry {
  id: string;
  kind: "telegram" | "listing";
  title: string;
  subtitle?: string;
  href: string;
  signals: DuplicateSignal[];
  conflicts: DedupConflict[];
  recommendation?: DuplicateRecommendation;
}

export interface DuplicateListLabels {
  signals: string;
  conflicts: string;
  recommendation: Record<DuplicateRecommendation, string>;
  kind: Record<DuplicateEntry["kind"], string>;
  open: string;
  conflict: Record<DedupConflict, string>;
  signal: Record<DuplicateSignal, string>;
}

function joinList(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(items);
}

/**
 * Duplicate candidates with the signals that matched and the attributes that
 * disagree (§13.5, §34.5). A suggestion for a human decision, never a merge;
 * the score is not shown — the reasons are.
 */
export function DuplicateList({
  locale,
  entries,
  labels,
}: {
  locale: Locale;
  entries: DuplicateEntry[];
  labels: DuplicateListLabels;
}) {
  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const KindIcon = entry.kind === "telegram" ? Send : Building;
        return (
          <li key={`${entry.kind}-${entry.id}`} className="rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-caption font-medium text-fg-muted">
                <KindIcon aria-hidden className="size-3.5" />
                {labels.kind[entry.kind]}
              </span>
              {entry.recommendation ? (
                <Badge
                  tone={entry.recommendation === "likely_duplicate" ? "warning" : "neutral"}
                  icon={entry.recommendation === "likely_duplicate" ? Copy : Eye}
                >
                  {labels.recommendation[entry.recommendation]}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-small font-semibold text-fg">
              <Link href={entry.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                {entry.title}
              </Link>
            </p>
            {entry.subtitle ? <p className="text-caption text-fg-muted">{entry.subtitle}</p> : null}
            {entry.signals.length > 0 ? (
              <p className="mt-1 flex items-start gap-1.5 text-small text-fg">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-fg" />
                <span>
                  {format(labels.signals, {
                    list: joinList(
                      locale,
                      entry.signals.map((signal) => labels.signal[signal]),
                    ),
                  })}
                </span>
              </p>
            ) : null}
            {entry.conflicts.length > 0 ? (
              <p className="mt-1 flex items-start gap-1.5 text-small text-fg">
                <CircleMinus aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
                <span>
                  {format(labels.conflicts, {
                    list: joinList(
                      locale,
                      entry.conflicts.map((conflict) => labels.conflict[conflict]),
                    ),
                  })}
                </span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
