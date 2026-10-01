import { HandCoins } from "lucide-react";
import { offerListHref } from "@/components/app/offers/offer-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import offers from "@/i18n/messages/offers";
import { getLocale } from "@/i18n/server";

/**
 * Unknown offer, or one on another agent's client (§23.5): the same message
 * for both, so the page does not reveal that the record exists.
 */
export default async function OfferNotFound() {
  const locale = await getLocale();
  const t = offers[locale].notFound;
  return (
    <div className="py-6">
      <title>{t.title}</title>
      <EmptyState
        icon={HandCoins}
        title={t.title}
        description={t.text}
        action={<ButtonLink href={offerListHref(locale)}>{t.back}</ButtonLink>}
      />
    </div>
  );
}
