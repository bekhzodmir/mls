"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { isActive } from "./nav-config";

const tabs = [
  { key: "leads", href: "/leads" },
  { key: "clients", href: "/clients" },
  { key: "properties", href: "/properties" },
  { key: "viewings", href: "/viewings" },
  { key: "deals", href: "/deals" },
] as const;

/** Segmented navigation between CRM entities (§9.2). Scrolls horizontally on small screens. */
export function CrmTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = shell[locale].crmTabs;

  return (
    <nav aria-label={t.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = isActive(pathname, locale, tab.href);
          return (
            <li key={tab.key}>
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
