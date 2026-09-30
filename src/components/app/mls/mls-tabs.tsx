import Link from "next/link";
import { Building, Network, UsersRound, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import mls from "@/i18n/messages/mls";
import { cn } from "@/lib/cn";
import { mlsHref, mlsTabs, type MlsParams, type MlsTab } from "./mls-params";

const tabIcon: Record<MlsTab, LucideIcon> = { base: Network, mine: Building, requests: UsersRound };

/**
 * MLS sections (§15.1): shared base, own listings, buyer requests. Listing
 * filters carry over between the two listing tabs; the requests tab has its
 * own content.
 */
export function MlsTabs({ locale, params }: { locale: Locale; params: MlsParams }) {
  const t = mls[locale].tabs;
  return (
    <nav aria-label={t.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 border-b border-border">
        {mlsTabs.map((tab) => {
          const Icon = tabIcon[tab];
          const active = params.tab === tab;
          const href =
            tab === "requests"
              ? mlsHref(locale, { tab })
              : mlsHref(locale, { ...(params.tab === "requests" ? {} : params), tab });
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-small font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
