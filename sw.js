// 스케쥴러 및 도전카드 서비스 워커: 앱 파일을 미리 저장해 오프라인에서도 열리게 한다
const VERSION = "sched-v3";
const CORE = ["./", "index.html", "js/app.js", "js/forms.js", "js/store.js", "js/render.js", "js/pngmeta.js", "manifest.webmanifest", "icons/icon-192-v1.png", "icons/icon-512-v1.png", "icons/apple-touch-icon-v1.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // 앱 화면: 네트워크 우선(업데이트 바로 반영), 안 되면 저장본
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put("index.html", c)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  const url = new URL(e.request.url);
  // 앱 코드: 네트워크 우선(업데이트 바로 반영), 오프라인이면 저장본
  if (url.origin === location.origin && url.pathname.endsWith(".js") && !url.pathname.endsWith("sw.js")) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  // 아이콘·글꼴: 저장본 우선 (이미지에 쓰는 글꼴도 오프라인에서 쓰도록)
  if (url.origin === location.origin || url.host.endsWith("fonts.googleapis.com") || url.host.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); }
      return r;
    })));
  }
});
