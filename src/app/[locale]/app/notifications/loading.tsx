import { PageSkeleton } from "@/components/app/today/page-skeleton";
import { getLocale } from "@/i18n/server";

export default async function NotificationsLoading() {
  const locale = await getLocale();
  return <PageSkeleton locale={locale} chips={6} cards={3} rowsPerCard={4} />;
}
