import { CardListSkeleton } from "@/components/app/inventory/list-skeleton";
import { getLocale } from "@/i18n/server";

export default async function MatchesLoading() {
  const locale = await getLocale();
  return <CardListSkeleton locale={locale} chipRows={2} cards={4} withPhoto={false} />;
}
