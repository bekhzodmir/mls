"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { isActive, sidebarNav } from "./nav-config";

/** Desktop navigation (≥1024px). Same destinations as the bottom bar, flattened. */
export function Sidebar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = shell[locale];

  return (
    <nav aria-label={t.nav.label} className="hidden lg:block">
      <ul className="space-y-0.5">
        {sidebarNav.map((item) => {
          // The MLS entry should not light up while on its cooperation sub-page.
          const active =
            item.key === "mls"
              ? isActive(pathname, locale, item.href) && !isActive(pathname, locale, "/mls/cooperation")
              : isActive(pathname, locale, item.href, item.href === "");
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={appPath(locale, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-small font-medium transition-colors",
                  active ? "bg-primary-soft text-primary-soft-fg" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {t.sidebar[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
