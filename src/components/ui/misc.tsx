import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-small font-semibold text-primary-soft-fg",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Selectable filter chip rendered as a link so filters live in the URL. */
export function ChipLink({
  active,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { active?: boolean; children: ReactNode }) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-small font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-fg"
          : "border-border bg-surface text-fg hover:bg-surface-muted",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Static, non-interactive chip for attributes (rooms, area, floor…). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-surface-muted px-2 py-1 text-caption font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

/** Visually hidden text for screen readers. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
