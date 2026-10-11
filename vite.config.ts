import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { renderSw } from "./scripts/render-sw.mjs";

const DEV_SHELL = [
  "/",
  "/index.html",
  "/play",
  "/play.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/fonts/syne-latin.woff2",
  "/fonts/manrope-latin.woff2",
];

function rewritePlay(req: { url?: string }, _res: unknown, next: () => void): void {
  if (!req.url) {
    next();
    return;
  }
  const q = req.url.indexOf("?");
  const path = q === -1 ? req.url : req.url.slice(0, q);
  const query = q === -1 ? "" : req.url.slice(q);
  if (path === "/play" || path === "/play/") req.url = `/play.html${query}`;
  next();
}

function routes(): Plugin {
  return {
    name: "huecount-routes",
    configureServer(server) {
      server.middlewares.use(rewritePlay);
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/sw.js") {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(renderSw("huecount-dev", DEV_SHELL));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewritePlay);
    },
  };
}

function walk(dir: string, root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "sw.js") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, root));
    else out.push(`/${relative(root, full).split("\\").join("/")}`);
  }
  return out;
}

function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function precache(): Plugin {
  return {
    name: "huecount-precache",
    apply: "build",
    closeBundle() {
      const dist = resolve("dist");
      const files = ["/", "/play", ...walk(dist, dist)];
      const cache = `huecount-${fingerprint(files.join("|"))}`;
      writeFileSync(join(dist, "sw.js"), renderSw(cache, files));
    },
  };
}

export default defineConfig(() => {
  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [routes(), precache()],
    build: {
      rollupOptions: {
        input: {
          main: resolve("index.html"),
          play: resolve("play.html"),
        },
      },
    },
    server: { host: "127.0.0.1", port: 43123, strictPort: true },
    preview: { host: "127.0.0.1", port: 43123, strictPort: true },
  };
});
