import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";

export default async function TeamLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={team[locale].loading} chipRows={0} cards={3} />;
}
