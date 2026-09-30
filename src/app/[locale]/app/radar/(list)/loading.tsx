import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";

export default async function RadarLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={radar[locale].loading} chipRows={2} cards={3} withAside />;
}
