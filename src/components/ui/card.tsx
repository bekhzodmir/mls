import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-card", className)}
      {...props}
    />
  );
}

/** A whole card that navigates; keeps a visible focus ring and a 44px+ hit area. */
export function CardLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "block rounded-lg border border-border bg-surface shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  action,
  id,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-h2 text-fg">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Key/value row used in detail screens. Unknown values must be passed explicitly. */
export function Field({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="text-small font-medium text-fg text-right">{value}</dd>
    </div>
  );
}
