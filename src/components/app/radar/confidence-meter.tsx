import { CircleCheck, CircleDot, CircleHelp, TriangleAlert, type LucideIcon } from "lucide-react";
import { format } from "@/i18n/define-messages";
import { cn } from "@/lib/cn";
import { confidencePercent, type ConfidenceLevel } from "./parse-view";

const levelStyle: Record<ConfidenceLevel, { icon: LucideIcon; bar: string; text: string }> = {
  high: { icon: CircleCheck, bar: "bg-success-fg", text: "text-success-fg" },
  medium: { icon: CircleDot, bar: "bg-info-fg", text: "text-info-fg" },
  low: { icon: TriangleAlert, bar: "bg-warning-fg", text: "text-warning-fg" },
  none: { icon: CircleHelp, bar: "bg-fg-subtle", text: "text-fg-muted" },
};

export interface ConfidenceLabels {
  level: Record<ConfidenceLevel, string>;
  /** "Уверенность {n}%". */
  percent: string;
}

/**
 * Parse confidence as a bar plus text (§22.8): the percentage and a worded
 * level with an icon, so the meaning never rests on the bar colour alone.
 * Presentational only — usable from server and client components.
 */
export function ConfidenceMeter({
  value,
  level,
  labels,
  className,
}: {
  /** 0..1 */
  value: number;
  level: ConfidenceLevel;
  labels: ConfidenceLabels;
  className?: string;
}) {
  const style = levelStyle[level];
  const Icon = style.icon;
  const percent = level === "none" ? 0 : confidencePercent(value);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span aria-hidden className="block h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
        <span className={cn("block h-full rounded-full", style.bar)} style={{ width: `${percent}%` }} />
      </span>
      <span className={cn("inline-flex items-center gap-1 text-caption font-medium", style.text)}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {level === "none" ? labels.level.none : `${format(labels.percent, { n: percent })} · ${labels.level[level]}`}
      </span>
    </span>
  );
}
