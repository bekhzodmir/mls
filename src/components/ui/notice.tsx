import { AlertTriangle, CircleAlert, Info, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Kind = "info" | "warning" | "danger" | "permission";

const styles: Record<Kind, { className: string; icon: LucideIcon }> = {
  info: { className: "bg-info-bg text-info-fg border-info-border", icon: Info },
  warning: { className: "bg-warning-bg text-warning-fg border-warning-border", icon: AlertTriangle },
  danger: { className: "bg-danger-bg text-danger-fg border-danger-border", icon: CircleAlert },
  permission: { className: "bg-surface-muted text-fg border-border", icon: Lock },
};

/**
 * Inline callout for human-readable errors, stale data, demo disclaimers and
 * permission explanations (§23.3, §23.5): say what happened, what is safe, and
 * what the user can do next.
 */
export function Notice({
  kind = "info",
  title,
  children,
  action,
  className,
}: {
  kind?: Kind;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { className: tone, icon: Icon } = styles[kind];
  return (
    <div
      role={kind === "danger" ? "alert" : "note"}
      className={cn("flex gap-3 rounded-md border p-3 text-small", tone, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="opacity-95">{children}</div> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
