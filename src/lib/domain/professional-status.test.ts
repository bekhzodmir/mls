import { describe, expect, it } from "vitest";
import { displayedProfessionalStatus } from "./professional-status";
import type { VerificationItem, VerificationStatus } from "./types";

function certificate(status: VerificationStatus): VerificationItem {
  return { id: "v-1", subject: "agent_certificate", status, method: "official_source", source: "Реестр (демо)" };
}

describe("displayedProfessionalStatus (§16.4, §38.2)", () => {
  it("shows a certified realtor only with a confirmed certificate check", () => {
    expect(
      displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [certificate("confirmed")] }),
    ).toBe("certified_realtor");
  });

  it.each(["pending", "unavailable", "problem"] as const)("a %s certificate check is not a certificate", (status) => {
    expect(
      displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [certificate(status)] }),
    ).toBe("unconfirmed");
  });

  it("treats a missing certificate check as unconfirmed", () => {
    expect(displayedProfessionalStatus({ professionalStatus: "certified_realtor", verifications: [] })).toBe("unconfirmed");
  });

  it("leaves other statuses as recorded", () => {
    expect(displayedProfessionalStatus({ professionalStatus: "real_estate_agent", verifications: [] })).toBe(
      "real_estate_agent",
    );
    expect(displayedProfessionalStatus({ professionalStatus: "unconfirmed", verifications: [] })).toBe("unconfirmed");
  });
});
