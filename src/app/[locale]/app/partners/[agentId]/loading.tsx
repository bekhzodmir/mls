import { DetailSkeleton } from "@/components/app/mls/list-skeleton";
import partners from "@/i18n/messages/partners";
import { getLocale } from "@/i18n/server";

export default async function PartnerLoading() {
  const locale = await getLocale();
  return <DetailSkeleton label={partners[locale].loading} />;
}
