import { Skeleton } from "@/components/ui/misc";
import offers from "@/i18n/messages/offers";
import { getLocale } from "@/i18n/server";

/**
 * Loading states for the offer routes (§23.2): the same rhythm as the real
 * screens — header, status chips, cards; or the state card and timeline —
 * so nothing jumps when data arrives.
 */

async function LoadingLabel() {
  const locale = await getLocale();
  return <span className="sr-only">{offers[locale].loading}</span>;
}

export async function OfferListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function OfferDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
