import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  endOfTashkentDay,
  isWorkingDay,
  mlsReportDeadline,
  tashkentDateKey,
  workingDaysLeft,
} from "./working-days";

// Tashkent is UTC+5: 06:00Z = 11:00 local. 2026-09-30 is a Wednesday.
const WED_11 = "2026-09-30T06:00:00.000Z";

describe("tashkentDateKey / isWorkingDay", () => {
  it("uses the Tashkent calendar date, not UTC", () => {
    expect(tashkentDateKey("2026-09-29T19:30:00.000Z")).toBe("2026-09-30");
    expect(tashkentDateKey("2026-09-29T18:59:59.999Z")).toBe("2026-09-29");
  });

  it("treats Saturday and Sunday as days off", () => {
    expect(isWorkingDay("2026-10-02T06:00:00.000Z")).toBe(true); // Fri
    expect(isWorkingDay("2026-10-03T06:00:00.000Z")).toBe(false); // Sat
    expect(isWorkingDay("2026-10-04T06:00:00.000Z")).toBe(false); // Sun
    // Friday 20:00 UTC is already Saturday 01:00 in Tashkent.
    expect(isWorkingDay("2026-10-02T20:00:00.000Z")).toBe(false);
  });

  it("applies configured holidays and transferred working weekends", () => {
    expect(isWorkingDay(WED_11, ["2026-09-30"])).toBe(false);
    expect(isWorkingDay("2026-10-03T06:00:00.000Z", { holidays: [], workingWeekends: ["2026-10-03"] })).toBe(true);
  });
});

describe("addWorkingDays", () => {
  it("skips the weekend and keeps the wall-clock time", () => {
    // Wed + 3 working days = Mon (Thu, Fri, Mon).
    expect(addWorkingDays(WED_11, 3)).toBe("2026-10-05T06:00:00.000Z");
  });

  it("does not count the start day and returns the same instant for n = 0", () => {
    expect(addWorkingDays(WED_11, 1)).toBe("2026-10-01T06:00:00.000Z");
    expect(addWorkingDays(WED_11, 0)).toBe(WED_11);
  });

  it("counts on Tashkent dates when UTC is still on the previous day", () => {
    // Sat 01:00 in Tashkent (Fri 20:00 UTC) + 1 → Mon 01:00 in Tashkent.
    expect(addWorkingDays("2026-10-02T20:00:00.000Z", 1)).toBe("2026-10-04T20:00:00.000Z");
  });

  it("crosses month ends over a weekend", () => {
    // Fri 30 Oct → Mon 2 Nov.
    expect(addWorkingDays("2026-10-30T05:00:00.000Z", 1)).toBe("2026-11-02T05:00:00.000Z");
    // Fri 27 Feb 2026 → Mon 2 Mar (non-leap year).
    expect(addWorkingDays("2026-02-27T05:00:00.000Z", 1)).toBe("2026-03-02T05:00:00.000Z");
    // Mon 28 Feb 2028 → Tue 29 Feb (leap year).
    expect(addWorkingDays("2028-02-28T05:00:00.000Z", 1)).toBe("2028-02-29T05:00:00.000Z");
  });

  it("crosses the year end and never invents holidays", () => {
    // Default calendar is empty: 1 January is a working day until configured.
    expect(addWorkingDays("2026-12-31T05:00:00.000Z", 1)).toBe("2027-01-01T05:00:00.000Z");
    expect(addWorkingDays("2026-12-31T05:00:00.000Z", 1, ["2027-01-01"])).toBe("2027-01-04T05:00:00.000Z");
  });

  it("skips configured holidays and uses transferred working Saturdays", () => {
    expect(addWorkingDays(WED_11, 1, ["2026-10-01"])).toBe("2026-10-02T06:00:00.000Z");
    expect(
      addWorkingDays("2026-10-02T06:00:00.000Z", 1, { holidays: [], workingWeekends: ["2026-10-03"] }),
    ).toBe("2026-10-03T06:00:00.000Z");
  });

  it("moves backwards for negative n", () => {
    expect(addWorkingDays("2026-11-02T05:00:00.000Z", -1)).toBe("2026-10-30T05:00:00.000Z");
  });

  it("rejects bad input instead of guessing", () => {
    expect(() => addWorkingDays(WED_11, 1.5)).toThrow(RangeError);
    expect(() => addWorkingDays("30.09.2026", 1)).toThrow(RangeError);
    expect(() => addWorkingDays(WED_11, 1, ["01.10.2026"])).toThrow(RangeError);
  });
});

describe("mlsReportDeadline (§17.5, §38.5)", () => {
  it("is the end of the third working day after the act, Tashkent time", () => {
    // Act on Wed → Thu, Fri, Mon → Mon 23:59:59.999 in Tashkent.
    expect(mlsReportDeadline(WED_11)).toBe("2026-10-05T18:59:59.999Z");
  });

  it("starts counting on Monday for an act signed at the weekend", () => {
    expect(mlsReportDeadline("2026-10-03T06:00:00.000Z")).toBe("2026-10-07T18:59:59.999Z");
  });

  it("uses the Tashkent date for a late-evening act at the month end", () => {
    // Fri 30 Oct 22:00 Tashkent → Mon, Tue, Wed 4 Nov.
    expect(mlsReportDeadline("2026-10-30T17:00:00.000Z")).toBe("2026-11-04T18:59:59.999Z");
  });

  it("extends over configured holidays", () => {
    expect(mlsReportDeadline(WED_11, ["2026-10-01", "2026-10-02"])).toBe("2026-10-07T18:59:59.999Z");
  });

  it("endOfTashkentDay keeps the local date", () => {
    expect(endOfTashkentDay("2026-09-29T19:30:00.000Z")).toBe("2026-09-30T18:59:59.999Z");
  });
});

describe("workingDaysLeft", () => {
  const deadline = "2026-10-05T18:59:59.999Z"; // Mon end of day

  it("counts working days after today up to the deadline day", () => {
    expect(workingDaysLeft(deadline, new Date(WED_11))).toBe(3);
    expect(workingDaysLeft(deadline, new Date("2026-10-02T06:00:00.000Z"))).toBe(1); // Fri
    expect(workingDaysLeft(deadline, new Date("2026-10-03T06:00:00.000Z"))).toBe(1); // Sat
  });

  it("is 0 on the deadline day", () => {
    expect(workingDaysLeft(deadline, new Date("2026-10-05T05:00:00.000Z"))).toBe(0);
  });

  it("is negative once overdue", () => {
    expect(workingDaysLeft(deadline, new Date("2026-10-06T06:00:00.000Z"))).toBe(-1);
    expect(workingDaysLeft(deadline, new Date("2026-10-10T06:00:00.000Z"))).toBe(-4); // Tue–Fri
    // A Friday deadline checked on Saturday is overdue, not "due today".
    expect(workingDaysLeft("2026-10-02T18:59:59.999Z", new Date("2026-10-03T06:00:00.000Z"))).toBe(-1);
  });
});
