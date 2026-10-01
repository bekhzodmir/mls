import { ListSkeleton } from "@/components/app/mls/list-skeleton";
import audit from "@/i18n/messages/audit";
import { getLocale } from "@/i18n/server";

export default async function AuditLoading() {
  const locale = await getLocale();
  return <ListSkeleton label={audit[locale].loading} chipRows={2} cards={5} />;
}
