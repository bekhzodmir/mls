import type { ProfessionalStatus, VerificationItem } from "./types";

/**
 * The professional status an agent may be presented with (§38.2). "Сертифицированный
 * риэлтор" is a claim about one fact — the certificate — so it is shown only
 * while that check is confirmed. A pending or unavailable registry answer
 * (or no check at all) leaves the status unconfirmed: Unknown is never shown
 * as verified (§16.4).
 */
export function displayedProfessionalStatus(agent: {
  professionalStatus: ProfessionalStatus;
  /** Only the subject and status are read, so result-only facts (§19) work too. */
  verifications: readonly Pick<VerificationItem, "subject" | "status">[];
}): ProfessionalStatus {
  if (agent.professionalStatus !== "certified_realtor") return agent.professionalStatus;
  const certificate = agent.verifications.find((item) => item.subject === "agent_certificate");
  return certificate?.status === "confirmed" ? "certified_realtor" : "unconfirmed";
}
