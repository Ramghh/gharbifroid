// ⚠️ لازم نزيدو CACHE_NAME (نبدلو الرقم) كل مرة نبدلو فيها index.html أو أي ملف من app-shell
// هذا يجبر الأجهزة تجيب النسخة الجديدة بدل ما تخدم بالقديمة المخزنة (cache).
const CACHE_NAME = 'tabrid-cache-v40';
const RUNTIME_CACHE = 'tabrid-runtime-v1'; // كاش منفصل للخطوط وTailwind (موارد خارجية)

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png'
];

// موارد خارجية (خطوط + Tailwind) نحبو نضمنو خدمتها أوفلاين 100%
const EXTERNAL_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800;900&family=Cairo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap',
  'https://cdn.tailwindcss.com'
];

// الدومانات اللي نحبو نخزنوها أوفلاين (خطوط + Tailwind) — أي حاجة أخرى (Firebase/Firestore) تمشي عادي للنتورك
const CACHEABLE_CROSS_ORIGIN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.tailwindcss.com'];

// ============ INSTALL: نخزنو الـ app shell + نجربو نخزنو الموارد الخارجية ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
      caches.open(RUNTIME_CACHE).then((cache) =>
        // كل واحدة لوحدها (بلا Promise.all صارم) باش لو وحدة فشلت (مثلاً بلا نات وقت التنصيب) البقية تكمل
        Promise.allSettled(EXTERNAL_PRECACHE.map((url) => cache.add(url)))
      )
    ])
  );
  self.skipWaiting();
});

// ============ ACTIVATE: نمسحو الكاش القديم (نخليو الكاش الحالي + كاش الموارد الخارجية) ============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ============ FETCH ============
// نخدمو بـ "Cache falling back to network" للـ app shell + الخطوط/Tailwind (تحميل سريع + يخدم أوفلاين)
// ونخليو طلبات Firebase/Firestore تمشي مباشرة للنتورك (عندها نظام الأوفلاين الخاص بيها IndexedDB)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isSameOrigin = url.origin === self.location.origin;
  const isCacheableExternal = CACHEABLE_CROSS_ORIGIN_HOSTS.includes(url.hostname);

  // ما نتدخلوش في طلبات Firebase Auth / Firestore / أي دومان آخر غير مدرج فوق
  if (!isSameOrigin && !isCacheableExternal) {
    return;
  }

  const targetCache = isSameOrigin ? CACHE_NAME : RUNTIME_CACHE;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // الموارد الخارجية (خط Tailwind، Google Fonts) غالباً "opaque" (status غير مقروء) — نخزنوها بالكل
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(targetCache).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // أوفلاين وما فماش كاش لهذا الطلب بالضبط

      // نرجعو النسخة المخزنة فوراً إذا موجودة (سريع)، ونحدثوها في الخلفية
      return cached || networkFetch;
    })
  );
});

// ============ NOTIFICATIONCLICK: نفتحو أو نفوكسيو التطبيق كي يضغط المستخدم على التنبيه ============
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
