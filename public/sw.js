const CACHE_NAME = 'lunas-diary-v1';
const MEDIA_CACHE_NAME = 'lunas-media-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/manifest.json'
];

// URLs to intercept and cache-first
const MEDIA_PATTERNS = [
    'drive.google.com/thumbnail',
    'docs.google.com/uc'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== MEDIA_CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Skip non-GET requests (like API posts to Apps Script)
    if (event.request.method !== 'GET') return;

    // 2. Media Caching Strategy: Cache-First
    const isMedia = MEDIA_PATTERNS.some(p => url.includes(p));
    if (isMedia) {
        event.respondWith(
            caches.open(MEDIA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) return response; // Return from cache
                    
                    // Otherwise fetch and save to cache
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return null; 
                    });
                });
            })
        );
        return;
    }

    // 3. API Strategy: Network Only
    // Never cache Supabase API calls, otherwise users see stale data (double-refresh bug)
    if (url.includes('supabase.co') || url.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 4. App Shell Strategy: Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => {
                    // Fail silently, we already gave the cached response if available
                });
                
                return cachedResponse || fetchPromise;
            });
        })
    );
});


// --- Periodic Background Sync ------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-check') {
    console.log('[SW] Periodic sync triggered');
    event.waitUntil(checkNewContentAndNotify());
  }
});

async function checkNewContentAndNotify() {
  try {
    // Note: We can't use our api.js here directly because it imports React/etc.
    // We'll perform a direct fetch to the Apps Script URL.
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoHZ9nmIEg_-DRt4LplZGYOKM2gs_egcUlGZlb9BB_MywXlNrlcHXRNkt0ZBqYjleZ/exec';
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'checkNewContent', params: { lastCheck: Date.now() - 900000 } })
    });
    
    const json = await response.json();
    if (json.success && json.data && json.data.length > 0) {
      for (const item of json.data) {
        self.registration.showNotification(item.title, {
          body: item.message,
          icon: '/favicon.svg', // Default icon
          badge: '/favicon.svg',
          data: item.data,
          vibrate: [200, 100, 200]
        });
      }
    }
  } catch (err) {
    console.error('[SW] Sync Error:', err);
  }
}

// --- Notification Click ------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let c of clientList) {
          if (c.focused) client = c;
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

