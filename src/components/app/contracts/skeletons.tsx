import { Skeleton } from "@/components/ui/misc";
import contracts from "@/i18n/messages/contracts";
import { getLocale } from "@/i18n/server";

/**
 * Loading states for the contract routes (§23.2): header, search, two chip
 * rows and cards; or the status panel and the workspace sections — the same
 * rhythm as the real screens.
 */

async function LoadingLabel() {
  const locale = await getLocale();
  return <span className="sr-only">{contracts[locale].loading}</span>;
}

export async function ContractListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: 2 }, (_, row) => (
        <div key={row} className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-28" />
            </div>
            {Array.from({ length: 4 }, (_, line) => (
              <Skeleton key={line} className="h-4 w-3/4" />
            ))}
            <div className="flex gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-11 w-full sm:w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function ContractDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-16 w-full" />
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
