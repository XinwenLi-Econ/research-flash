// ResearchFlash Service Worker
// 版本号用于缓存更新
const CACHE_VERSION = 'v3';
const CACHE_NAME = `researchflash-${CACHE_VERSION}`;

// 需要预缓存的静态资源
const PRECACHE_ASSETS = [
  '/',
  '/offline',
];

// 安装事件 - 预缓存关键资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('researchflash-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // 立即控制所有客户端
  self.clients.claim();
});

// 请求拦截 - 全部使用 Network First 策略确保获取最新资源
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API 请求不缓存（已有 IndexedDB 处理）
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 所有请求使用 Network First，确保获取最新资源
  event.respondWith(networkFirst(request));
});

// Network First 策略
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network request failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // 如果是导航请求，返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    throw error;
  }
}
