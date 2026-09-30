"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { isCurrentPage, sitePages, sitePath, type SitePage } from "./site-config";

/**
 * Links to every public page with `aria-current="page"` on the current one.
 * A client component only because the header persists across navigations and
 * must follow the pathname; labels arrive as props so the message catalogue
 * stays on the server.
 */
export function SiteNavLinks({
  locale,
  labels,
  orientation,
}: {
  locale: Locale;
  labels: Record<SitePage, string>;
  orientation: "horizontal" | "vertical";
}) {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";

  return (
    <ul className={horizontal ? "flex items-center gap-1" : "flex flex-col gap-1"}>
      {sitePages.map((page) => {
        const active = isCurrentPage(pathname, locale, page);
        return (
          <li key={page}>
            <Link
              href={sitePath(locale, page)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center rounded-md transition-colors",
                horizontal ? "h-11 px-3 text-small" : "h-12 px-4 text-body",
                // Weight changes with the background so the state is not colour-only.
                active
                  ? "bg-primary-soft font-semibold text-primary-soft-fg"
                  : "font-medium text-fg-muted hover:bg-surface-muted hover:text-fg",
              )}
            >
              {labels[page]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
