# Huecount

Tap the count. Lock the color.

Huecount is a one-thumb fidget for a phone. A glass dial shows the count. You tap it, then lock. An exact count keeps the pigment on the wall and grows your streak. One off still stays, a little softer. A miss resets the streak and leaves the wall alone. Your best streak is the high score, stored on the device. No account, no ads, no server.

Every pace is included: Slow, Steady, Quick, Daily, Pulse, Ramp, Drift, Climb, and Rush. Rooms — Studio, Dusk, Glass, Field, and Ink — shift the light around the dial.

## Play locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The game itself is at [http://127.0.0.1:43123/play](http://127.0.0.1:43123/play).

```bash
npm test
npm run build
npm run preview
```

`npm run build` typechecks, writes `dist/`, and checks that the manifest, icons, and service worker are in the output.

## Install

The production build is an offline PWA: a web manifest plus a service worker that precaches the shell. Chrome and Edge can offer an Install button. On iPhone, use Share → Add to Home Screen. The installed app opens straight into the game.

Android and desktop Chrome can pulse the hand with `navigator.vibrate`. iPhone Safari does not expose that API, so the dial still presses in, ripples, and ticks. Sound and music have their own switches in Settings. Reduce motion turns the pops and the drifting color off, and the app also follows the system setting.

## Deploy on Vercel

The site is static. The build does not need environment variables.

1. Push this project to a Git repository.
2. In Vercel, import the repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Install command: `npm install`.
7. Deploy.

`vercel.json` serves `/play` from `play.html` and keeps the service worker uncached so updates install. From a machine with the Vercel CLI:

```bash
npm install
npx vercel
```

Use the same build command and `dist` output if the CLI asks.

## Fonts

[Syne](https://fonts.google.com/specimen/Syne) and [Manrope](https://fonts.google.com/specimen/Manrope) are self-hosted so the app still typesets offline. Both are under the SIL Open Font License; see `public/fonts/OFL-Syne.txt` and `public/fonts/OFL-Manrope.txt`.
