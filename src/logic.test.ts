import { describe, expect, it } from "vitest";
import {
  beatLost,
  badgeLabel,
  climbAfter,
  coachLine,
  gradeRound,
  hueName,
  keepsPigment,
  makePigment,
  pickTarget,
  rampAfter,
  rushExpired,
  streakAfter,
  wallColor,
} from "./logic.ts";

describe("gradeRound", () => {
  it("treats a late beat and a rush timeout as smears", () => {
    expect(gradeRound(7, 7, { smashed: true })).toBe("smear");
    expect(gradeRound(8, 7, { smashed: true })).toBe("smear");
    expect(gradeRound(7, 7, { rushed: true })).toBe("smear");
  });

  it("locks exact counts and keeps a miss of one", () => {
    expect(gradeRound(7, 7, { smashed: false })).toBe("exact");
    expect(gradeRound(6, 7, {})).toBe("close");
    expect(gradeRound(8, 7, {})).toBe("close");
    expect(gradeRound(5, 7, {})).toBe("smear");
    expect(gradeRound(6, 7, { allowClose: false })).toBe("smear");
  });
});

describe("timing", () => {
  it("keeps a tap on the 280 ms boundary", () => {
    expect(beatLost(279)).toBe(false);
    expect(beatLost(280)).toBe(false);
    expect(beatLost(281)).toBe(true);
  });

  it("expires rush at the limit", () => {
    expect(rushExpired(4499)).toBe(false);
    expect(rushExpired(4500)).toBe(true);
  });
});

describe("targets", () => {
  it("keeps the daily count stable for a date", () => {
    const save = { rampFloor: 5, climbRung: 0 };
    const first = pickTarget("daily", save, () => 0, "2026-10-10");
    const second = pickTarget("daily", save, () => 0.99, "2026-10-10");
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(5);
    expect(first).toBeLessThanOrEqual(12);
  });

  it("uses the ramp floor and the climb rung", () => {
    expect(pickTarget("ramp", { rampFloor: 9, climbRung: 0 }, () => 0)).toBe(9);
    expect(pickTarget("ramp", { rampFloor: 100, climbRung: 0 }, () => 0)).toBe(24);
    expect(pickTarget("climb", { rampFloor: 5, climbRung: 3 }, () => 0)).toBe(10);
    expect(pickTarget("climb", { rampFloor: 5, climbRung: 8 }, () => 0)).toBe(20);
  });

  it("stays inside a pace range", () => {
    expect(pickTarget("slow", { rampFloor: 5, climbRung: 0 }, () => 0)).toBe(3);
    expect(pickTarget("slow", { rampFloor: 5, climbRung: 0 }, () => 0.999)).toBe(7);
  });
});

describe("progress", () => {
  it("moves streak, ramp, and climb only on exact or smear", () => {
    expect(streakAfter(4, "exact")).toBe(5);
    expect(streakAfter(4, "close")).toBe(4);
    expect(streakAfter(4, "smear")).toBe(0);
    expect(rampAfter(5, "exact")).toBe(6);
    expect(rampAfter(24, "exact")).toBe(24);
    expect(rampAfter(5, "smear")).toBe(5);
    expect(rampAfter(10, "close")).toBe(10);
    expect(climbAfter(0, "exact")).toBe(1);
    expect(climbAfter(8, "exact")).toBe(8);
    expect(climbAfter(3, "smear")).toBe(2);
  });

  it("softens a close pigment and keeps exact and close", () => {
    expect(keepsPigment("exact")).toBe(true);
    expect(keepsPigment("close")).toBe(true);
    expect(keepsPigment("smear")).toBe(false);
    expect(wallColor({ h: 20, s: 60, l: 58 }, "close").s).toBe(44);
    expect(wallColor({ h: 20, s: 30, l: 58 }, "close").s).toBe(28);
    expect(wallColor({ h: 20, s: 60, l: 58 }, "exact")).toEqual({ h: 20, s: 60, l: 58 });
  });
});

describe("pigment", () => {
  it("names hues around the wheel and stays stable for a seed", () => {
    expect(hueName(262)).toBe("Iris");
    expect(hueName(0)).toBe("Wine");
    const pigment = makePigment("daily-2026-10-10");
    expect(makePigment("daily-2026-10-10")).toEqual(pigment);
    expect(pigment.h).toBeGreaterThanOrEqual(0);
    expect(pigment.h).toBeLessThan(360);
    expect(pigment.s).toBeGreaterThanOrEqual(58);
    expect(pigment.l).toBeGreaterThanOrEqual(56);
  });
});

describe("copy", () => {
  const base = { target: 7, pace: "steady" as const, result: null, smashed: false, rushed: false, hideTarget: false };

  it("tells you the count, the miss, and the lock", () => {
    expect(coachLine(base)).toBe("Tap seven. Then lock.");
    expect(coachLine({ ...base, pace: "pulse" })).toContain("280");
    expect(coachLine({ ...base, pace: "drift", hideTarget: true })).toContain("remember");
    expect(coachLine({ ...base, result: "exact" })).toBe("Locked.");
    expect(coachLine({ ...base, result: "smear", smashed: true })).toBe("The beat slipped.");
    expect(badgeLabel("exact", true)).toBe("New best");
    expect(badgeLabel("smear", false)).toBe("Smear");
    expect(badgeLabel(null, false)).toBeNull();
  });
});
