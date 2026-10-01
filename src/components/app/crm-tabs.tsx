"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";
import { appPath, appRoutes } from "@/lib/routes";
import { isActive } from "./nav-config";

const tabs = [
  { key: "leads", href: appRoutes.leads },
  { key: "clients", href: appRoutes.clients },
  { key: "owners", href: appRoutes.owners },
  { key: "properties", href: appRoutes.properties },
  { key: "viewings", href: appRoutes.viewings },
  { key: "offers", href: appRoutes.offers },
  { key: "deals", href: appRoutes.deals },
  { key: "contracts", href: appRoutes.contracts },
] as const;

/**
 * Segmented navigation between CRM entities (§9.2). Eight tabs do not fit a
 * phone: the row scrolls horizontally (touch, trackpad, or Tab through the
 * links) without a visible scrollbar.
 */
export function CrmTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = shell[locale].crmTabs;

  return (
    <nav
      aria-label={t.label}
      className="-mx-4 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = isActive(pathname, locale, tab.href);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={appPath(locale, tab.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 px-3 text-small font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                {t[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
