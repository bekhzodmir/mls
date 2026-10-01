import type { Metadata } from "next";
import { authRobots } from "@/components/auth/metadata";
import { OnboardingWizard } from "@/components/auth/onboarding-wizard";
import onboarding from "@/i18n/messages/onboarding";
import { getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const meta = onboarding[locale].meta;
  return { title: meta.title, description: meta.description, robots: authRobots };
}

/**
 * Onboarding (§21.4 screens 5–9): language, how you work (work format and,
 * separately, legal status — §38.2), professional profile, agency (agency
 * roles only) and a summary with the first steps from §30. A demo: answers
 * stay in this browser tab and nothing is sent to a server.
 */
export default async function OnboardingPage() {
  const locale = await getLocale();
  return <OnboardingWizard locale={locale} />;
}
