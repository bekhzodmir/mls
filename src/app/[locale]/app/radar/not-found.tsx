import { SearchX } from "lucide-react";
import { radarHref } from "@/components/app/radar/radar-params";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";

/** Unknown post id under /radar (§23.3): say what happened and the safe way back. */
export default async function RadarNotFound() {
  const locale = await getLocale();
  const t = radar[locale].detail;
  return (
    <div className="py-6">
      <title>{t.notFoundTitle}</title>
      <EmptyState
        icon={SearchX}
        title={t.notFoundTitle}
        description={t.notFoundText}
        action={<ButtonLink href={radarHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
