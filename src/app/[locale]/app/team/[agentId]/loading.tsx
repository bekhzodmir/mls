import { DetailSkeleton } from "@/components/app/mls/list-skeleton";
import team from "@/i18n/messages/team";
import { getLocale } from "@/i18n/server";

export default async function TeamMemberLoading() {
  const locale = await getLocale();
  return <DetailSkeleton label={team[locale].loading} />;
}
