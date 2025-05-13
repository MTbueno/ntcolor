// public/sw.js
const CACHE_NAME = 'kanbanflow-cache-v2'; // Increment cache version
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png', // Common PWA icon size
  '/icons/icon-512x512.png', // Larger PWA icon size
  '/apple-touch-icon.png', // iOS specific
  // Next.js static assets are hard to list manually.
  // Ideally, a build tool would inject these.
  // For now, we'll rely on runtime caching for other assets.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        // Use {cache: 'reload'} to bypass HTTP cache for these critical assets during SW install
        const cachePromises = urlsToCache.map(url => {
          return fetch(new Request(url, { cache: 'reload' }))
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch ${url} - ${response.status} ${response.statusText}`);
              }
              return cache.put(url, response);
            })
            .catch(error => {
              console.error(`Failed to cache ${url} during install:`, error);
              // Optionally, don't let a single failed asset prevent SW installation if some are non-critical
              // For now, we'll let it fail to highlight issues.
              throw error; 
            });
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting()) // Activate worker immediately
      .catch(error => {
        console.error('Failed to cache all required URLs during install:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients
  );
});

self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (HTML pages), try network first, then cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, clone it and cache it.
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try to get it from the cache.
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache and network failed, this is a true offline scenario for a new page.
              // A dedicated offline page would be ideal. For now, browser default error.
              // console.warn(`Navigate request failed for: ${event.request.url}, and not in cache.`);
              return new Response('You are offline and this page is not cached.', {
                status: 408, // Request Timeout
                headers: { 'Content-Type': 'text/plain' },
              });
            });
        })
    );
    return;
  }

  // For other assets (CSS, JS, images, etc.), use a cache-first, then network strategy.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Serve from cache
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(
          (networkResponse) => {
            // Check if we received a valid response to cache
            // Only cache 'basic' type responses (same-origin) to avoid caching opaque responses from CDNs if not desired.
            if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'default')) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch((error) => {
          // If network fails and not in cache, the asset won't load.
          console.warn(`Fetch failed for asset: ${event.request.url}, and not in cache. Error: ${error}`);
          // Depending on the asset type, you might return a placeholder.
          // For now, let the browser handle the failed resource load.
          return new Response(`Asset ${event.request.url} not available offline.`, {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
