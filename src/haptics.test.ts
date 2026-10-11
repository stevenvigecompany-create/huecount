import { describe, expect, it } from "vitest";
import { hapticAvailable, playHaptic } from "./haptics.ts";

describe("playHaptic", () => {
  it("does nothing when haptics are off", () => {
    let calls = 0;
    expect(playHaptic(12, false, () => {
      calls += 1;
      return true;
    })).toBe(false);
    expect(calls).toBe(0);
  });

  it("reports success and swallows a throw", () => {
    expect(playHaptic([8, 20], true, () => true)).toBe(true);
    expect(playHaptic(12, true, () => {
      throw new Error("blocked");
    })).toBe(false);
    expect(playHaptic(12, true, null)).toBe(false);
  });

  it("detects a vibrate function", () => {
    expect(hapticAvailable(undefined)).toBe(false);
    expect(hapticAvailable({ vibrate: () => true })).toBe(true);
    expect(hapticAvailable({})).toBe(false);
  });
});
