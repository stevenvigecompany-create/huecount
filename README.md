# Huecount

Tap the count. Lock the color.

Huecount is a one-thumb fidget for a phone. A glass dial shows the count. You tap it, then lock. An exact count keeps the pigment on the wall. One off still stays, a little softer. A miss leaves the wall alone. No account, no ads, no server.

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

Plus is a local entitlement. There is no account. Stripe is not called from this app. The unlock button opens a [Stripe Payment Link](https://docs.stripe.com/payment-links) when one is set at build time.

Set either name. Vite reads both:

| Purpose | Preferred | Also accepted |
| --- | --- | --- |
| Payment Link | `VITE_UNLOCK_URL` | `NEXT_PUBLIC_UNLOCK_URL` |
| Restore-code hash | `VITE_PLUS_CODE_SHA256` | `NEXT_PUBLIC_PLUS_CODE_SHA256` |

This release ships with both variables unset. The button reads **Plus coming soon**. There is no live payment link. The free fidget still plays.

When Stripe is connected later, set the variables and redeploy. Until then, leave them empty on Vercel.

### Why a restore code

A signed token needs a server secret and a Stripe webhook. Stripe is not connected, and this site has no backend, so the client cannot check a Checkout session. The restore code stays off the client. The app only stores the SHA-256 of that code and compares it in constant time. Someone can still edit `localStorage` on their own phone. That is the limit of a no-account unlock, and the code is what a paying person uses on a new phone.

1. Make a code and do not commit it:

   ```bash
   CODE="$(openssl rand -hex 16)"
   printf '%s' "$CODE" | sha256sum
   ```

2. Put the hex digest in `VITE_PLUS_CODE_SHA256` on Vercel. Put the Payment Link in `VITE_UNLOCK_URL`. The link should charge **$3 once**.
3. In the Payment Link, set the success URL to:

   `https://huecount.vercel.app/play?plus=THE_CODE`

4. Also put `THE_CODE` in the Stripe confirmation message, so they can type it under Settings → Huecount Plus → Restore code.
5. Redeploy. The values are baked in at build time. Changing them needs a new build so the service worker picks up the new script.

Returning from Stripe with `?plus=` strips the code from the address, hashes it, and if it matches, sets `plus: true` in `huecount-save-v1`. The same field restores Plus after the phone is wiped. A wrong code does not unlock. A build with no hash says coming soon instead of pretending a payment went through.

## Deploy on Vercel

The site is a static Vite build. Do not set `VITE_UNLOCK_URL` or `VITE_PLUS_CODE_SHA256` for this release. Plus stays **coming soon**.

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
