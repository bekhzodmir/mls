"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { bottomNav, isActive } from "./nav-config";

/** Fixed thumb-zone navigation for phones (§20.2). Hidden on large screens. */
export function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = shell[locale].nav;

  return (
    <nav
      aria-label={t.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {bottomNav.map((item) => {
          const active =
            item.key === "today"
              ? item.match.some((prefix) => isActive(pathname, locale, prefix, prefix === ""))
              : item.match.some((prefix) => isActive(pathname, locale, prefix));
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={appPath(locale, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-caption font-medium transition-colors",
                  active ? "text-primary" : "text-fg-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.4 : 2} />
                <span>{t[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
