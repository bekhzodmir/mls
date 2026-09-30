import { DealWorkspaceSkeleton } from "@/components/app/deals/skeletons";
import { getLocale } from "@/i18n/server";

export default async function DealLoading() {
  const locale = await getLocale();
  return <DealWorkspaceSkeleton locale={locale} />;
}
