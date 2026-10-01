import { CallListSkeleton } from "@/components/app/calls/skeletons";
import { getLocale } from "@/i18n/server";

export default async function CallsLoading() {
  const locale = await getLocale();
  return <CallListSkeleton locale={locale} />;
}
