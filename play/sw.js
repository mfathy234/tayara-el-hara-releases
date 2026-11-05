// Service worker for the web build. Registered as sw.js?v=<PRODUCT_VERSION>; the version names the cache, so a new build
// drops every older cache on activate. Build/* files have content-hash names (nameFilesAsHashes), so they are immutable
// and served cache-first. index.html is network-first and decides which Build/* files belong together; after a fresh
// index arrives every cached Build/* file it does not mention is deleted, so old and new engine files are never mixed.
var VERSION = new URL(self.location.href).searchParams.get("v") || "0";
var CACHE = "tayara-" + VERSION;
var SCOPE = self.registration.scope;
var INDEX_KEY = new URL("index.html", SCOPE).href;
var SHELL = ["manifest.webmanifest", "TemplateData/favicon.png", "TemplateData/icon-192.png", "TemplateData/icon-512.png",
  "TemplateData/apple-touch-icon.png", "TemplateData/logo.png", "TemplateData/Lalezar.ttf"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    var jobs = SHELL.map(function (u) {
      return fetch(new Request(u, { cache: "reload" })).then(function (r) { if (r.ok) return cache.put(u, r); }).catch(function () {});
    });
    jobs.push(fetch(new Request("index.html", { cache: "reload" })).then(function (r) { if (r.ok) return cache.put(INDEX_KEY, r); }).catch(function () {}));
    return Promise.all(jobs);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("tayara-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isIndex(url) {
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

function pruneBuild(cache, indexText) {
  return cache.keys().then(function (reqs) {
    return Promise.all(reqs.map(function (r) {
      var p = new URL(r.url).pathname;
      var at = p.indexOf("/Build/");
      if (at < 0) return null;
      return indexText.indexOf(p.slice(at + 7)) < 0 ? cache.delete(r) : null;
    }));
  });
}

function networkFirstIndex(req) {
  return fetch(new Request(req.url, { cache: "no-cache" })).then(function (res) {
    if (res.ok) {
      var forCache = res.clone();
      var forText = res.clone();
      caches.open(CACHE).then(function (cache) {
        return cache.put(INDEX_KEY, forCache).then(function () { return forText.text(); }).then(function (text) { return pruneBuild(cache, text); });
      }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.open(CACHE).then(function (cache) {
      return cache.match(INDEX_KEY).then(function (hit) { return hit || Response.error(); });
    });
  });
}

function cacheFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res.ok && res.status === 200) cache.put(req, res.clone());
        return res;
      });
    });
  });
}

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.open(CACHE).then(function (c) { return c.match(req).then(function (hit) { return hit || Response.error(); }); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(new URL(SCOPE).pathname) !== 0) return;
  if (url.pathname.endsWith("/sw.js")) return;
  if (req.mode === "navigate" || isIndex(url)) { e.respondWith(networkFirstIndex(req)); return; }
  if (url.pathname.indexOf("/Build/") >= 0) { e.respondWith(cacheFirst(req)); return; }
  if (url.pathname.indexOf("/StreamingAssets/") >= 0) return;
  e.respondWith(networkFirst(req));
});
