import { AgendaSkeleton } from "@/components/app/viewings/skeletons";
import { getLocale } from "@/i18n/server";

export default async function ViewingsLoading() {
  const locale = await getLocale();
  return <AgendaSkeleton locale={locale} />;
}
