/**
 * One-time code helpers for the phone sign-in (screen 3 "OTP", §21.4).
 *
 * SMS delivery is NOT connected in this build: no code is generated, sent or
 * stored, and the demo accepts any six digits. These helpers only shape what
 * the person types, so the real verification can replace `isDemoCodeAccepted`
 * without touching the input.
 */

export const OTP_LENGTH = 6;

/** Seconds before "Отправить код ещё раз" becomes available again. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Keeps the digits of whatever was typed or pasted ("123 456", "Код: 123-456",
 * full-width "１２３４５６") and cuts the result to the code length.
 */
export function sanitizeOtp(raw: string): string {
  return raw.normalize("NFKC").replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export type OtpProblem = "empty" | "incomplete";

/** Why the code cannot be submitted yet, or null when it has all its digits. */
export function otpProblem(code: string): OtpProblem | null {
  const digits = sanitizeOtp(code);
  if (digits.length === 0) return "empty";
  if (digits.length < OTP_LENGTH) return "incomplete";
  return null;
}

/**
 * Demo stand-in for the server check: any complete code passes. Replace with
 * a call to the auth service once SMS is connected (§39.3 Auth/Identity).
 */
export function isDemoCodeAccepted(code: string): boolean {
  return otpProblem(code) === null;
}

/** Whole seconds left until a resend is allowed; never negative. */
export function secondsUntilResend(
  sentAtMs: number,
  nowMs: number,
  cooldownSeconds: number = RESEND_COOLDOWN_SECONDS,
): number {
  const remainingMs = sentAtMs + cooldownSeconds * 1000 - nowMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** "1:00", "0:09" — minutes and zero-padded seconds. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
