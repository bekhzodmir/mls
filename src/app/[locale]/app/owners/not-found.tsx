import { KeyRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import owners from "@/i18n/messages/owners";
import { getLocale } from "@/i18n/server";
import { appHref } from "@/lib/routes";

/**
 * Unknown owner, or one not linked to the viewer's organization (§23.5): the
 * same message for both, so the page does not reveal that the person exists.
 */
export default async function OwnerNotFound() {
  const locale = await getLocale();
  const t = owners[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={KeyRound}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={appHref(locale, "owners")}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
