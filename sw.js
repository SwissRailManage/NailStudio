/* Jessy's Nail Studio – Service Worker: macht die App installierbar und offline nutzbar. */
const SHELL = "jns-shell-v5";   // bei einer neuen Version hochzählen (v2, v3, …)
const LIBS = "jns-libs-v1";     // Hand-Erkennung (ändert sich nicht)
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  // jede Datei einzeln: fehlt eine, funktioniert der Rest trotzdem
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== LIBS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const page = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
    if (page) {
      // Seite: zuerst das Netz (damit Updates ankommen), sonst die gespeicherte Fassung
      e.respondWith(fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put("./", copy)); }
        return res;
      }).catch(() => caches.match("./").then(r => r || caches.match("index.html"))));
    } else {
      // übrige Dateien: sofort aus dem Speicher, im Hintergrund auffrischen
      e.respondWith(caches.open(SHELL).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })));
    }
    return;
  }
  if (/(^|\.)cdn\.jsdelivr\.net$|(^|\.)storage\.googleapis\.com$/.test(url.hostname)) {
    // Hand-Erkennung: einmal laden, danach aus dem Speicher
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
  }
});
