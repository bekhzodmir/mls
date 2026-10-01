import { FilePen } from "lucide-react";
import { contractListHref } from "@/components/app/contracts/contract-rules";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import contracts from "@/i18n/messages/contracts";
import { getLocale } from "@/i18n/server";

/**
 * Unknown contract, or a partner organization's (§23.5): the same message
 * for both, so the page does not reveal that the record exists.
 */
export default async function ContractNotFound() {
  const locale = await getLocale();
  const t = contracts[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={FilePen}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={contractListHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
