# Huecount

Tap the count. Lock the color.

Huecount is a one-thumb fidget for a phone. A glass dial shows the count. You tap it, then stop. A short pause locks the color on its own. An exact count keeps the pigment on the wall. One off still stays, a little softer. A miss leaves the wall alone. No account, no ads, no server.

The free game is the whole fidget: Slow, Steady, Quick, Daily, Pulse, Ramp, Drift, Climb, and Rush, the Studio room, and the Tick sound. Huecount Plus is a one-time $3 unlock stored on the device. It adds the After dark and Open air color packs, the Glass and Wood sounds, and a local streak log. Until a payment link is configured, Plus says "coming soon" and the free game keeps working.

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

## Huecount Plus

Plus is checked on the server (`api/plus.js`). Nothing secret is in the browser bundle.

| Vercel env (server only) | Purpose |
| --- | --- |
| `STRIPE_PAYMENT_LINK` | $3-once Payment Link. Unset = button reads **Plus coming soon**. |
| `PLUS_CODE_SHA256` | sha256 hex of the restore code (`printf '%s' "$CODE" \| sha256sum`). |
| `PLUS_TOKEN_SECRET` | 32+ random chars; signs Plus tokens. |

`GET /api/plus` returns only `{ unlockUrl, restore }`. `POST /api/plus {op:"restore", code}` checks the code against the hash on the server and returns a signed token; the app stores `plus` only together with that token and re-verifies it with `{op:"verify"}` on every launch (a forged or missing token turns Plus off). Editing `localStorage` to `plus: true` no longer unlocks anything.

Stripe Payment Link success URL: `https://huecount.vercel.app/play?plus=THE_CODE`; also put THE_CODE in the receipt. Env changes take effect on the next deploy.

## Deploy on Vercel

The site is a static Vite build. Leave `STRIPE_PAYMENT_LINK` unset until Steven creates the link. Plus stays **coming soon**.

1. Framework preset: **Vite**.
2. Install command: `npm install`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Leave the Plus environment variables empty.

`vercel.json` serves `/play` from `play.html` and keeps the service worker uncached so updates install. From a machine logged into the Vercel account that owns the hostname:

```bash
npm install
npx vercel --prod
```

Use the same build command and `dist` output if the CLI asks. Publishing to `huecount.vercel.app` needs the Vercel account that already owns that hostname.

## Fonts

[Syne](https://fonts.google.com/specimen/Syne) and [Manrope](https://fonts.google.com/specimen/Manrope) are self-hosted so the app still typesets offline. Both are under the SIL Open Font License; see `public/fonts/OFL-Syne.txt` and `public/fonts/OFL-Manrope.txt`.
