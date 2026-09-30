import { House, Search, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import errors from "@/i18n/messages/errors";
import { getLocale } from "@/i18n/server";
import { appHref } from "@/lib/routes";

/**
 * Workspace 404 (§23.3, §23.5) for unknown paths and for records without a
 * screen-specific not-found. It keeps the navigation and "+" around it, and
 * does not say whether a record exists but belongs to someone else.
 */
export default async function WorkspaceNotFound() {
  const locale = await getLocale();
  const t = errors[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={SearchX}
        title={t.title}
        description={t.text}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={appHref(locale, "today")}>
              <House aria-hidden className="size-5" />
              {t.home}
            </ButtonLink>
            <ButtonLink href={appHref(locale, "search")} variant="secondary">
              <Search aria-hidden className="size-5" />
              {t.search}
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
