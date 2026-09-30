import { format } from "@/i18n/define-messages";
import { formatMoneyRange } from "@/lib/domain/money";
import type { Locale } from "@/i18n/config";
import cooperation from "@/i18n/messages/cooperation";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import type { RequirementSummary } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import type { CommissionTerms, Range, RequirementCriterion, SplitPreset } from "@/lib/domain/types";
import { joinList } from "./listing-labels";

/**
 * Server-side label builders for the cooperation screens. Client components
 * receive these plain objects, so only one locale's strings reach the browser.
 */

export type CooperationMessages = (typeof cooperation)["ru"];

export interface TermsLabels {
  role: CooperationMessages["role"];
  terms: CooperationMessages["terms"];
  preset: Record<SplitPreset, string>;
  basis: Record<CommissionTerms["basis"], string>;
  payout: Record<CommissionTerms["payoutCondition"], string>;
}

export function termsLabels(locale: Locale): TermsLabels {
  const d = domain[locale];
  return {
    role: cooperation[locale].role,
    terms: cooperation[locale].terms,
    preset: d.splitPreset,
    basis: d.commissionBasis,
    payout: d.payoutCondition,
  };
}

/* -------------------------------------------------------------- criteria */

export interface CriteriaRow {
  key: "dealType" | "types" | "districts" | "rooms" | "area" | "budget" | "mustHave";
  label: string;
  value: string;
  /** The agent marked this criterion as a must-have (§35.4 step 3). */
  hard: boolean;
}

function rangeText(
  range: Range<number>,
  templates: { range: string; from: string; to: string },
  notSet: string,
): string {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) {
    return min === max ? String(min) : format(templates.range, { min, max });
  }
  if (min !== undefined) return format(templates.from, { n: min });
  if (max !== undefined) return format(templates.to, { n: max });
  return notSet;
}

/**
 * A buyer request as criteria rows (§15.3, §18.2): only what may be shared
 * before an agreement — never the client's name, phone or notes. Missing
 * criteria are named as "not set", never filled in.
 */
export function criteriaRows(locale: Locale, summary: RequirementSummary): CriteriaRow[] {
  const t = mls[locale].criteria;
  const d = domain[locale];
  const hard = new Set<RequirementCriterion>(summary.hardCriteria);
  const rows: CriteriaRow[] = [
    { key: "dealType", label: mls[locale].filters.deal, value: d.dealType[summary.dealType], hard: false },
    {
      key: "types",
      label: t.types,
      value: summary.propertyTypes.length
        ? joinList(
            locale,
            summary.propertyTypes.map((type) => d.propertyType[type]),
          )
        : t.any,
      hard: hard.has("property_type"),
    },
    {
      key: "districts",
      label: t.districts,
      value: summary.districts.length
        ? joinList(
            locale,
            summary.districts.map((id) => districtName(id, locale)),
          )
        : t.anyDistrict,
      hard: hard.has("location"),
    },
    {
      key: "rooms",
      label: t.rooms,
      value: rangeText(summary.rooms, { range: t.roomsRange, from: t.roomsFrom, to: t.roomsTo }, t.notSet),
      hard: hard.has("rooms"),
    },
    {
      key: "area",
      label: t.area,
      value: rangeText(summary.area, { range: t.areaRange, from: t.areaFrom, to: t.areaTo }, t.notSet),
      hard: hard.has("area"),
    },
    {
      key: "budget",
      label: t.budget,
      value: formatMoneyRange(locale, summary.budget, { from: t.from, to: t.to }) ?? t.notSet,
      hard: hard.has("price"),
    },
  ];
  if (summary.hardCriteria.length > 0) {
    rows.push({
      key: "mustHave",
      label: t.mustHave,
      value: joinList(
        locale,
        summary.hardCriteria.map((criterion) => domain[locale].requirementCriterion[criterion]),
      ),
      hard: false,
    });
  }
  return rows;
}

/** «Продажа · Квартира · Чиланзар · до $75 000» — one line that tells two requests of one client apart. */
export function requirementLine(
  locale: Locale,
  requirement: Pick<RequirementSummary, "dealType" | "propertyTypes" | "districts" | "budget">,
): string {
  const t = mls[locale].criteria;
  const d = domain[locale];
  const parts = [
    d.dealType[requirement.dealType],
    requirement.propertyTypes.length
      ? joinList(
          locale,
          requirement.propertyTypes.map((type) => d.propertyType[type]),
        )
      : undefined,
    requirement.districts.length
      ? joinList(
          locale,
          requirement.districts.map((id) => districtName(id, locale)),
        )
      : t.anyDistrict,
    formatMoneyRange(locale, requirement.budget, { from: t.from, to: t.to }),
  ];
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}
