import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import properties from "@/i18n/messages/properties";
import type { ListingView, TelegramListingView } from "@/lib/data/views";
import { dedupRecordFromListing, dedupRecordFromTelegram } from "@/lib/domain/dedup";
import { confidentValue, locationLine, propertyTitle, telegramFacts } from "./labels";
import type { DuplicatePoolEntry } from "./new-property";

/**
 * Builds the records the "new property" Duplicate Check compares against
 * (§34.5), from repository views — so access rules are already applied: a
 * masked partner listing contributes no address, and owner phones are never
 * part of the comparison. Labels are resolved here, on the server, so the
 * client form ships no dictionaries.
 *
 * Finished listings and hidden posts stay in the pool: a flat sold last year
 * or a post the agent hid is still the same physical object.
 */
export function listingPoolEntry(locale: Locale, view: ListingView): DuplicatePoolEntry {
  const { listing, property } = view;
  // The engine reads physical attributes only; the (possibly withheld) address is never used.
  const record = dedupRecordFromListing(listing, { ...property, address: property.address ?? "" });
  const by = view.organization
    ? format(properties[locale].detail.otherListings.by, { agent: view.agent.name, organization: view.organization.name })
    : view.agent.name;
  return {
    record,
    kind: "listing",
    id: listing.id,
    propertyId: property.id,
    title: propertyTitle(locale, property),
    place: locationLine(locale, property),
    price: listing.price,
    by,
    access: view.access,
    path: `/properties/${encodeURIComponent(listing.id)}`,
  };
}

export function telegramPoolEntry(locale: Locale, view: TelegramListingView): DuplicatePoolEntry {
  const { post, source } = view;
  const facts = telegramFacts(post);
  const entry: DuplicatePoolEntry = {
    record: dedupRecordFromTelegram(post),
    kind: "telegram",
    id: post.id,
    title: propertyTitle(locale, facts),
    place: locationLine(locale, facts),
    by: source.title,
    path: `/radar/${encodeURIComponent(post.id)}`,
  };
  const price = confidentValue(post.parsed.price);
  if (price) entry.price = price;
  return entry;
}

export function duplicatePool(
  locale: Locale,
  listings: readonly ListingView[],
  posts: readonly TelegramListingView[],
): DuplicatePoolEntry[] {
  return [
    ...listings.map((view) => listingPoolEntry(locale, view)),
    ...posts.map((view) => telegramPoolEntry(locale, view)),
  ];
}
