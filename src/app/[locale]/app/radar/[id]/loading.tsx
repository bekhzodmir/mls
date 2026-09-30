import { DetailSkeleton } from "@/components/app/mls/list-skeleton";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";

export default async function RadarPostLoading() {
  const locale = await getLocale();
  return <DetailSkeleton label={radar[locale].loading} />;
}
