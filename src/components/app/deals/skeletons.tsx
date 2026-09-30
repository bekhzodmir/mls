import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import deals from "@/i18n/messages/deals";

/** Loading states for the deal routes (§23.2): same rhythm as the real screens. */

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

export function PipelineSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only" role="status">
        {deals[locale].loading}
      </span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="space-y-3 lg:hidden">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <div className="hidden gap-3 overflow-hidden lg:flex">
        {Array.from({ length: 4 }, (_, column) => (
          <div key={column} className="w-72 shrink-0 space-y-3 rounded-lg bg-surface-muted p-3">
            <Skeleton className="h-6 w-32" />
            <CardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DealWorkspaceSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only" role="status">
        {deals[locale].loading}
      </span>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-24 shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
