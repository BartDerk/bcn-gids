// Verhoog VERSION bij elke nieuwe release: dan verschijnt "Nieuwe versie beschikbaar".
const VERSION = "v19";
const CACHE = "bcn-" + VERSION;
const TILES = "bcn-tiles";
const MAX_TILES = 2000;

const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/app.css", "js/app.js", "js/places.js", "js/bike.js", "js/gastcode.js",
  "lib/leaflet/leaflet.js", "lib/leaflet/leaflet.css", "lib/leaflet/images/marker-icon.png", "lib/leaflet/images/layers.png",
  "data/tapas.json", "data/tapas-photos.json", "data/phrases.json", "data/places.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    // foto's van de plaatsen: mislukte foto's breken de installatie niet
    try {
      const places = await (await fetch("data/places.json", {cache: "no-store"})).json();
      await Promise.all(places.filter(p => p.photo).map(p => c.add(p.photo).catch(() => {})));
      const tp = await (await fetch("data/tapas-photos.json", {cache: "no-store"})).json();
      await Promise.all(Object.values(tp).map(p => c.add(p.file).catch(() => {})));
    } catch (err) {}
  }));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith("bcn-") && k !== CACHE && k !== TILES).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // kaarttegels: cache-first
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(caches.open(TILES).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") { cache.put(req, res.clone()); trimTiles(cache); }
      return res;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // eigen bestanden: stale-while-revalidate
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    return req.mode === "navigate" ? cache.match("index.html") : Response.error();
  }));
});
