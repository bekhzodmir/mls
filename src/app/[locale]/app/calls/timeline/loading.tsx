import { TimelineSkeleton } from "@/components/app/calls/skeletons";
import { getLocale } from "@/i18n/server";

export default async function TimelineLoading() {
  const locale = await getLocale();
  return <TimelineSkeleton locale={locale} />;
}
