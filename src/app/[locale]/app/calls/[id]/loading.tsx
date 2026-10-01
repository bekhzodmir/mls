import { CallDetailSkeleton } from "@/components/app/calls/skeletons";
import { getLocale } from "@/i18n/server";

export default async function CallLoading() {
  const locale = await getLocale();
  return <CallDetailSkeleton locale={locale} />;
}
