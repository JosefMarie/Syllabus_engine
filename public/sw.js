const CACHE_NAME = "syllabus-pwa-v5";

// Static assets to precache immediately on install (public safe assets only)
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/syllabus/view"
];

// Install Event: pre-cache core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Some assets failed to precache during install:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Offline-first Stale-While-Revalidate with Network fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Firebase Cloud Firestore, Auth & Storage APIs (they have built-in offline caches)
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("identitytoolkit") ||
    url.hostname.includes("securetoken") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // 2. HTML Navigation requests: Network-First, fallback to Cache, fallback to Root
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;

          // For sub-routes in SPA, fallback to cached root or view
          if (url.pathname.startsWith("/syllabus/view")) {
            const viewFallback = await caches.match("/syllabus/view");
            if (viewFallback) return viewFallback;
          }
          const rootFallback = await caches.match("/");
          if (rootFallback) return rootFallback;

          return new Response("You are currently offline. Please reconnect to access this syllabus content.", {
            headers: { "Content-Type": "text/html" }
          });
        })
    );
    return;
  }

  // 3. Static assets (_next/static, css, js, fonts, images): Cache-First with Network Revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, and asynchronously update cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch((fetchErr) => {
        // If image fails offline, return a transparent or fallback SVG if desired
        return Promise.reject(fetchErr);
      });
    })
  );
});

// Allow immediate activation when requested
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
