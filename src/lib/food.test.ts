import { describe, expect, it } from "vitest";
import { isOpenNow, type HoursMap } from "./food";

describe("isOpenNow", () => {
  it("gère un service dans la même journée", () => {
    const hours: HoursMap = { mon: [["11:30", "14:30"]] };
    expect(isOpenNow(hours, { day: "mon", minutes: 12 * 60 })).toBe(true);
    expect(isOpenNow(hours, { day: "mon", minutes: 15 * 60 })).toBe(false);
  });

  it("gère un service qui passe minuit", () => {
    const hours: HoursMap = { mon: [["19:00", "01:00"]] };
    expect(isOpenNow(hours, { day: "mon", minutes: 23 * 60 })).toBe(true);
    expect(isOpenNow(hours, { day: "tue", minutes: 30 })).toBe(true);
    expect(isOpenNow(hours, { day: "tue", minutes: 60 })).toBe(false);
  });
});

