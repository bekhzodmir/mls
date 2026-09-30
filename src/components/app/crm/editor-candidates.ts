import type { ListingView, TelegramListingView } from "@/lib/data/views";
import { candidateFromListing, candidateFromTelegram, type MatchCandidate } from "@/lib/domain/matching";

/**
 * Serializable match candidates for the Requirement Editor's live count
 * (§15.2 "Показать N вариантов"). The server builds them from repository
 * views — so access rules are already applied — and the client runs the pure
 * matching engine on them while the agent types.
 */
export interface EditorCandidate {
  candidate: MatchCandidate;
  /** Workspace path after `/{locale}/app`, e.g. "/properties/lst-01". */
  path: string;
  /** Massif / residential complex name — never the restricted full address. */
  place?: string;
}

export function listingEditorCandidate(view: ListingView): EditorCandidate {
  // The engine reads only physical attributes; the address (possibly withheld
  // for masked partner listings) is never used for matching or shown here.
  const candidate = candidateFromListing(view.listing, view.property);
  const item: EditorCandidate = { candidate, path: `/properties/${encodeURIComponent(view.listing.id)}` };
  if (view.property.areaName) item.place = view.property.areaName;
  return item;
}

export function telegramEditorCandidate(view: TelegramListingView): EditorCandidate {
  return { candidate: candidateFromTelegram(view.post), path: `/radar/${encodeURIComponent(view.post.id)}` };
}

/** Inactive offers can never match; leaving them out keeps the client payload small. */
export function editorCandidates(
  listings: readonly ListingView[],
  posts: readonly TelegramListingView[],
): EditorCandidate[] {
  return [...listings.map(listingEditorCandidate), ...posts.map(telegramEditorCandidate)].filter(
    (item) => item.candidate.active,
  );
}
