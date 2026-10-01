import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  isDemoCodeAccepted,
  OTP_LENGTH,
  otpProblem,
  RESEND_COOLDOWN_SECONDS,
  sanitizeOtp,
  secondsUntilResend,
} from "./otp";

describe("sanitizeOtp", () => {
  it("keeps only digits from typed or pasted text", () => {
    expect(sanitizeOtp("123 456")).toBe("123456");
    expect(sanitizeOtp("Код: 123-456")).toBe("123456");
    expect(sanitizeOtp("Binor kodi: 98 76 54")).toBe("987654");
  });

  it("cuts to the code length", () => {
    expect(sanitizeOtp("12345678")).toHaveLength(OTP_LENGTH);
    expect(sanitizeOtp("12345678")).toBe("123456");
  });

  it("understands full-width digits from some keyboards", () => {
    expect(sanitizeOtp("１２３４５６")).toBe("123456");
  });

  it("returns an empty string when there are no digits", () => {
    expect(sanitizeOtp("abc")).toBe("");
    expect(sanitizeOtp("")).toBe("");
  });
});

describe("otpProblem / isDemoCodeAccepted", () => {
  it("asks for a code, then for the missing digits", () => {
    expect(otpProblem("")).toBe("empty");
    expect(otpProblem("123")).toBe("incomplete");
    expect(otpProblem("123456")).toBeNull();
  });

  it("accepts any six digits in the demo — nothing is checked against a sent code", () => {
    expect(isDemoCodeAccepted("000000")).toBe(true);
    expect(isDemoCodeAccepted("987654")).toBe(true);
    expect(isDemoCodeAccepted("12345")).toBe(false);
  });
});

describe("resend timer", () => {
  const sentAt = 1_000_000;

  it("counts whole seconds down from the cooldown", () => {
    expect(secondsUntilResend(sentAt, sentAt)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(secondsUntilResend(sentAt, sentAt + 400)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(secondsUntilResend(sentAt, sentAt + 1_000)).toBe(RESEND_COOLDOWN_SECONDS - 1);
    expect(secondsUntilResend(sentAt, sentAt + 59_500)).toBe(1);
  });

  it("never goes below zero", () => {
    expect(secondsUntilResend(sentAt, sentAt + 60_000)).toBe(0);
    expect(secondsUntilResend(sentAt, sentAt + 999_999)).toBe(0);
  });

  it("formats minutes and padded seconds", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(59)).toBe("0:59");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
