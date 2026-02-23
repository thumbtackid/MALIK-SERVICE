// ============================================
// MALIK SERVICE - SERVICE WORKER v2.0
// Strategy: Stale While Revalidate
// ============================================

const CACHE_VERSION = 'malik-service-v2.0.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

const OFFLINE_FALLBACK = './index.html';

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Cache First Strategy (for static assets)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_STATIC);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    console.error('[SW] Cache first failed:', err);
    return caches.match(OFFLINE_FALLBACK);
  }
}

// Fetch Event - Route Requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) return;
  
  // Static assets - Cache First
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset) || url.pathname === asset.replace('./', '/'))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Google Fonts - Stale While Revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // API calls - Network First with timeout
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  
  // Default - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Background Sync for form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-order') {
    console.log('[SW] Background sync: sync-order');
  }
});

// Push Notification Handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Ada update dari Malik Service',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect fill="%232563eb" width="96" height="96" rx="16"/%3E%3Cpath fill="white" d="M48 20c-15.5 0-28 12.5-28 28s12.5 28 28 28 28-12.5 28-28-12.5-28-28-28z"/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect fill="%232563eb" width="96" height="96" rx="16"/%3E%3C/svg%3E',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Malik Service', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(event.notification.data.url || './');
      })
  );
});

console.log('[SW] Service Worker loaded - Malik Service v2.0.0');