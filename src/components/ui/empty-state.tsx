import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Never leave a screen blank (§23.1): say what will appear here, and offer the
 * first step as a concrete action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="text-body font-semibold text-fg">{title}</p>
      {description ? <p className="max-w-sm text-small text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
