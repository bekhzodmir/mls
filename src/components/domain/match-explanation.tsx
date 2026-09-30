import { CircleCheck, CircleHelp, CircleMinus } from "lucide-react";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import matching from "@/i18n/messages/matching";
import { districtName } from "@/lib/domain/geo";
import { matchedCriteria } from "@/lib/domain/matching";
import { formatMoney } from "@/lib/domain/money";
import type { MatchReason } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

function list(locale: Locale, items: string[]): string {
  return formatList(locale, items);
}

/**
 * «Подходит по району, бюджету и комнатам» / «Tuman, byudjet va xonalar
 * bo‘yicha mos keladi» — the one-line match summary. The criteria come from
 * `matching.summaryCriterion` (dative case in Russian), not the nominative
 * `domain.criterion` labels.
 */
export function summarizeMatch(locale: Locale, reasons: MatchReason[]): string {
  const t = matching[locale];
  const criteria = matchedCriteria(reasons).map((c) => t.summaryCriterion[c]);
  return criteria.length > 0 ? capitalize(format(t.summary, { list: list(locale, criteria) })) : t.summaryNone;
}

/** Human sentence for one reason, or null when there is nothing worth saying. */
export function describeReason(locale: Locale, reason: MatchReason): string | null {
  const t = matching[locale].reason;
  const d = domain[locale];
  const detail = reason.detail;
  if (!detail) return null;
  switch (detail.kind) {
    case "price_over":
      return format(t.price_over, { amount: formatMoney(locale, detail.by) });
    case "price_under":
      return format(t.price_under, { amount: formatMoney(locale, detail.by) });
    case "price_within":
      return t.price_within;
    case "price_converted":
      return format(t.price_converted, { from: detail.from, to: detail.to });
    case "district_exact":
      return format(t.district_exact, { district: districtName(detail.district, locale) });
    case "district_adjacent":
      return format(t.district_adjacent, { district: districtName(detail.district, locale) });
    case "district_other":
      return format(t.district_other, { district: districtName(detail.district, locale) });
    case "rooms_off_by":
      return format(detail.delta > 0 ? t.rooms_more : t.rooms_fewer, { n: Math.abs(detail.delta) });
    case "area_off_by":
      return format(detail.deltaSqm > 0 ? t.area_more : t.area_less, { n: Math.abs(detail.deltaSqm) });
    case "floor_first":
      return t.floor_first;
    case "floor_last":
      return t.floor_last;
    case "floor_out_of_range":
      return format(t.floor_out_of_range, { n: detail.floor });
    case "building_kind_mismatch":
      return format(t.building_kind_mismatch, {
        actual: d.buildingKind[detail.actual],
        expected: d.buildingKind[detail.expected],
      });
    case "renovation_mismatch":
      return format(t.renovation_mismatch, { actual: d.renovation[detail.actual] });
    case "extras": {
      const parts: string[] = [];
      if (detail.matched.length) parts.push(format(t.extras_matched, { list: list(locale, detail.matched) }));
      if (detail.missing.length) parts.push(format(t.extras_missing, { list: list(locale, detail.missing) }));
      return parts.join(". ") || null;
    }
    case "missing_data":
      return format(t.missing_data, { criterion: d.criterion[reason.criterion] });
  }
}

/**
 * Full breakdown grouped into fits / differs / to clarify. Icons plus group
 * headings carry the meaning, so colour is only a secondary cue.
 */
export function MatchReasons({
  locale,
  reasons,
  className,
}: {
  locale: Locale;
  reasons: MatchReason[];
  className?: string;
}) {
  const t = matching[locale];
  const groups = [
    {
      key: "fits",
      title: t.group.fits,
      icon: CircleCheck,
      className: "text-success-fg",
      items: reasons.filter((r) => r.requested && r.outcome === "match"),
    },
    {
      key: "differs",
      title: t.group.differs,
      icon: CircleMinus,
      className: "text-warning-fg",
      items: reasons.filter((r) => r.outcome === "partial" || r.outcome === "mismatch"),
    },
    {
      key: "unknown",
      title: t.group.unknown,
      icon: CircleHelp,
      className: "text-fg-muted",
      items: reasons.filter((r) => r.outcome === "unknown"),
    },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-label={group.title}>
            <h3 className="mb-1 text-caption font-semibold uppercase tracking-wide text-fg-subtle">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((reason) => {
                const text = describeReason(locale, reason) ?? capitalize(domain[locale].criterion[reason.criterion]);
                const Icon = group.icon;
                return (
                  <li key={reason.criterion} className="flex items-start gap-2 text-small text-fg">
                    <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", group.className)} />
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
