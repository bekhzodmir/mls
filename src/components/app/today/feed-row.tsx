import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Everything a feed row needs, so the same item can render as a list row
 * (whole row is a 44px+ link) or inside the "next step" card, where the
 * primary button carries the link instead.
 */
export interface FeedRowData {
  id: string;
  href?: string;
  icon: LucideIcon;
  title: ReactNode;
  /** Language of user-written text in the title (source data stays in its language). */
  lang?: string;
  lines?: ReactNode[];
  badges?: ReactNode;
  /** Bold title and a marker — for unread notifications and similar. */
  emphasis?: boolean;
}

export function FeedRow({ row, linked = true, className }: { row: FeedRowData; linked?: boolean; className?: string }) {
  const Icon = row.icon;
  const lines = row.lines?.filter(Boolean) ?? [];
  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted"
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p
          lang={row.lang}
          className={cn("text-small text-fg", row.emphasis ? "font-bold" : "font-semibold")}
        >
          {row.title}
        </p>
        {lines.length > 0 ? (
          <div className="space-y-0.5 text-caption text-fg-muted">
            {lines.map((line, index) => (
              <p key={index} className="line-clamp-2">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {row.badges ? <div className="flex flex-wrap gap-1.5 pt-0.5">{row.badges}</div> : null}
      </div>
      {linked && row.href ? <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-fg-subtle" /> : null}
    </div>
  );

  if (!linked || !row.href) return <div className={className}>{body}</div>;
  return (
    <Link
      href={row.href}
      className={cn(
        "block min-h-11 -outline-offset-2 transition-colors hover:bg-surface-muted/60",
        className,
      )}
    >
      {body}
    </Link>
  );
}

/** A divided list of rows inside a card. */
export function FeedList({ rows, label }: { rows: FeedRowData[]; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id}>
          <FeedRow row={row} />
        </li>
      ))}
    </ul>
  );
}
