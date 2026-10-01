import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import calls from "@/i18n/messages/calls";

/**
 * Loading states for the call routes (§23.2, §36.6): the same rhythm as the
 * real screens — header, chips, day headings, cards and timeline rows — so
 * nothing jumps when data arrives.
 */

function LoadingLabel({ locale }: { locale: Locale }) {
  return (
    <span className="sr-only" role="status">
      {calls[locale].loading}
    </span>
  );
}

function CallCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 sm:w-32 sm:flex-none" />
        <Skeleton className="h-11 flex-1 sm:w-28 sm:flex-none" />
      </div>
    </div>
  );
}

function TimelineRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CallListSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel locale={locale} />
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      {[3, 2].map((cards, day) => (
        <div key={day} className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: cards }, (_, index) => (
              <CallCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CallDetailSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel locale={locale} />
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, column) => (
          <div key={column} className="space-y-4">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel locale={locale} />
      <Skeleton className="h-11 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <TimelineRowsSkeleton rows={4} />
      </div>
    </div>
  );
}
