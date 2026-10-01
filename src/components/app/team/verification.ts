import type { VerificationResult } from "@/lib/data/views";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import type { ProfessionalStatus, VerificationItem, VerificationSubject } from "@/lib/domain/types";

/**
 * Checked facts as people screens show them (§16.4, §38.2). A partner's
 * facts come "result only" (§19): without source, note and checker.
 */

/**
 * A result-only fact in the shape `VerificationBadge` takes. The source is
 * left empty, so the badge must be rendered with `showSource={false}`.
 */
export function badgeItem(fact: VerificationResult): VerificationItem {
  return { ...fact, source: fact.source ?? "" };
}

/**
 * `displayedProfessionalStatus` for result-only facts: it reads only the
 * certificate's subject and status, which a result keeps. "Certified" stays
 * only while that check is confirmed.
 */
export function displayedStatus(agent: {
  professionalStatus: ProfessionalStatus;
  verifications: readonly VerificationResult[];
}): ProfessionalStatus {
  return displayedProfessionalStatus({
    professionalStatus: agent.professionalStatus,
    verifications: agent.verifications.map(badgeItem),
  });
}

/** The fact on one subject, if any was ever recorded. */
export function factOf<T extends { subject: VerificationSubject }>(facts: readonly T[], subject: VerificationSubject): T | undefined {
  return facts.find((fact) => fact.subject === subject);
}

/** Agent facts shown on a profile: identity and certificate always (missing = "no data"), others when present. */
export const AGENT_FACT_SUBJECTS = ["agent_identity", "agent_certificate"] as const satisfies readonly VerificationSubject[];

/** Further facts an independent professional may carry (registry, insurance), in display order. */
export function extraFactSubjects(facts: readonly { subject: VerificationSubject }[]): VerificationSubject[] {
  const order: VerificationSubject[] = ["org_registry", "insurance"];
  return order.filter((subject) => facts.some((fact) => fact.subject === subject));
}
