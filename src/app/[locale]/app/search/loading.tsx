import { PageSkeleton } from "@/components/app/today/page-skeleton";
import { getLocale } from "@/i18n/server";

export default async function SearchLoading() {
  const locale = await getLocale();
  return <PageSkeleton locale={locale} chips={5} cards={2} rowsPerCard={4} />;
}
