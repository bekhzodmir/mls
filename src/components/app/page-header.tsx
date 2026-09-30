import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";

/**
 * Screen title block for workspace pages. `backHref` renders a 44px back
 * control; `actions` sit on the right on desktop and wrap below on phones.
 */
export function PageHeader({
  locale,
  title,
  subtitle,
  backHref,
  actions,
  children,
  className,
}: {
  locale: Locale;
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 space-y-3", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-md px-2 text-small font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          <ChevronLeft aria-hidden className="size-5" />
          {shell[locale].back}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-h1 text-fg">{title}</h1>
          {subtitle ? <p className="text-small text-fg-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
