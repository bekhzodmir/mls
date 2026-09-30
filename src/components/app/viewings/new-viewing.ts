import { propertyTitle } from "@/components/app/inventory/labels";
import type { Locale } from "@/i18n/config";
import { compareText } from "@/i18n/format";
import type { ListingAccess, ListingView } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import type { ID, ISODateTime, ListingStatus } from "@/lib/domain/types";
import { findOverlaps, type TimeSlot } from "./agenda";
import { tashkentInstant } from "./time";

/**
 * Plain data and validation for scheduling and rescheduling a viewing
 * (§8.3 flow 9, §22.10). The server page prepares serializable options; the
 * client form validates live with the same functions, so the overlap check
 * and the "time already passed" rule behave identically in tests and UI.
 */

export type ListingGroup = "owner" | "agency" | "partner";

export interface ListingOption {
  id: ID;
  /** Privacy-safe label: type, rooms, massif — never the address. */
  label: string;
  price: string;
  access: ListingAccess;
  group: ListingGroup;
  agentName: string;
}

export interface ClientOption {
  id: ID;
  name: string;
  /** The client's first active requirement, for the cooperation shortcut. */
  requirementId?: ID;
}

/** Another viewing of the agent, as the overlap check needs it. */
export interface ExistingSlot extends TimeSlot {
  id: ID;
  clientName: string;
  propertyLabel: string;
}

/** Listings that can still be shown to a client. */
const NOT_SCHEDULABLE = new Set<ListingStatus>(["closed", "archived", "withdrawn", "expired", "suspended"]);

export function isSchedulable(view: ListingView): boolean {
  return !NOT_SCHEDULABLE.has(view.listing.status);
}

export function listingGroup(access: ListingAccess): ListingGroup {
  return access === "owner" ? "owner" : access === "agency" ? "agency" : "partner";
}

const GROUP_ORDER: readonly ListingGroup[] = ["owner", "agency", "partner"];

export function toListingOption(locale: Locale, view: ListingView): ListingOption {
  return {
    id: view.listing.id,
    label: propertyTitle(locale, view.property),
    price: formatMoney(locale, view.listing.price),
    access: view.access,
    group: listingGroup(view.access),
    agentName: view.agent.name,
  };
}

/** Own listings first, then the agency, then partners; by label inside a group. */
export function sortListingOptions(options: readonly ListingOption[], locale: Locale): ListingOption[] {
  return [...options].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      compareText(locale, a.label, b.label) ||
      a.id.localeCompare(b.id),
  );
}

export function toExistingSlot(
  viewing: { id: ID; startsAt: ISODateTime; durationMinutes: number; status: TimeSlot["status"] },
  clientName: string,
  propertyLabel: string,
): ExistingSlot {
  return {
    id: viewing.id,
    startsAt: viewing.startsAt,
    durationMinutes: viewing.durationMinutes,
    status: viewing.status,
    clientName,
    propertyLabel,
  };
}

/* ------------------------------------------------------------ validation */

export type SlotError = "date" | "time" | "past";

export interface SlotCheck {
  /** Present when date and time form a valid Tashkent instant. */
  startsAt?: ISODateTime;
  errors: SlotError[];
  overlaps: ExistingSlot[];
}

/**
 * Checks a proposed time: both parts given, a real date, in the future, and
 * which of the agent's other viewings it overlaps. `selfId` excludes the
 * viewing being rescheduled.
 */
export function checkSlot(
  input: { date: string; time: string; durationMinutes: number; selfId?: ID },
  now: Date,
  slots: readonly ExistingSlot[],
): SlotCheck {
  const errors: SlotError[] = [];
  if (!input.date.trim()) errors.push("date");
  if (!input.time.trim()) errors.push("time");
  if (errors.length > 0) return { errors, overlaps: [] };
  const startsAt = tashkentInstant(input.date, input.time);
  if (!startsAt) return { errors: ["date"], overlaps: [] };
  if (Date.parse(startsAt) <= now.getTime()) errors.push("past");
  const overlaps = findOverlaps({ id: input.selfId, startsAt, durationMinutes: input.durationMinutes }, slots);
  return { startsAt, errors, overlaps };
}

export interface NewViewingValues {
  clientId: string;
  listingId: string;
  date: string;
  time: string;
  durationMinutes: number;
  /** The agent saw the overlap warning and still wants this time. */
  overlapAcknowledged: boolean;
}

export type NewViewingError = "client" | "listing" | SlotError | "overlap";

export interface NewViewingCheck extends Omit<SlotCheck, "errors"> {
  errors: NewViewingError[];
}

/** Field order of the form, so the error summary reads top to bottom. */
const ERROR_ORDER: readonly NewViewingError[] = ["client", "listing", "date", "time", "past", "overlap"];

export function checkNewViewing(
  values: NewViewingValues,
  now: Date,
  context: { slots: readonly ExistingSlot[]; clientIds: readonly ID[]; listingIds: readonly ID[] },
): NewViewingCheck {
  const errors: NewViewingError[] = [];
  if (!context.clientIds.includes(values.clientId)) errors.push("client");
  if (!context.listingIds.includes(values.listingId)) errors.push("listing");
  const slot = checkSlot(values, now, context.slots);
  errors.push(...slot.errors);
  if (slot.overlaps.length > 0 && !values.overlapAcknowledged) errors.push("overlap");
  const check: NewViewingCheck = {
    errors: ERROR_ORDER.filter((code) => errors.includes(code)),
    overlaps: slot.overlaps,
  };
  if (slot.startsAt) check.startsAt = slot.startsAt;
  return check;
}
