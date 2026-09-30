import { Briefcase } from "lucide-react";
import { dealListHref } from "@/components/app/deals/pipeline";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import deals from "@/i18n/messages/deals";
import { getLocale } from "@/i18n/server";

/**
 * Unknown deal, or one run by another agent (§23.5): the same message for
 * both, so the page does not reveal that the record exists.
 */
export default async function DealNotFound() {
  const locale = await getLocale();
  const t = deals[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={Briefcase}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={dealListHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
