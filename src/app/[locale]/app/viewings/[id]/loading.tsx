import { ViewingDetailSkeleton } from "@/components/app/viewings/skeletons";
import { getLocale } from "@/i18n/server";

export default async function ViewingLoading() {
  const locale = await getLocale();
  return <ViewingDetailSkeleton locale={locale} />;
}
