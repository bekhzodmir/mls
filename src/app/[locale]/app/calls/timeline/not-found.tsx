import { UserRoundX } from "lucide-react";
import { callsHref } from "@/components/app/calls/call-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import calls from "@/i18n/messages/calls";
import { getLocale } from "@/i18n/server";

/**
 * Unknown person, or a colleague's contact (§19, §23.5): the same message
 * for both, so the page does not reveal that the record exists.
 */
export default async function TimelineNotFound() {
  const locale = await getLocale();
  const t = calls[locale].timeline.notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={UserRoundX}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={callsHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
