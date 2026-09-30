import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import cooperation from "@/i18n/messages/cooperation";
import { getLocale } from "@/i18n/server";

export default async function CooperationLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={cooperation[locale].loading} chipRows={2} cards={4} />;
}
