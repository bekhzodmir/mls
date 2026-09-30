import { PageSkeleton } from "@/components/app/today/page-skeleton";
import { getLocale } from "@/i18n/server";

/** Today workspace skeleton; also the fallback for workspace screens without their own. */
export default async function WorkspaceLoading() {
  const locale = await getLocale();
  return <PageSkeleton locale={locale} chips={5} cards={4} />;
}
