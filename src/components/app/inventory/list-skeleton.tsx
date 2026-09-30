import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import errors from "@/i18n/messages/errors";

/**
 * Stable-size placeholder for property and match lists (§23.2, §36.6): the
 * header, a chip row and cards shaped like the real ones, so nothing jumps
 * when results stream in. Announced once as "loading".
 */
export function CardListSkeleton({
  locale,
  chipRows = 2,
  cards = 4,
  withPhoto = true,
}: {
  locale: Locale;
  chipRows?: number;
  cards?: number;
  withPhoto?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{errors[locale].loading}</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/2 max-w-xs" />
        <Skeleton className="h-4 w-2/3 max-w-sm" />
      </div>
      {Array.from({ length: chipRows }, (_, row) => (
        <div key={row} className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, chip) => (
            <Skeleton key={chip} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, card) => (
          <div key={card} className="space-y-3 rounded-lg border border-border bg-surface p-3">
            <div className="flex gap-3">
              {withPhoto ? <Skeleton className="h-24 w-24 shrink-0 sm:w-32" /> : null}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
