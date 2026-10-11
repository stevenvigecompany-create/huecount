export function renderSw(cacheName, files) {
  return `const CACHE = ${JSON.stringify(cacheName)};
const SHELL = ${JSON.stringify(files)};

async function putAll(cache) {
  await Promise.all(SHELL.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response && response.ok) await cache.put(url, response);
    } catch (err) { /* skip a missing shell file */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(putAll).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shellFor(pathname) {
  if (pathname === "/play" || pathname === "/play/" || pathname === "/play.html") return "/play.html";
  if (pathname === "/" || pathname === "/index.html") return "/index.html";
  return null;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      const fallback = shellFor(url.pathname);
      if (request.mode === "navigate" && fallback) {
        const page = await caches.match(fallback);
        if (page) return page;
      }
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
`;
}
