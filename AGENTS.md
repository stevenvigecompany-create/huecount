# Huecount — agent notes

Source of truth for mechanics: `play.html`.

Rules:
- Client-only. No backend. No licensed audio files. No credit-card forms.
- Persist `localStorage["huecount-save-v2"]`. Never break `plus`, `theme`, `reduceFlashes`, `music`, `sound`.
- Music is Web Audio (`startMusic` / `duckMusic` / `swellMusic`). `save.music` is independent of `save.sound`.
- Pulse: `PACES.pulse.maxGap === 280`. Late tap → `smashBeat` → smear even if the count is exact.
- Free: Slow, Steady, Quick, Daily, Studio world. Plus: Pulse, Ramp/Drift/Climb/Rush, later worlds.
- Unlock Huecount+ sets `save.plus = true` on device. Real store IAP is a later Capacitor / TWA wrapper.
- Mobile first. Safe-area insets. `prefers-color-scheme`, `prefers-reduced-motion`, wake lock while playing.
- Don’t invert Light mode into gray. Play well stays a dark disc.
