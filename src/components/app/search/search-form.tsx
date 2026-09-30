import Form from "next/form";
import { Search } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import search from "@/i18n/messages/search";
import { cn } from "@/lib/cn";
import { appHref } from "@/lib/routes";

/** Longest query the search screen reads; longer input is cut, not rejected. */
export const SEARCH_QUERY_MAX = 200;

/**
 * Global smart search box (§9.3). A GET form: the query lives in the URL
 * (`/app/search?q=…`), so results are server-rendered, shareable and work
 * before JavaScript loads. `compact` hides the visible label and hint for
 * the Today header; the label stays available to screen readers.
 */
export function SearchForm({
  locale,
  defaultValue,
  compact = false,
  id = "search-q",
  className,
}: {
  locale: Locale;
  defaultValue?: string;
  compact?: boolean;
  id?: string;
  className?: string;
}) {
  const t = search[locale].form;
  const hintId = `${id}-hint`;
  return (
    <Form action={appHref(locale, "search")} role="search" className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={compact ? "sr-only" : "block text-small font-semibold text-fg"}>
        {t.label}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-subtle"
          />
          <input
            id={id}
            name="q"
            type="search"
            defaultValue={defaultValue}
            placeholder={t.placeholder}
            aria-describedby={compact ? undefined : hintId}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={SEARCH_QUERY_MAX}
            className="h-12 w-full rounded-md border border-border-strong bg-surface pr-3 pl-10 text-body text-fg placeholder:text-fg-subtle"
          />
        </div>
        <button type="submit" className={buttonClasses("primary", "lg")}>
          {t.submit}
        </button>
      </div>
      {compact ? null : (
        <p id={hintId} className="text-caption text-fg-muted">
          {t.hint}
        </p>
      )}
    </Form>
  );
}
