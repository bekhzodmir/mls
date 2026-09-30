"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Ellipsis, GitMerge, SearchCheck, UserCog, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import clients from "@/i18n/messages/clients";
import { cn } from "@/lib/cn";
import { appHref } from "@/lib/routes";
import { stickyActionClasses } from "./layout-parts";

const itemClasses =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-small font-medium text-fg hover:bg-surface-muted";

/**
 * "Ещё" in the client's sticky bar (§14.3): less frequent actions. Links go
 * to real screens; reassignment and merging are demo-only and explain what
 * the working version would ask for (reason, audit, undo).
 */
export function ClientMoreMenu({ locale, clientId }: { locale: Locale; clientId: string }) {
  const t = clients[locale].profile;
  const details = useRef<HTMLDetailsElement>(null);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    const element = details.current;
    if (!element) return;
    const close = (event: Event) => {
      if (!element.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        element.open = false;
        element.querySelector("summary")?.focus();
        return;
      }
      if (!element.contains(event.target as Node)) element.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const query = `?clientId=${encodeURIComponent(clientId)}`;

  return (
    <details
      ref={details}
      className="relative flex min-w-0 flex-1 lg:flex-none"
      onToggle={(event) => {
        if (!event.currentTarget.open) setNotice(undefined);
      }}
    >
      <summary
        className={cn(
          stickyActionClasses,
          "cursor-pointer list-none border border-border bg-surface text-fg hover:bg-surface-muted [&::-webkit-details-marker]:hidden",
        )}
      >
        <Ellipsis aria-hidden className="size-5 lg:size-4" />
        {t.more}
      </summary>
      <div className="absolute right-0 bottom-full z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-2 shadow-float lg:top-full lg:bottom-auto lg:mt-2 lg:mb-0">
        {notice ? (
          <div role="status" className="space-y-2 p-2 text-small text-fg">
            <p>{notice}</p>
            <button type="button" className={itemClasses} onClick={() => setNotice(undefined)}>
              <X aria-hidden className="size-4" />
              {t.moreMenu.close}
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            <li>
              <Link href={`${appHref(locale, "requirementsNew")}${query}`} className={itemClasses}>
                <SearchCheck aria-hidden className="size-4 text-primary" />
                {t.moreMenu.requirement}
              </Link>
            </li>
            <li>
              <Link href={`${appHref(locale, "viewingsNew")}${query}`} className={itemClasses}>
                <CalendarPlus aria-hidden className="size-4 text-primary" />
                {t.moreMenu.viewing}
              </Link>
            </li>
            <li>
              <button type="button" className={itemClasses} onClick={() => setNotice(t.moreMenu.reassignDemo)}>
                <UserCog aria-hidden className="size-4 text-fg-muted" />
                {t.moreMenu.reassign}
              </button>
            </li>
            <li>
              <button type="button" className={itemClasses} onClick={() => setNotice(t.moreMenu.mergeDemo)}>
                <GitMerge aria-hidden className="size-4 text-fg-muted" />
                {t.moreMenu.merge}
              </button>
            </li>
          </ul>
        )}
      </div>
    </details>
  );
}
