export const PULSE_GAP = 260;
export const RUSH_LIMIT = 4500;

export const PACE_ORDER = ["slow", "steady", "quick", "daily", "pulse", "ramp", "drift", "climb", "rush"] as const;
export type PaceId = (typeof PACE_ORDER)[number];

export interface Pace {
  name: string;
  blurb: string;
  min: number;
  max: number;
  settle: number;
  maxGap?: number;
  limit?: number;
}

export const PACES: Record<PaceId, Pace> = {
  slow: { name: "Slow", blurb: "Short counts. No hurry.", min: 1, max: 3, settle: 1600 },
  steady: { name: "Steady", blurb: "The everyday rhythm.", min: 1, max: 5, settle: 800 },
  quick: { name: "Quick", blurb: "Keep the taps close.", min: 2, max: 7, settle: 280 },
  daily: { name: "Daily", blurb: "One pigment for today.", min: 5, max: 12, settle: 800 },
  pulse: { name: "Pulse", blurb: "260 ms between taps. A late tap smears.", min: 8, max: 18, settle: 220, maxGap: PULSE_GAP },
  ramp: { name: "Ramp", blurb: "Lock it clean and the count climbs.", min: 5, max: 24, settle: 800 },
  drift: { name: "Drift", blurb: "The number leaves after the first tap.", min: 6, max: 12, settle: 800 },
  climb: { name: "Climb", blurb: "A ladder of longer counts.", min: 4, max: 20, settle: 800 },
  rush: { name: "Rush", blurb: "Lock the count before the bar is gone.", min: 6, max: 14, settle: 800, limit: RUSH_LIMIT },
};

export const WORLD_ORDER = ["studio", "dusk", "ink", "glass", "field"] as const;
export type WorldId = (typeof WORLD_ORDER)[number];

export interface World {
  name: string;
  swatch: string;
  pack: string;
  plus: boolean;
}

export const WORLDS: Record<WorldId, World> = {
  studio: { name: "Studio", swatch: "#8b7cff", pack: "Studio", plus: false },
  dusk: { name: "Dusk", swatch: "#e489a4", pack: "After dark", plus: true },
  ink: { name: "Ink", swatch: "#aeb6cc", pack: "After dark", plus: true },
  glass: { name: "Glass", swatch: "#7ec8ea", pack: "Open air", plus: true },
  field: { name: "Field", swatch: "#8fce86", pack: "Open air", plus: true },
};

export type Grade = "exact" | "close" | "smear";

export interface Pigment {
  h: number;
  s: number;
  l: number;
}

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four",
] as const;

const HUES: readonly (readonly [number, string])[] = [
  [15, "Clay"],
  [32, "Amber"],
  [48, "Honey"],
  [78, "Olive"],
  [145, "Moss"],
  [168, "Sage"],
  [188, "Sea"],
  [210, "Sky"],
  [232, "Indigo"],
  [262, "Iris"],
  [292, "Orchid"],
  [330, "Rose"],
  [352, "Wine"],
];

export function isPace(value: string): value is PaceId {
  return (PACE_ORDER as readonly string[]).includes(value);
}

