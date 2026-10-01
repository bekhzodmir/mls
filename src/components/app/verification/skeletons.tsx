import { Skeleton } from "@/components/ui/misc";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";

/**
 * Loading state of the Verification Center (§36.6): the same rhythm as the
 * screen — header, six summary tiles, three chip rows and fact cards — so
 * nothing jumps when the queue arrives.
 */
export async function VerificationQueueSkeleton() {
  const locale = await getLocale();
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">{leads[locale].loading}</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      ))}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-5 w-2/3" />
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, line) => (
                <Skeleton key={line} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
