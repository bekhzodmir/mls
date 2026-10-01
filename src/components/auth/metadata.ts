import type { Metadata } from "next";

/**
 * Sign-in and onboarding are private entry screens, not public content: they
 * are kept out of search results (links on them may still be followed).
 */
export const authRobots: Metadata["robots"] = { index: false, follow: true };
