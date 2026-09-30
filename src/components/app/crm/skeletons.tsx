import { Skeleton } from "@/components/ui/misc";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";

/**
 * Loading states for CRM routes (§23.2, §36.6): skeletons with the same
 * rhythm as the real screen so nothing jumps when data arrives.
 */

async function LoadingLabel() {
  const locale = await getLocale();
  return <span className="sr-only">{leads[locale].loading}</span>;
}

export async function CrmListSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-11 w-full" />
      </div>
      {withSearch ? <Skeleton className="h-11 w-full" /> : null}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function CrmDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <LoadingLabel />
      <Skeleton className="h-11 w-24" />
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

export async function CrmFormSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      <LoadingLabel />
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16 w-full" />
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-44" />
    </div>
  );
}
