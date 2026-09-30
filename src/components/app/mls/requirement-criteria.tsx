import { Asterisk } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CriteriaRow } from "./cooperation-labels";

/**
 * Buyer-request criteria as a definition list. Must-have criteria carry a
 * worded marker (icon + text). Presentational: server and client.
 */
export function RequirementCriteria({
  rows,
  mustHaveLabel,
  className,
}: {
  rows: CriteriaRow[];
  /** "Обязательно" — shown next to a must-have criterion. */
  mustHaveLabel: string;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
          <dt className="text-small text-fg-muted">{row.label}</dt>
          <dd className="text-right text-small font-medium text-fg">
            {row.value}
            {row.hard ? (
              <span className="ml-2 inline-flex items-center gap-0.5 text-caption font-medium text-primary-soft-fg">
                <Asterisk aria-hidden className="size-3" />
                {mustHaveLabel.toLocaleLowerCase()}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
