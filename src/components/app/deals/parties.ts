import type { DealView } from "@/lib/data/views";
import type { Agent, ID } from "@/lib/domain/types";

/**
 * Who is who in a deal (§22.12 "parties", §35.6 step 2): each professional
 * with an explicit side, so a commission split never reads as a bare
 * "70/30". The deal's agent works for the client; the listing's agent works
 * for the owner; one agent can hold both sides on their own listing.
 */

export type DealSide = "buyer" | "listing" | "both" | "partner";

export interface DealParty {
  agent: Agent;
  side: DealSide;
  isViewer: boolean;
}

export function dealParties(view: Pick<DealView, "agent" | "listing" | "partner">, viewerId: ID): DealParty[] {
  const dealAgent = view.agent;
  const listingAgent = view.listing.agent;
  const parties: DealParty[] = [
    {
      agent: dealAgent,
      side: listingAgent.id === dealAgent.id ? "both" : "buyer",
      isViewer: dealAgent.id === viewerId,
    },
  ];
  if (listingAgent.id !== dealAgent.id) {
    parties.push({ agent: listingAgent, side: "listing", isViewer: listingAgent.id === viewerId });
  }
  const partner = view.partner;
  if (partner && !parties.some((party) => party.agent.id === partner.id)) {
    parties.push({ agent: partner, side: "partner", isViewer: partner.id === viewerId });
  }
  return parties;
}

/** The two commission roles by name: listing side (owner's agent) and buyer side (client's agent). */
export function commissionSides(view: Pick<DealView, "agent" | "listing">): { listing: Agent; buyer: Agent } {
  return { listing: view.listing.agent, buyer: view.agent };
}
