# Huecount — agent notes

Source of truth: `play.html`.

## Current bugs to keep fixed

- Auto-lock must use `armLockTimer()` (setTimeout) on every tap. Do not rely only on requestAnimationFrame — preview tabs stall rAF and pause never commits.
- Paces must feel different:
  - Slow: settle 1600, counts 1–3
  - Steady: settle 800, counts 1–5
  - Quick: settle 280, counts 2–7
  - Pulse: settle 220, maxGap 260
- HUD shows `Steady · 0.8s pause` while playing.
- Lock button is optional. Pause commits.

## Rules

- Client-only. No backend. No licensed audio. No card forms.
- Persist `localStorage["huecount-save-v2"]`. Never break `plus`, `theme`, `reduceFlashes`, `music`, `sound`.
- Music is Web Audio (`startMusic` / `duckMusic` / `swellMusic`).
- Free: Slow, Steady, Quick, Daily, Studio world. Plus: Pulse, challenges, later worlds.
