"use strict";

const CACHE_NAME = "moya-kuhnya-pwa-v1";
const CORE_FILES = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

const scopeUrl = self.registration.scope;
const indexUrl = new URL("./index.html", scopeUrl).href;
const coreUrls = CORE_FILES.map(path => new URL(path, scopeUrl).href);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(coreUrls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("moya-kuhnya-pwa-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  // Не перехватываем запросы Wikimedia и других внешних сайтов.
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cachedPage = await caches.match(indexUrl);
        if (cachedPage) return cachedPage;
        return Response.error();
      }
    })());
    return;
  }

  // Сначала пробуем сеть, чтобы новые фотографии подхватывались;
  // при отсутствии сети используем сохранённую копию.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok && (response.type === "basic" || response.type === "default")) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return Response.error();
    }
  })());
});
