"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { activeSidebarKey, sidebarGroups } from "./nav-config";

/**
 * Desktop navigation (≥1024px): the bottom bar's destinations plus the rest
 * of the workspace, in labelled sections. Each section is a list named by
 * its heading, so screen-reader users can jump between sections.
 */
export function Sidebar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = shell[locale];
  const activeKey = activeSidebarKey(pathname, locale);

  return (
    <nav aria-label={t.nav.label} className="hidden space-y-4 lg:block">
      {sidebarGroups.map((group) => {
        const headingId = `sidebar-group-${group.key}`;
        return (
          <div key={group.key}>
            <h2
              id={headingId}
              className="px-3 pb-1 text-caption font-semibold tracking-wide text-fg-subtle uppercase"
            >
              {t.sidebarGroups[group.key]}
            </h2>
            <ul aria-labelledby={headingId} className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.key === activeKey;
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={appPath(locale, item.href)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-md px-3 text-small font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary-soft-fg"
                          : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                      )}
                    >
                      <Icon aria-hidden className="size-5 shrink-0" />
                      <span className="min-w-0 truncate">{t.sidebar[item.key]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
