import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headersFor = (source: string) =>
  Object.fromEntries((vercel.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [h.key, h.value]));

describe("site hardening", () => {
  it("sends security headers on every route", () => {
    const h = headersFor("/(.*)");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    const csp = h["Content-Security-Policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("keeps /api out of search and the robots file in sync", () => {
    expect(headersFor("/api/(.*)")["X-Robots-Tag"]).toMatch(/noindex/);
    const robots = readFileSync(resolve(root, "public/robots.txt"), "utf8");
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/huecount\.vercel\.app\/sitemap\.xml$/m);
  });

  it("sitemap lists only the indexable pages on the canonical host", () => {
    const xml = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(["https://huecount.vercel.app/", "https://huecount.vercel.app/play"]);
    const index = readFileSync(resolve(root, "index.html"), "utf8");
    expect(index).toContain('rel="canonical" href="https://huecount.vercel.app/"');
    const play = readFileSync(resolve(root, "play.html"), "utf8");
    expect(play).toContain('rel="canonical" href="https://huecount.vercel.app/play"');
  });

  it("404 page is noindex, links back to play, and /privacy + /terms resolve", () => {
    const nf = readFileSync(resolve(root, "public/404.html"), "utf8");
    expect(nf).toContain('name="robots" content="noindex"');
    expect(nf).toContain('href="/play"');
    const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
    const map = Object.fromEntries(vercel.rewrites.map((r: { source: string; destination: string }) => [r.source, r.destination]));
    expect(map["/privacy"]).toBe("/privacy.html");
    expect(map["/terms"]).toBe("/terms.html");
  });

  it("legal pages stay noindex", () => {
    for (const f of ["public/privacy.html", "public/terms.html"]) {
      expect(readFileSync(resolve(root, f), "utf8")).toContain('name="robots" content="noindex"');
    }
  });

  it("every indexable page has complete share tags on its canonical URL", () => {
    for (const [file, url] of [
      ["index.html", "https://huecount.vercel.app/"],
      ["play.html", "https://huecount.vercel.app/play"],
    ] as const) {
      const html = readFileSync(resolve(root, file), "utf8");
      expect(html, file).toContain(`property="og:url" content="${url}"`);
      expect(html, file).toContain('property="og:type" content="website"');
      expect(html, file).toContain('property="og:image" content="https://huecount.vercel.app/og.png"');
      expect(html, file).toContain('property="og:image:width" content="1200"');
      expect(html, file).toContain('property="og:image:height" content="630"');
      expect(html, file).toContain('name="twitter:card" content="summary_large_image"');
      expect(html, file).toContain('name="twitter:image" content="https://huecount.vercel.app/og.png"');
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
      expect(title.length, file).toBeGreaterThan(12);
    }
  });
});
