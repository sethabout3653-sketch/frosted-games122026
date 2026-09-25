/**
 * Scramjet Proxy Service Worker
 * Intercepts requests under /scramjet/service/ and routes them to the Scramjet proxy pipeline.
 */
importScripts('/scramjet/scramjet.config.js');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const prefix = self.__scramjet$config?.prefix || '/scramjet/service/';

  if (url.pathname.startsWith(prefix)) {
    // Route request through the Scramjet proxy engine
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[Scramjet SW] Proxy request failed, retrying via server gateway:', err);
        return fetch(event.request.url);
      })
    );
  }
});
