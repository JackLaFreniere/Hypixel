// Service Worker for GitHub Pages to handle headers and caching
// This addresses Lighthouse cache-control and security warnings

const CACHE_NAME = 'hypixel-calculators-v1.1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/site.js',
  '/calculators/forge-calculator.html',
  '/calculators/crystal-calculator.html',
  '/calculators/corpse-roi-calculator.html',
  '/calculators/cold-resistance-calculator.html',
  // Add your image paths here
  '/assets/Images/Items/SkyBlock_items_shattered_pendant.png',
  '/assets/Images/Crystals/SkyBlock_items_jasper_crystal.png',
  '/assets/Images/Symbols/SkyBlock_icons_cold_resistance.png',
  '/assets/Images/Locations/Minecraft_items_furnace.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
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
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with proper headers
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // If we have a cached response, modify its headers
        if (response) {
          const newHeaders = new Headers(response.headers);
          
          // Add security headers that GitHub Pages doesn't provide
          newHeaders.set('X-Content-Type-Options', 'nosniff');
          newHeaders.set('X-Frame-Options', 'DENY');
          
          // Add cache control and content-type based on file type
          const url = new URL(event.request.url);
          const extension = url.pathname.split('.').pop().toLowerCase();
          
          // Set proper content-type with UTF-8 charset for text files
          if (extension === 'html' || !extension) {
            newHeaders.set('Content-Type', 'text/html; charset=utf-8');
            newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');
          } else if (extension === 'css') {
            newHeaders.set('Content-Type', 'text/css; charset=utf-8');
            newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (extension === 'js') {
            newHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
            newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension)) {
            // Images - no charset needed
            newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
          }
          
          // Create new response with updated headers
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        }
        
        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response before caching
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});