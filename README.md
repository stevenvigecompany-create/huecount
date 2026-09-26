# Huecount

Tap the count. Lock the color.

A mobile-first fidget / clicker. One HTML game (`play.html`) plus a small landing page (`index.html`).

## Run locally

```bash
cd huecount
npx --yes serve .
```

Open the printed localhost URL. Landing is `/`. Game is `/play.html`.

## Deploy

```bash
npx --yes vercel
```

Or enable GitHub Pages on this repo (Settings → Pages → Deploy from branch `main` / root).

## Grok CLI

```bash
cd huecount
grok "Read AGENTS.md and play.html. Keep Web Audio music on save.music. No MP3s. Keep Free vs Huecount+, Pulse maxGap 280ms, Calm light, system theme."
```

## What’s in the build

- Play loop: tap the count, pause or Lock. Exact / Close / Smear.
- Pulse: inter-tap max 280ms or you lose the beat.
- Free vs Huecount+ (on-device unlock in this build).
- Dark / Light / System. Calm light. PWA install on iOS + Android.
- Generative music bed (Web Audio). Separate Music / Sound toggles.

Save key: `huecount-save-v2` in localStorage.
