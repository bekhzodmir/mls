import { CalendarSearch } from "lucide-react";
import { viewingListHref } from "@/components/app/viewings/agenda";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import viewings from "@/i18n/messages/viewings";
import { getLocale } from "@/i18n/server";

/**
 * Unknown viewing, or one assigned to another agent (§23.5): the same
 * message for both, so the page does not reveal that the record exists.
 */
export default async function ViewingNotFound() {
  const locale = await getLocale();
  const t = viewings[locale].detail.notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={CalendarSearch}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={viewingListHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
