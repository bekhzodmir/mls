import { UserRoundX } from "lucide-react";
import { teamHref } from "@/components/app/team/team-model";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";
import { appHref } from "@/lib/routes";

/**
 * Unknown colleague, or an agent of another organization (§23.5): one
 * message for both, pointing to Partners for professionals outside.
 */
export default async function TeamNotFound() {
  const locale = await getLocale();
  const t = team[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={UserRoundX}
        title={t.title}
        description={t.text}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={teamHref(locale)}>{t.back}</ButtonLink>
            <ButtonLink href={appHref(locale, "partners")} variant="secondary">
              {t.partners}
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
