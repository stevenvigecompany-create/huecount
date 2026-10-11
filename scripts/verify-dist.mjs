import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`dist check failed: ${message}`);
    process.exit(1);
  }
}

assert(existsSync("dist/index.html"), "index.html");
assert(existsSync("dist/play.html"), "play.html");
assert(existsSync("dist/sw.js"), "service worker");
assert(existsSync("dist/manifest.webmanifest"), "manifest");
assert(existsSync("dist/icon-192.png"), "192 icon");
assert(existsSync("dist/icon-512.png"), "512 icon");
assert(statSync("dist/icon-192.png").size > 800, "192 icon is not empty");
assert(statSync("dist/icon-512.png").size > 800, "512 icon is not empty");

const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert(manifest.name === "Huecount", "manifest name");
assert(manifest.display === "standalone", "standalone display");
assert(manifest.start_url === "/play", "start url");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "icons");

const sw = readFileSync("dist/sw.js", "utf8");
assert(sw.includes("/play.html"), "service worker precaches play");
assert(sw.includes("caches"), "service worker uses caches");
assert(sw.includes("navigator") === false || sw.includes("fetch"), "fetch handler");

const play = readFileSync("dist/play.html", "utf8");
assert(play.includes("manifest"), "play links the manifest");
assert(play.includes("/assets/"), "play bundles assets");

const scripts = readdirSync("dist/assets").filter((name) => name.endsWith(".js"));
const bundled = scripts.map((name) => readFileSync(`dist/assets/${name}`, "utf8")).join("\n");
assert(bundled.includes("serviceWorker"), "app registers the service worker");
assert(bundled.includes("vibrate"), "haptics are wired");

console.log("dist ok");
