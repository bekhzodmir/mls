import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import matchesScreen from "@/i18n/messages/matches-screen";
import { getLocale } from "@/i18n/server";
import { appPath } from "@/lib/routes";

/** A match that no longer exists: matches are recomputed from current data (§35.4 step 9). */
export default async function MatchNotFound() {
  const locale = await getLocale();
  const t = matchesScreen[locale].detail.notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={Sparkles}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={appPath(locale, "/matches")}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
