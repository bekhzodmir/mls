import { UserRoundX } from "lucide-react";
import { partnersHref } from "@/components/app/partners/partner-model";
import { teamHref } from "@/components/app/team/team-model";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import partners from "@/i18n/messages/partners";
import { getLocale } from "@/i18n/server";

/**
 * Unknown partner, or a colleague's id (§23.5): one message for both,
 * pointing to the team for people of the viewer's own organization.
 */
export default async function PartnerNotFound() {
  const locale = await getLocale();
  const t = partners[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={UserRoundX}
        title={t.title}
        description={t.text}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={partnersHref(locale)}>{t.back}</ButtonLink>
            <ButtonLink href={teamHref(locale)} variant="secondary">
              {t.team}
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
