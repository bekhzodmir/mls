import { publicContacts } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * The Binor mark: monogram tile plus the wordmark. Shared by the workspace
 * chrome and the public site; it has no client code, so the marketing pages
 * can use it without bundling the workspace navigation.
 */
export function BinorMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="inline-flex size-8 items-center justify-center rounded-md bg-linear-to-br from-brand-600 to-accent-500 text-small font-bold text-white"
      >
        B
      </span>
      <span className="text-body font-bold tracking-tight text-fg">{publicContacts.brand}</span>
    </span>
  );
}
