import { PipelineSkeleton } from "@/components/app/deals/skeletons";
import { getLocale } from "@/i18n/server";

export default async function DealsLoading() {
  const locale = await getLocale();
  return <PipelineSkeleton locale={locale} />;
}
