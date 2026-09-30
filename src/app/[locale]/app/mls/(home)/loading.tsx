import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import mls from "@/i18n/messages/mls";
import { getLocale } from "@/i18n/server";

export default async function MlsLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={mls[locale].loading} chipRows={1} cards={4} withAside />;
}
