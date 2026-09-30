import { Skeleton } from "@/components/ui/misc";

/**
 * Stable-size placeholder for the Radar, MLS and cooperation lists (§23.2,
 * §36.6): a header, chip rows and cards shaped like the real ones, so the
 * layout does not jump when results stream in. Announced once to screen
 * readers with the screen's own loading text.
 */
export function ListSkeleton({
  label,
  chipRows = 2,
  cards = 4,
  withAside = false,
}: {
  label: string;
  chipRows?: number;
  cards?: number;
  withAside?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/2 max-w-xs" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </div>
      {Array.from({ length: chipRows }, (_, row) => (
        <div key={row} className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, chip) => (
            <Skeleton key={chip} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      <div className={withAside ? "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" : undefined}>
        <div className="grid gap-4">
          {Array.from({ length: cards }, (_, card) => (
            <div key={card} className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex gap-1.5">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-11 w-32" />
                <Skeleton className="h-11 w-24" />
              </div>
            </div>
          ))}
        </div>
        {withAside ? <Skeleton className="hidden h-64 lg:block" /> : null}
      </div>
    </div>
  );
}

/** Placeholder for a detail page: header, badges and two content columns (§23.2). */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-11 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
