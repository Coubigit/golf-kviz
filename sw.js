var CACHE = "golfquiz-v11";
var ASSETS = ["./", "index.html", "styles.css", "config.js", "app.js", "data/questions.json", "manifest.webmanifest", "icons/icon.svg", "img/q004-zluta-oblast.jpg", "img/q004-otazka.jpg"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
// Síť napřed (aby se aktualizace otázek projevily), offline záloha z cache.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // Revizní stránka /revize/ jde vždy přímo ze sítě, service worker ji necachuje.
  var path = new URL(e.request.url).pathname;
  if (path.indexOf("/revize/") !== -1) return;
  // Nové fotky (img/foto/) zatím používá jen revize – necachujeme je, ať cache nenafukují.
  if (path.indexOf("/img/foto/") !== -1) return;
  e.respondWith(fetch(e.request).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r; }).catch(function () { return caches.match(e.request); }));
});
