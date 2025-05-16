// public/sw.js
const CACHE_NAME = 'notecolors-cache-v1.2'; // Versão do cache incrementada
const urlsToCache = [
  '/',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  // Adicione outros assets estáticos que você queira cachear.
  // Cuidado com os chunks dinâmicos do Next.js (_next/static/...)
];

// Domínios para os quais o Service Worker não deve interceptar o evento 'fetch'
const IGNORE_FETCH_DOMAINS = [
  'firestore.googleapis.com',
  'www.googleapis.com', // Para Google Sign-In se usado
  'identitytoolkit.googleapis.com', // Para Firebase Auth
  // Adicione outros domínios do Google/Firebase que podem ser relevantes se surgirem problemas
];

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        // Faz o cache de urlsToCache. Trata erros individuais para não falhar o install inteiro.
        const promises = urlsToCache.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[ServiceWorker] Failed to cache ${url}:`, err);
          });
        });
        return Promise.all(promises);
      })
      .then(() => {
        // Força o Service Worker em espera a se tornar o Service Worker ativo.
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Diz ao Service Worker ativo para assumir o controle da página imediatamente.
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Verifica se a requisição é para um domínio que deve ser completamente ignorado pelo manipulador fetch do Service Worker
  if (IGNORE_FETCH_DOMAINS.some(domain => requestUrl.hostname.includes(domain))) {
    // console.log('[ServiceWorker] Ignoring fetch event for domain:', requestUrl.href);
    return; // Deixa o navegador lidar com esta requisição como se o SW não estivesse aqui.
  }

  // Para outras requisições, tenta cache-first, depois rede
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // console.log('[ServiceWorker] Serving from cache:', event.request.url);
          return response;
        }
        // console.log('[ServiceWorker] Fetching from network:', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          // Clona a resposta, pois ela só pode ser consumida uma vez
          const responseToCache = networkResponse.clone();
          // Cacheia apenas requisições GET bem-sucedidas que não são opacas (ex: erros de CORS)
          if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             caches.open(CACHE_NAME)
              .then((cache) => {
                // console.log('[ServiceWorker] Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        });
      })
      .catch((error) => {
        console.error('[ServiceWorker] Fetch error:', error, 'URL:', event.request.url);
        // Você pode fornecer uma página de fallback aqui para requisições de navegação
        // if (event.request.mode === 'navigate') {
        //   return caches.match('/offline.html'); // Você precisaria ter um offline.html cacheado
        // }
        // Re-lança o erro para garantir que o navegador o trate se não for uma navegação
        throw error;
      })
  );
});
