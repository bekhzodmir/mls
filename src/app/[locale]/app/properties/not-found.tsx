import { Building } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import properties from "@/i18n/messages/properties";
import { getLocale } from "@/i18n/server";
import { appPath } from "@/lib/routes";

/**
 * Unknown or inaccessible listing id (§23.5): the same message for both, so
 * the page does not reveal that a restricted listing exists.
 */
export default async function PropertyNotFound() {
  const locale = await getLocale();
  const t = properties[locale].detail.notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={Building}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={appPath(locale, "/properties")}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
