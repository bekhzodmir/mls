import { Skeleton } from "@/components/ui/misc";
import consents from "@/i18n/messages/consents";
import { getLocale } from "@/i18n/server";

/** Loading state of the consent registry (§23.2): header, three chip rows, rows of consents. */
export async function ConsentRegistrySkeleton() {
  const locale = await getLocale();
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">{consents[locale].loading}</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-11 w-full sm:w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
