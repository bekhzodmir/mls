import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import partners from "@/i18n/messages/partners";
import { getLocale } from "@/i18n/server";

export default async function PartnersLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={partners[locale].loading} chipRows={0} cards={4} />;
}
