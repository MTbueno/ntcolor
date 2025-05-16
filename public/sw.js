
const CACHE_NAME = 'notecolors-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/apple-touch-icon.png', // Adicione se este arquivo existir em /public
  // Adicione outros assets estáticos essenciais se necessário
  // Evite cachear rotas de API ou conteúdo altamente dinâmico aqui
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto: ', CACHE_NAME);
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(err => {
        console.error('Falha ao abrir cache ou adicionar URLs:', err);
      })
  );
  self.skipWaiting(); // Força o novo service worker a se ativar imediatamente
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Controla clientes não controlados imediatamente
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Domínios do Firebase/Google que não devem ser cacheados pelo Service Worker
  const firebaseHostnames = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com', // Firebase Auth
    'securetoken.googleapis.com', // Firebase Auth
    // Adicione outros domínios do Firebase se estiver usando outros serviços (ex: storage.googleapis.com)
  ];

  if (firebaseHostnames.includes(requestUrl.hostname)) {
    // Para requisições do Firebase, busca sempre da rede
    event.respondWith(fetch(event.request));
    return;
  }

  // Estratégia: Cache-first para outros recursos
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(
          networkResponse => {
            // Verifica se a resposta é válida para cachear
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        ).catch(error => {
          console.error('Fetch falhou; retornando do cache ou erro:', event.request.url, error);
          // Opcional: retornar uma página offline customizada
          // return caches.match('/offline.html');
          throw error;
        });
      })
  );
});
