import { Skeleton } from "@/components/ui/misc";
import errors from "@/i18n/messages/errors";
import { getLocale } from "@/i18n/server";

/** Profile skeleton: header, hero and two section columns of stable height (§23.2). */
export default async function PropertyLoading() {
  const locale = await getLocale();
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{errors[locale].loading}</span>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-3/4 max-w-md" />
      <Skeleton className="h-4 w-1/2 max-w-sm" />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Skeleton className="h-36 rounded-none sm:h-52" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((column) => (
          <div key={column} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-6 w-1/3" />
            {Array.from({ length: 6 }, (_, row) => (
              <Skeleton key={row} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
