import { Skeleton } from "@/components/ui/misc";
import errors from "@/i18n/messages/errors";
import { getLocale } from "@/i18n/server";

/** Form-shaped skeleton for "new property" (§23.2): sections with labelled fields. */
export default async function NewPropertyLoading() {
  const locale = await getLocale();
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{errors[locale].loading}</span>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-1/2 max-w-xs" />
      <Skeleton className="h-4 w-3/4 max-w-md" />
      {[3, 3, 2, 4].map((fields, section) => (
        <div key={section} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-6 w-1/3" />
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
