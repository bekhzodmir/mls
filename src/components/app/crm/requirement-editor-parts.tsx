import Link from "next/link";
import { BadgeCheck, CircleHelp, Eye, PencilLine, RotateCcw, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { BandBadge, FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { describeReason, summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { formatList, formatNumber } from "@/i18n/format";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import editor from "@/i18n/messages/requirement-editor";
import { districtName } from "@/lib/domain/geo";
import type { RankedMatch } from "@/lib/domain/matching";
import { formatMoney } from "@/lib/domain/money";
import type { RequirementDraft } from "@/lib/domain/requirement-parser";
import type { ParsedField, RequirementCriterion } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import type { EditorCandidate } from "./editor-candidates";
import { FieldError, SegmentedRadio } from "./form-controls";
import { candidateLabel } from "./object-label";
import type { DraftKey } from "./requirement-form";
import { formatArea, formatBudget, formatRooms } from "./requirement-summary";

/**
 * Presentational pieces of the Requirement Editor. State lives in
 * `requirement-editor.tsx`; these only render it.
 */

function list(locale: Locale, items: string[]): string {
  return formatList(locale, items);
}

/** Human value of one parsed field, or undefined when the parser found none. */
export function parsedValueText(locale: Locale, draft: RequirementDraft, key: DraftKey): string | undefined {
  const d = domain[locale];
  const t = editor[locale].parsed;
  switch (key) {
    case "dealType":
      return draft.dealType.value && d.dealType[draft.dealType.value];
    case "propertyTypes":
      return (
        draft.propertyTypes.value &&
        list(
          locale,
          draft.propertyTypes.value.map((type) => d.propertyType[type]),
        )
      );
    case "districts":
      return (
        draft.districts.value &&
        list(
          locale,
          draft.districts.value.map((id) => districtName(id, locale)),
        )
      );
    case "rooms":
      return draft.rooms.value && formatRooms(locale, draft.rooms.value);
    case "area":
      return draft.area.value && formatArea(locale, draft.area.value);
    case "budget": {
      const budget = draft.budget.value;
      if (!budget) return undefined;
      if (budget.currency && (budget.min || budget.max)) return formatBudget(locale, budget);
      const amounts = [budget.amountsMinor.min, budget.amountsMinor.max]
        .filter((value): value is number => value !== undefined)
        .map((minor) => formatNumber(locale, minor / 100))
        .join(" – ");
      return format(t.budgetNoCurrency, { amount: amounts });
    }
    case "buildingKind":
      return draft.buildingKind.value && d.buildingKind[draft.buildingKind.value];
    case "renovation":
      return (
        draft.renovation.value &&
        list(
          locale,
          draft.renovation.value.map((state) => d.renovation[state]),
        )
      );
    case "floor": {
      const floor = draft.floor.value;
      if (!floor) return undefined;
      const parts: string[] = [];
      if (floor.notFirst) parts.push(t.floorNotFirst);
      if (floor.notLast) parts.push(t.floorNotLast);
      const range =
        floor.min !== undefined && floor.max !== undefined && floor.min === floor.max
          ? String(floor.min)
          : floor.min !== undefined || floor.max !== undefined
            ? `${floor.min ?? "…"}–${floor.max ?? "…"}`
            : undefined;
      if (range) parts.push(format(t.floorRange, { range }));
      return parts.join(", ");
    }
    case "mortgage":
      return draft.mortgage.value === undefined ? undefined : draft.mortgage.value ? t.mortgageYes : t.mortgageNo;
    case "extras":
      return draft.extras.value && draft.extras.value.join(", ");
  }
}

function ConfidenceBadge({ locale, confidence }: { locale: Locale; confidence: number }) {
  const t = editor[locale].parsed.confidence;
  const percent = `${Math.round(confidence * 100)}%`;
  if (confidence >= 0.85) {
    return (
      <Badge tone="success" icon={BadgeCheck}>
        {t.high} · {percent}
      </Badge>
    );
  }
  if (confidence >= 0.6) {
    return (
      <Badge tone="info" icon={Eye}>
        {t.medium} · {percent}
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={CircleHelp}>
      {t.low} · {percent}
    </Badge>
  );
}

export type ParsedRowState = "applied" | "amount_only" | "overridden" | "suggestion";

/** One line of «Что понял Binor»: value, confidence, evidence and what happened to it. */
export function ParsedRow({
  locale,
  label,
  value,
  field,
  state,
  onApply,
}: {
  locale: Locale;
  label: string;
  value: string;
  field: ParsedField<unknown>;
  state: ParsedRowState;
  onApply: () => void;
}) {
  const t = editor[locale].parsed;
  return (
    <li className="space-y-1.5 border-b border-border py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-small">
          <span className="text-fg-muted">{label}: </span>
          <span className="font-semibold text-fg">{value}</span>
        </p>
        <ConfidenceBadge locale={locale} confidence={field.confidence} />
      </div>
      {field.evidence ? (
        <p className="text-caption text-fg-muted">{format(t.evidence, { text: field.evidence })}</p>
      ) : null}
      {state === "suggestion" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-fg-muted">{t.lowHint}</span>
          <Button variant="soft" onClick={onApply} className="h-11">
            <Wand2 aria-hidden className="size-4" />
            {t.apply}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-caption font-medium text-fg-muted">
          {state === "overridden" ? (
            <PencilLine aria-hidden className="size-3.5" />
          ) : (
            <Sparkles aria-hidden className="size-3.5" />
          )}
          {state === "overridden" ? t.overridden : state === "amount_only" ? t.amountOnly : t.applied}
        </p>
      )}
    </li>
  );
}

/** Heading row of a criterion: legend-like title, optional reset and the must-have toggle. */
export function CriterionHeader({
  title,
  htmlFor,
  reset,
  children,
}: {
  title: ReactNode;
  htmlFor?: string;
  reset?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-small font-semibold text-fg">
          {title}
        </label>
      ) : (
        // The fieldset's legend names the group for assistive tech; this is its visible twin.
        <p aria-hidden className="text-small font-semibold text-fg">
          {title}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {reset}
        {children}
      </div>
    </div>
  );
}

export function ResetButton({ locale, onClick }: { locale: Locale; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-11 px-2 text-caption text-fg-muted">
      <RotateCcw aria-hidden className="size-3.5" />
      {editor[locale].fields.reset}
    </Button>
  );
}

/** «Обязательно / Желательно» for one criterion (§35.4 step 3). */
export function HardSoftToggle({
  locale,
  criterion,
  hard,
  onChange,
}: {
  locale: Locale;
  criterion: RequirementCriterion;
  hard: boolean;
  onChange: (hard: boolean) => void;
}) {
  const t = editor[locale];
  return (
    <SegmentedRadio<"hard" | "soft">
      name={`hard-${criterion}`}
      legend={format(t.hard.label, { criterion: domain[locale].requirementCriterion[criterion] })}
      legendClassName="sr-only"
      className="space-y-0"
      value={hard ? "hard" : "soft"}
      onChange={(value) => onChange(value === "hard")}
      options={[
        { value: "soft", label: t.hard.soft },
        { value: "hard", label: t.hard.hard },
      ]}
    />
  );
}

/** "От" / "До" number pair with a shared error line. */
export function RangeInputs({
  idPrefix,
  label,
  locale,
  min,
  max,
  onChange,
  error,
  inputMode = "numeric",
  suffix,
  numberMessage,
}: {
  idPrefix: string;
  label: string;
  locale: Locale;
  min: string;
  max: string;
  onChange: (next: { min: string; max: string }) => void;
  error?: "number" | "range";
  inputMode?: "numeric" | "decimal";
  suffix?: ReactNode;
  /** Replaces the generic "enter a number" error, e.g. with an amount example. */
  numberMessage?: string;
}) {
  const t = editor[locale].fields;
  const errorId = `${idPrefix}-error`;
  const input = (key: "min" | "max", value: string, word: string) => (
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={`${idPrefix}-${key}`} className="text-caption text-fg-muted">
        <span className="sr-only">{label}, </span>
        {word}
      </label>
      <input
        id={`${idPrefix}-${key}`}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange({ min, max, [key]: event.target.value })}
        className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-body text-fg tabular shadow-card placeholder:text-fg-subtle focus-visible:border-primary aria-invalid:border-danger-fg"
      />
    </div>
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        {input("min", min, t.from)}
        <span aria-hidden className="pb-3 text-fg-muted">
          –
        </span>
        {input("max", max, t.to)}
        {suffix}
      </div>
      {error ? (
        <FieldError id={errorId}>{error === "range" ? t.rangeError : (numberMessage ?? t.numberError)}</FieldError>
      ) : null}
    </div>
  );
}

/** One result of the live preview: band, object, price, source, freshness and reasons. */
export function ResultItem({
  locale,
  match,
  item,
}: {
  locale: Locale;
  match: RankedMatch;
  item: EditorCandidate | undefined;
}) {
  const t = editor[locale].results;
  const { candidate } = match;
  const title = candidateLabel(locale, candidate, item?.place);
  const facts: string[] = [];
  if (candidate.areaTotal !== undefined) facts.push(format(t.area, { n: candidate.areaTotal }));
  if (candidate.floor !== undefined) {
    facts.push(
      candidate.floorsTotal !== undefined
        ? format(t.floorOf, { floor: candidate.floor, total: candidate.floorsTotal })
        : format(t.floor, { floor: candidate.floor }),
    );
  }
  const differs = match.reasons
    .filter((reason) => reason.outcome === "partial" || reason.outcome === "mismatch")
    .map((reason) => describeReason(locale, reason))
    .filter((text): text is string => Boolean(text));
  const unknown = match.reasons
    .filter((reason) => reason.outcome === "unknown")
    .map((reason) => describeReason(locale, reason))
    .filter((text): text is string => Boolean(text));

  return (
    <article className="space-y-2 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <BandBadge locale={locale} band={match.band} score={match.score} />
        <SourceBadge locale={locale} source={candidate.source} />
        <FreshnessBadge locale={locale} freshness={match.freshness} />
      </div>
      <h3 className="text-body font-semibold text-fg">
        {item ? (
          <Link href={appPath(locale, item.path)} className="inline-flex min-h-11 items-center hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <p className="flex flex-wrap items-center gap-2 text-small">
        {candidate.price ? (
          <MoneyText locale={locale} value={candidate.price} className="font-semibold text-fg" />
        ) : (
          <span className="text-fg-muted">{t.unknownPrice}</span>
        )}
        {facts.map((fact) => (
          <Chip key={fact}>{fact}</Chip>
        ))}
      </p>
      <p className="flex items-start gap-1.5 text-small text-fg">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {summarizeMatch(locale, match.reasons)}
      </p>
      {differs.length > 0 ? (
        <p className="flex items-start gap-1.5 text-caption text-warning-fg">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {t.differs}: {differs.join("; ")}
          </span>
        </p>
      ) : null}
      {unknown.length > 0 ? (
        <p className="flex items-start gap-1.5 text-caption text-fg-muted">
          <CircleHelp aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {t.toClarify}: {unknown.join("; ")}
          </span>
        </p>
      ) : null}
    </article>
  );
}

/** Formats a typed amount for a quiet preview under the budget inputs ("= $100 000"). */
export function amountPreview(
  locale: Locale,
  minor: number | undefined,
  currency: "USD" | "UZS" | undefined,
): string | undefined {
  if (minor === undefined || !currency) return undefined;
  return formatMoney(locale, { amountMinor: minor, currency });
}
