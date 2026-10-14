import { isSoundPack, type SoundPack } from "./audio.ts";
import { isPace, isWorld, clamp, type PaceId, type WorldId } from "./logic.ts";

export const SAVE_KEY = "huecount-save-v1";

export interface WallItem {
  h: number;
  s: number;
  l: number;
  name: string;
  grade: "exact" | "close";
  pace: PaceId;
  world: WorldId;
  at: number;
}

export interface StreakMark {
  at: number;
  grade: "exact" | "close" | "smear";
  streak: number;
}

export interface Save {
  theme: "dark" | "light" | "system";
  reduceMotion: boolean;
  music: boolean;
  sound: boolean;
  haptics: boolean;
  pace: PaceId;
  world: WorldId;
  wall: WallItem[];
  streak: number;
  bestStreak: number;
  locks: number;
  exacts: number;
  closes: number;
  smears: number;
  dailyStamp: string;
  rampFloor: number;
  climbRung: number;
  plus: boolean;
  /** Server-signed Plus token. Plus is never on without one. */
  plusToken: string;
  soundPack: SoundPack;
  history: StreakMark[];
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function finite(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function count(value: unknown): number {
  return Math.max(0, Math.floor(finite(value, 0)));
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readHistory(value: unknown): StreakMark[] {
  if (!Array.isArray(value)) return [];
  const marks: StreakMark[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.grade !== "exact" && row.grade !== "close" && row.grade !== "smear") continue;
    marks.push({ at: count(row.at), grade: row.grade, streak: count(row.streak) });
    if (marks.length >= 40) break;
  }
  return marks;
}

function readWall(value: unknown): WallItem[] {
  if (!Array.isArray(value)) return [];
  const items: WallItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.h !== "number" || !Number.isFinite(row.h)) continue;
    if (row.grade !== "exact" && row.grade !== "close") continue;
    const pace = typeof row.pace === "string" && isPace(row.pace) ? row.pace : "steady";
    const world = typeof row.world === "string" && isWorld(row.world) ? row.world : "studio";
    items.push({
      h: row.h,
      s: finite(row.s, 60),
      l: finite(row.l, 60),
      name: typeof row.name === "string" && row.name.trim() ? row.name.slice(0, 32) : "Color",
      grade: row.grade,
      pace,
      world,
      at: count(row.at),
    });
    if (items.length >= 80) break;
  }
  return items;
}

export function normalizeSave(input: unknown): Save {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const pace = typeof raw.pace === "string" && isPace(raw.pace) ? raw.pace : "steady";
  const world = typeof raw.world === "string" && isWorld(raw.world) ? raw.world : "studio";
  const theme = raw.theme === "dark" || raw.theme === "light" || raw.theme === "system" ? raw.theme : "system";
  const streak = count(raw.streak);
  const bestStreak = Math.max(count(raw.bestStreak), streak);
  const dailyStamp = typeof raw.dailyStamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyStamp) ? raw.dailyStamp : "";
  const soundPack = typeof raw.soundPack === "string" && isSoundPack(raw.soundPack) ? raw.soundPack : "tick";
  return {
    theme,
    reduceMotion: flag(raw.reduceMotion, false),
    music: flag(raw.music, false),
    sound: flag(raw.sound, true),
    haptics: flag(raw.haptics, true),
    pace,
    world,
    wall: readWall(raw.wall),
    streak,
    bestStreak,
    locks: count(raw.locks),
    exacts: count(raw.exacts),
    closes: count(raw.closes),
    smears: count(raw.smears),
    dailyStamp,
    rampFloor: clamp(count(raw.rampFloor) || 5, 5, 24),
    climbRung: clamp(count(raw.climbRung), 0, 8),
    plusToken: typeof raw.plusToken === "string" && /^[\w-]+\.[\w-]+$/.test(raw.plusToken) ? raw.plusToken : "",
    plus: flag(raw.plus, false) && typeof raw.plusToken === "string" && /^[\w-]+\.[\w-]+$/.test(raw.plusToken),
    soundPack,
    history: readHistory(raw.history),
  };
}

function browserStorage(): KeyValue {
  if (typeof localStorage === "undefined") {
    return { getItem: () => null, setItem: () => undefined };
  }
  return localStorage;
}

export function loadSave(storage: KeyValue = browserStorage()): Save {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return normalizeSave(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeSave({});
  }
}

export function persist(save: Save, storage: KeyValue = browserStorage()): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode or a full disk — keep playing in memory */
  }
}
