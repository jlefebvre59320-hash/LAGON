import { describe, expect, it } from "vitest";
import { islandDayStartIso } from "./event";

describe("islandDayStartIso", () => {
  it("utilise toujours le jour de Saint-Barthélemy", () => {
    expect(islandDayStartIso(new Date("2026-09-02T02:00:00Z")))
      .toBe("2026-09-01T00:00:00-04:00");
  });
});

