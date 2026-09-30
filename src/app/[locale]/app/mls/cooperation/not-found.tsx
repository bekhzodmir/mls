import { Handshake } from "lucide-react";
import { cooperationListHref } from "@/components/app/mls/cooperation-model";
import { mlsHref } from "@/components/app/mls/mls-params";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import cooperation from "@/i18n/messages/cooperation";
import { getLocale } from "@/i18n/server";

/**
 * Unknown or inaccessible request or listing (§23.5): one message for both,
 * so the page never reveals that a restricted listing exists.
 */
export default async function CooperationNotFound() {
  const locale = await getLocale();
  const t = cooperation[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={Handshake}
        title={t.title}
        description={t.text}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={cooperationListHref(locale)}>{t.back}</ButtonLink>
            <ButtonLink href={mlsHref(locale)} variant="secondary">
              {t.mls}
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
