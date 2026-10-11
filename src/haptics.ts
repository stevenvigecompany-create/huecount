export const HAPTIC = {
  tap: 12,
  arrival: [8, 28, 14],
  exact: [12, 36, 16, 48, 22],
  close: [10, 32, 12],
  smear: [24, 46, 24],
  smash: [18, 32, 18],
} as const;

export type HapticPattern = number | readonly number[];

type Vibrate = (pattern: number | number[]) => boolean;

export function hapticAvailable(
  nav: { vibrate?: unknown } | null | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  return !!nav && typeof nav.vibrate === "function";
}

export function playHaptic(pattern: HapticPattern, enabled: boolean, vibrate?: Vibrate | null): boolean {
  if (!enabled) return false;
  const fn =
    vibrate === undefined
      ? hapticAvailable()
        ? navigator.vibrate.bind(navigator)
        : null
      : vibrate;
  if (!fn) return false;
  const payload = typeof pattern === "number" ? pattern : [...pattern];
  try {
    return !!fn(payload);
  } catch {
    return false;
  }
}
