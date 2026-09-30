import { PenLine } from "lucide-react";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import type { SplitSide } from "@/lib/domain/commission";
import { formatMoney } from "@/lib/domain/money";
import type { CommissionTerms } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import type { TermsLabels } from "./cooperation-labels";

function percentText(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

/** «Сторона объекта 70% · Сторона клиента 30%» — both roles always named (§35.6 step 3, §41 D2). */
export function sharesLine(terms: CommissionTerms, labels: TermsLabels): string {
  return [
    format(labels.terms.share, { role: labels.role.listing, percent: percentText(terms.listingSidePercent) }),
    format(labels.terms.share, { role: labels.role.buyer, percent: percentText(terms.buyerSidePercent) }),
  ].join(" · ");
}

/**
 * Commission split terms with explicit roles, basis, currency and payout
 * condition — never a bare "70/30". `changed` highlights what a version
 * altered (with an icon and text, not colour alone). Presentational: works
 * in server and client components.
 */
export function TermsSummary({
  locale,
  terms,
  labels,
  viewerSide,
  changed = [],
  compact = false,
  className,
}: {
  locale: Locale;
  terms: CommissionTerms;
  labels: TermsLabels;
  /** Marks the viewer's side as "вы". */
  viewerSide?: SplitSide;
  changed?: readonly (keyof CommissionTerms)[];
  compact?: boolean;
  className?: string;
}) {
  const t = labels.terms;
  const isChanged = (field: keyof CommissionTerms) => changed.includes(field);

  if (compact) {
    const parts = [sharesLine(terms, labels), labels.basis[terms.basis]];
    if (terms.basis === "fixed_amount" && terms.fixedAmount) parts.push(formatMoney(locale, terms.fixedAmount));
    parts.push(labels.payout[terms.payoutCondition]);
    return <p className={cn("text-small text-fg", className)}>{parts.join(" · ")}</p>;
  }

  const sides: { side: SplitSide; name: string; hint: string; percent: number; field: keyof CommissionTerms }[] = [
    {
      side: "listing",
      name: labels.role.listing,
      hint: labels.role.listingHint,
      percent: terms.listingSidePercent,
      field: "listingSidePercent",
    },
    {
      side: "buyer",
      name: labels.role.buyer,
      hint: labels.role.buyerHint,
      percent: terms.buyerSidePercent,
      field: "buyerSidePercent",
    },
  ];

  const rows: { field: keyof CommissionTerms; label: string; value: string }[] = [
    { field: "preset", label: t.preset, value: labels.preset[terms.preset] },
    { field: "basis", label: t.basis, value: labels.basis[terms.basis] },
  ];
  if (terms.basis === "fixed_amount" && terms.fixedAmount) {
    rows.push({ field: "fixedAmount", label: t.fixed, value: formatMoney(locale, terms.fixedAmount) });
  }
  rows.push({ field: "currency", label: t.currency, value: terms.currency });
  rows.push({ field: "payoutCondition", label: t.payout, value: labels.payout[terms.payoutCondition] });
  if (terms.payoutNote?.trim()) rows.push({ field: "payoutNote", label: t.payoutNote, value: terms.payoutNote });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((side) => (
          <div
            key={side.side}
            className={cn(
              "rounded-md border p-3",
              isChanged(side.field) ? "border-warning-border bg-warning-bg" : "border-border bg-surface-muted",
            )}
          >
            <p className="text-caption font-medium text-fg-muted">
              {side.name}
              {viewerSide === side.side ? ` (${labels.role.you})` : ""}
            </p>
            <p className="text-h2 tabular text-fg">{percentText(side.percent)}%</p>
            <p className="text-caption text-fg-muted">{side.hint}</p>
            {isChanged(side.field) ? <ChangedMark /> : null}
          </div>
        ))}
      </div>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.field}
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2",
              isChanged(row.field) && "-mx-2 rounded-sm bg-warning-bg px-2",
            )}
          >
            <dt className="text-small text-fg-muted">{row.label}</dt>
            <dd className="text-right text-small font-medium text-fg">
              {row.value}
              {isChanged(row.field) ? <ChangedMark inline /> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-fg-muted">{t.notBinorFee}</p>
    </div>
  );
}

/** Visual pointer to a changed value; the version header says in words what changed. */
function ChangedMark({ inline = false }: { inline?: boolean }) {
  return <PenLine aria-hidden className={cn("inline size-3.5 text-warning-fg", inline ? "ml-2" : "mt-1 block")} />;
}
