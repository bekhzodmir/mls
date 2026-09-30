import { ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import requirementDetail from "@/i18n/messages/requirement-detail";
import { getLocale } from "@/i18n/server";
import { appPath } from "@/lib/routes";

/**
 * Unknown requirement, or another agent's (§23.5): one message for both, so
 * the page does not confirm that someone else's client request exists.
 */
export default async function RequirementNotFound() {
  const locale = await getLocale();
  const t = requirementDetail[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={ClipboardList}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={appPath(locale, "/matches")}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
