import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";

export default async function RoutingLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={team[locale].loading} chipRows={1} cards={4} withAside />;
}