export function isWorld(value: string): value is WorldId {
  return (WORLD_ORDER as readonly string[]).includes(value);
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function today(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function hueName(h: number): string {
  let best = HUES[0] ?? [15, "Clay"];
  let dist = 999;
  for (const pair of HUES) {
    const d = Math.min(Math.abs(pair[0] - h), 360 - Math.abs(pair[0] - h));
    if (d < dist) {
      dist = d;
      best = pair;
    }
  }
  return best[1];
}

export function colorCss(p: Pigment): string {
  return `hsl(${Math.round(p.h)} ${Math.round(p.s)}% ${Math.round(p.l)}%)`;
}

export function makePigment(seed: string): Pigment {
  const n = hash(seed);
  return { h: n % 360, s: 58 + (n % 14), l: 56 + (n % 8) };
}

export function pickTarget(
  pace: PaceId,
  progress: { rampFloor: number; climbRung: number },
  random: () => number = Math.random,
  day = today(),
): number {
  if (pace === "daily") return 5 + (hash(day) % 8);
  if (pace === "ramp") return clamp(progress.rampFloor || 5, 5, 24);
  if (pace === "climb") return 4 + clamp(progress.climbRung || 0, 0, 8) * 2;
  const spec = PACES[pace];
  return spec.min + Math.floor(random() * (spec.max - spec.min + 1));
}

export function gradeRound(
  taps: number,
  target: number,
  flags?: { smashed?: boolean; rushed?: boolean; allowClose?: boolean },
): Grade {
  if (flags?.smashed || flags?.rushed) return "smear";
  if (taps === target) return "exact";
  if (flags?.allowClose !== false && Math.abs(taps - target) === 1) return "close";
  return "smear";
}

export function beatLost(gapMs: number, maxGap = PULSE_GAP): boolean {
  return gapMs > maxGap;
}

export function pauseText(ms: number): string {
  const seconds = ms / 1000;
  const trimmed = seconds.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  return `${trimmed}s`;
}

export function hudLine(pace: PaceId): string {
  const spec = PACES[pace];
  return `${spec.name} · ${pauseText(spec.settle)} pause`;
}

export function lockWaitMs(pace: PaceId, taps: number, target: number, smashed = false): number {
  const spec = PACES[pace];
  if (pace === "pulse" && !smashed && taps < target) return spec.maxGap ?? spec.settle;
  return spec.settle;
}

export function rushExpired(elapsedMs: number, limit = RUSH_LIMIT): boolean {
  return elapsedMs >= limit;
}

export function streakAfter(streak: number, grade: Grade): number {
  if (grade === "exact") return streak + 1;
  if (grade === "smear") return 0;
  return streak;
}

export function rampAfter(floor: number, grade: Grade): number {
  if (grade === "exact") return clamp(floor + 1, 5, 24);
  if (grade === "smear") return clamp(floor - 1, 5, 24);
  return clamp(floor, 5, 24);
}

export function climbAfter(rung: number, grade: Grade): number {
  if (grade === "exact") return clamp(rung + 1, 0, 8);
  if (grade === "smear") return clamp(rung - 1, 0, 8);
  return clamp(rung, 0, 8);
}

export function keepsPigment(grade: Grade): boolean {
  return grade === "exact" || grade === "close";
}

export function wallColor(pigment: Pigment, grade: Grade): Pigment {
  if (grade !== "close") return pigment;
  return { h: pigment.h, s: Math.max(28, pigment.s - 16), l: pigment.l };
}

export interface Coach {
  target: number;
  pace: PaceId;
  result: Grade | null;
  smashed: boolean;
  rushed: boolean;
  hideTarget: boolean;
}

export function coachLine(round: Coach): string {
  if (round.result === "exact") return "Locked.";
  if (round.result === "close") return "Close. The color stays, a little softer.";
  if (round.result === "smear" && round.smashed) return "The beat slipped.";
  if (round.result === "smear" && round.rushed) return "The bar ran out.";
  if (round.result === "smear") return "Off the count.";
  if (round.smashed) return "Beat lost. Matching the count still smears.";
  if (round.hideTarget) return "The number left. Pause on what you remember.";
  const word = WORDS[round.target] ?? String(round.target);
  if (round.pace === "pulse") return `Tap ${word}. Stay inside ${PULSE_GAP} ms.`;
  if (round.pace === "rush") return `Tap ${word} before the bar empties.`;
  if (round.pace === "drift") return `Tap ${word}. It leaves after the first tap.`;
  if (round.pace === "daily") return `Today, tap ${word}. A pause locks it.`;
  return `Tap ${word}. A pause locks it.`;
}

export function badgeLabel(result: Grade | null, newBest: boolean): string | null {
  if (!result) return null;
  if (newBest && result === "exact") return "New best";
  if (result === "exact") return "Exact";
  if (result === "close") return "Close";
  return "Smear";
}
