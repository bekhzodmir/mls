import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import errors from "@/i18n/messages/errors";

/**
 * Stable-size placeholder for workspace screens while data streams in
 * (§23.2, §36.6): a header, an optional chip row and a few cards, so the
 * layout does not jump when content arrives. Announced once as "loading".
 */
export function PageSkeleton({
  locale,
  chips = 0,
  cards = 3,
  rowsPerCard = 3,
}: {
  locale: Locale;
  chips?: number;
  cards?: number;
  rowsPerCard?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{errors[locale].loading}</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
      </div>
      {chips > 0 ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: chips }, (_, index) => (
            <Skeleton key={index} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, card) => (
          <div key={card} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-5 w-1/3" />
            {Array.from({ length: rowsPerCard }, (_, row) => (
              <div key={row} className="flex items-start gap-3">
                <Skeleton className="size-9 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
