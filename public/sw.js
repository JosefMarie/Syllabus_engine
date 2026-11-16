// Online-Always Cleanup Worker:
// Automatically deletes all legacy PWA caches and unregisters any previously installed Service Worker
// so browsers always fetch fresh assets directly from Firebase Hosting.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((client) => {
          if ("navigate" in client) {
            client.navigate(client.url).catch(() => {});
          }
        });
      })
      .catch(() => {})
  );
});
