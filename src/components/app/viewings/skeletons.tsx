import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import viewings from "@/i18n/messages/viewings";

/**
 * Loading states for the viewing routes (§23.2, §36.6): the same rhythm as
 * the real screens — header, chip rows, day headings and cards — so nothing
 * jumps when data arrives.
 */

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}

export function AgendaSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only" role="status">
        {viewings[locale].loading}
      </span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-11 w-full" />
      </div>
      {[5, 6].map((count) => (
        <div key={count} className="flex gap-2 overflow-hidden">
          {Array.from({ length: count }, (_, index) => (
            <Skeleton key={index} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      {[2, 2].map((cards, day) => (
        <div key={day} className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: cards }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ViewingDetailSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only" role="status">
        {viewings[locale].loading}
      </span>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
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

export function FormSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="max-w-2xl space-y-4">
      <span className="sr-only" role="status">
        {viewings[locale].loading}
      </span>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-48" />
    </div>
  );
}
