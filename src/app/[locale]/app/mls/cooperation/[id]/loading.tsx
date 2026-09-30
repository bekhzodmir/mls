import { DetailSkeleton } from "@/components/app/mls/list-skeleton";
import cooperation from "@/i18n/messages/cooperation";
import { getLocale } from "@/i18n/server";

export default async function CooperationDetailLoading() {
  const locale = await getLocale();
  return <DetailSkeleton label={cooperation[locale].loading} />;
}
