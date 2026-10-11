import { describe, expect, it } from "vitest";
import { loadSave, normalizeSave, persist, SAVE_KEY, type KeyValue } from "./store.ts";

function memory(): KeyValue & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
  };
}

describe("normalizeSave", () => {
  it("fills defaults and keeps an explicit off switch", () => {
    const save = normalizeSave({ music: false, sound: true, haptics: false, pace: "nope", world: "dusk" });
    expect(save.music).toBe(false);
    expect(save.sound).toBe(true);
    expect(save.haptics).toBe(false);
    expect(save.pace).toBe("steady");
    expect(save.world).toBe("dusk");
    expect(save.theme).toBe("system");
    expect(save.rampFloor).toBe(5);
    expect(save.plus).toBe(false);
    expect(save.soundPack).toBe("tick");
    expect(save.history).toEqual([]);
  });

  it("drops broken wall items and heals the best streak", () => {
    const save = normalizeSave({
      streak: 4,
      bestStreak: 1,
      rampFloor: 99,
      climbRung: -3,
      wall: [{ h: 10, s: 40, l: 60, name: "Clay", grade: "exact", pace: "slow", world: "studio", at: 5 }, { h: "no" }, null],
    });
    expect(save.bestStreak).toBe(4);
    expect(save.rampFloor).toBe(24);
    expect(save.climbRung).toBe(0);
    expect(save.wall).toHaveLength(1);
    expect(save.wall[0]?.name).toBe("Clay");
    const tracked = normalizeSave({
      plus: true,
      soundPack: "glass",
      history: [{ at: 9, grade: "exact", streak: 2 }, { grade: "nope" }],
    });
    expect(tracked.plus).toBe(true);
    expect(tracked.soundPack).toBe("glass");
    expect(tracked.history).toEqual([{ at: 9, grade: "exact", streak: 2 }]);
  });

  it("ignores junk payloads", () => {
    expect(normalizeSave(null).pace).toBe("steady");
    expect(normalizeSave(["nope"]).world).toBe("studio");
  });
});

describe("persist", () => {
  it("round-trips through the save key", () => {
    const box = memory();
    const save = normalizeSave({ pace: "quick", sound: false, streak: 3 });
    persist(save, box);
    expect(box.raw.has(SAVE_KEY)).toBe(true);
    const loaded = loadSave(box);
    expect(loaded.pace).toBe("quick");
    expect(loaded.sound).toBe(false);
    expect(loaded.streak).toBe(3);
    expect(loaded.bestStreak).toBe(3);
  });
});
