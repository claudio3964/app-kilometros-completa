// =====================================================
// COT Driver — Service Worker v4
// Fix 2.2: SW actualiza estado propio en background
// Fix 2.6: flag notificado evita spam de notificaciones
// =====================================================

const CACHE_NAME = 'cot-app-v2';
const STATE_CACHE = 'cot-bg-state-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== STATE_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// =====================================================
// ESTADO BG
// =====================================================

async function leerEstadoBG() {
  try {
    const cache = await caches.open(STATE_CACHE);
    const res = await cache.match('/bg-state');
    if (!res) return null;
    return await res.json();
  } catch(e) { return null; }
}

async function escribirEstadoBG(estado) {
  try {
    const cache = await caches.open(STATE_CACHE);
    await cache.put('/bg-state', new Response(JSON.stringify(estado), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch(e) {}
}

// =====================================================
// BACKGROUND RUNNER
// =====================================================

let _bgInterval = null;
let _bgActivo = false;

function iniciarBackgroundRunner() {
  if (_bgActivo) return;
  _bgActivo = true;
  console.log('[SW] Background runner v4 iniciado');
  _bgInterval = setInterval(() => {
    verificarYActivarViajesProgramados();
  }, 30000);
}

function detenerBackgroundRunner() {
  if (_bgInterval) { clearInterval(_bgInterval); _bgInterval = null; }
  _bgActivo = false;
}

// =====================================================
// FIX 2.2 + 2.6
// El SW ahora actualiza su propio estado en background.
// Status "activado_bg" = app lo reconcilia al abrir.
// Flag notificado = no spam de notificaciones.
// =====================================================

async function verificarYActivarViajesProgramados() {
  const estado = await leerEstadoBG();
  if (!estado || !estado.viajes) return;

  const ahora = Date.now();
  let huboActivacion = false;

  estado.viajes.forEach(v => {
    if (v.status !== 'programado') return;
    if (!v.inicioProgramado || v.inicioProgramado > ahora) return;

    console.log('[SW] Activando viaje en background:', v.id);
    v.status = 'activado_bg';
    v.activadoBgAt = ahora;
    huboActivacion = true;

    // Notificar solo una vez por viaje
    if (!v.notificado) {
      v.notificado = true;
      self.registration.showNotification('Viaje iniciado', {
        body: `${v.origen} -> ${v.destino} | Salida: ${v.departureTime}`,
        icon: './icons/icon-192.png',
        badge: './icons/icon-72.png',
        tag: 'viaje-' + v.id,
        requireInteraction: true,
        data: { viajeId: v.id, tipo: 'viaje_programado' }
      });
    }
  });

  if (!huboActivacion) return;

  // Persistir estado actualizado en cache del SW
  await escribirEstadoBG(estado);
  console.log('[SW] Estado persistido con viajes activados en background');

  // Avisar a clientes activos si los hay
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients.forEach(client => {
      client.postMessage({ tipo: 'ACTIVAR_VIAJES_PROGRAMADOS', ts: ahora });
    });
  }
}

// =====================================================
// MENSAJES DESDE LA APP
// =====================================================

self.addEventListener('message', async (event) => {
  const { tipo, payload } = event.data || {};

  switch (tipo) {

    case 'SYNC_ESTADO_BG':
      await escribirEstadoBG(payload);
      if (!_bgActivo) iniciarBackgroundRunner();
      event.source?.postMessage({ tipo: 'SYNC_OK' });
      break;

    case 'VERIFICAR_AHORA':
      await verificarYActivarViajesProgramados();
      break;

    // La app pide el estado del SW al abrir — para reconciliar viajes activados en bg
    case 'PEDIR_ESTADO_BG':
      const estadoActual = await leerEstadoBG();
      event.source?.postMessage({ tipo: 'ESTADO_BG', payload: estadoActual });
      break;

    case 'APP_FOREGROUND':
      console.log('[SW] App en foreground');
      break;

    case 'APP_BACKGROUND':
      console.log('[SW] App en background — runner activo');
      if (!_bgActivo) iniciarBackgroundRunner();
      break;

    case 'LIMPIAR_ESTADO_BG':
      await escribirEstadoBG(null);
      detenerBackgroundRunner();
      break;

    case 'NOTIF_GUARDIA':
      self.registration.showNotification('Aviso de Guardia', {
        body: `Faltan 5 min para ${payload.horasSiguiente}h | Inicio: ${payload.inicio}`,
        icon: './icons/icon-192.png',
        tag: 'guardia-aviso',
        requireInteraction: true,
        android: { channelId: 'guardias_driver' },
        data: { tipo: 'guardia' }
      });
      break;
  }
});

// =====================================================
// CLICK EN NOTIFICACION
// =====================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ tipo: 'NOTIF_CLICK', data });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// =====================================================
// PUSH FCM
// =====================================================

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch(e) {}

  if (payload.tipo === 'viaje_programado' || payload.tipo === 'activar_viaje') {
    event.waitUntil(verificarYActivarViajesProgramados());
    return;
  }

  const titulo = payload.title || 'COT Driver';
  const opciones = {
    body: payload.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    data: payload,
    android: { channelId: 'mensajes_driver' }
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

iniciarBackgroundRunner();