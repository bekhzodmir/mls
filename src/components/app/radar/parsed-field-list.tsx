import { CircleHelp } from "lucide-react";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import type { ParsedField, ParsedListingFields } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { ConfidenceMeter, type ConfidenceLabels } from "./confidence-meter";
import {
  confidenceLevel,
  formatParsedValue,
  relevantFields,
  type ParsedFieldKey,
  type ValueLabels,
} from "./parse-view";

export interface ParsedFieldListLabels {
  field: Record<ParsedFieldKey, string>;
  parsed: { unknown: string; unknownHint: string; ambiguousHint: string; lowHint: string; evidence: string };
  confidence: ConfidenceLabels;
  values: ValueLabels;
}

/**
 * Normalized fields of a post, each with its confidence and the verbatim
 * span it came from (§22.8 "raw vs normalized", §39.4). Unknown is shown as
 * a value — never hidden, never filled in (§35.5 step 4). A low-confidence
 * reading is shown as a hint but treated as Unknown, as matching does.
 */
export function ParsedFieldList({
  locale,
  parsed,
  labels,
  keys,
  highlightUnknown = false,
  className,
}: {
  locale: Locale;
  parsed: ParsedListingFields;
  labels: ParsedFieldListLabels;
  /** Defaults to the fields relevant for the post's property type. */
  keys?: readonly ParsedFieldKey[];
  /** Copilot: draw attention to what still needs asking. */
  highlightUnknown?: boolean;
  className?: string;
}) {
  const t = labels.parsed;
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {(keys ?? relevantFields(parsed)).map((key) => {
        const field = parsed[key] as ParsedField<unknown>;
        const level = confidenceLevel(field);
        const value = formatParsedValue(locale, parsed, key, labels.values);
        const usable = level === "high" || level === "medium";
        return (
          <div
            key={key}
            className={cn(
              "grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4",
              highlightUnknown && !usable && "-mx-2 rounded-md bg-warning-bg px-2 text-warning-fg",
            )}
          >
            <dt className={cn("text-small", highlightUnknown && !usable ? "font-medium" : "text-fg-muted")}>
              {labels.field[key]}
            </dt>
            <dd className="min-w-0 space-y-1">
              <p className="text-body font-semibold break-words">
                {usable && value ? (
                  value
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <CircleHelp aria-hidden className="size-4 shrink-0" />
                    {t.unknown}
                  </span>
                )}
              </p>
              {level === "none" ? null : (
                <ConfidenceMeter value={field.confidence} level={level} labels={labels.confidence} />
              )}
              {level === "low" && value ? (
                <p className="text-caption text-fg-muted">{format(t.lowHint, { value })}</p>
              ) : null}
              {field.evidence ? (
                <p className="text-caption text-fg-muted break-words">{format(t.evidence, { text: field.evidence })}</p>
              ) : null}
              {level === "none" ? (
                <p className="text-caption text-fg-muted">{field.evidence ? t.ambiguousHint : t.unknownHint}</p>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
