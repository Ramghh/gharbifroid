// ⚠️ لازم نزيدو CACHE_NAME (نبدلو الرقم) كل مرة نبدلو فيها index.html أو أي ملف من app-shell
// هذا يجبر الأجهزة تجيب النسخة الجديدة بدل ما تخدم بالقديمة المخزنة (cache).
const CACHE_NAME = 'tabrid-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// ============ INSTALL: نخزنو الـ app shell ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ============ ACTIVATE: نمسحو الكاش القديم ============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ============ FETCH ============
// نخدمو بـ "Cache falling back to network" للـ app shell (تحميل سريع + يخدم أوفلاين)
// ونخليو طلبات Firebase/Firestore تمشي مباشرة للنتورك (عندها نظام الأوفلاين الخاص بيها IndexedDB)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ما نتدخلوش في طلبات Firebase Auth / Firestore / أي دومان خارجي غير موقعنا
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // أوفلاين وما فماش كاش لهذا الطلب بالضبط

      // نرجعو النسخة المخزنة فوراً إذا موجودة (سريع)، ونحدثوها في الخلفية
      return cached || networkFetch;
    })
  );
});
