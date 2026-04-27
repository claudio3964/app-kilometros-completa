// =====================================================
// COT Driver — Service Worker v3
// Cache + Background Runner para viajes programados
// =====================================================

const CACHE_NAME = 'cot-app-v2';
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

// =====================================================
// INSTALL / ACTIVATE — sin cambios
// =====================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// =====================================================
// BACKGROUND RUNNER — motor de viajes programados
// =====================================================

let _bgInterval = null;
let _bgActivo = false;

function iniciarBackgroundRunner() {
  if (_bgActivo) return;
  _bgActivo = true;
  console.log('[SW] Background runner iniciado');

  // Verificar cada 30s desde el SW
  _bgInterval = setInterval(() => {
    verificarYNotificarViajesProgramados();
  }, 30000);
}

function detenerBackgroundRunner() {
  if (_bgInterval) { clearInterval(_bgInterval); _bgInterval = null; }
  _bgActivo = false;
  console.log('[SW] Background runner detenido');
}

// ── Leer viajes programados desde IndexedDB / SW cache ────────────────────
// El SW no tiene acceso a localStorage — usamos un cache dedicado para estado
const STATE_CACHE = 'cot-bg-state-v1';

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

async function verificarYNotificarViajesProgramados() {
  const estado = await leerEstadoBG();
  if (!estado || !estado.viajes) return;

  const ahora = Date.now();
  let huboActivacion = false;

  estado.viajes.forEach(v => {
    if (v.status === 'programado' && v.inicioProgramado && v.inicioProgramado <= ahora) {
      console.log('[SW] Viaje programado listo para activar:', v.id);
      huboActivacion = true;

      // Mandar notificación push al usuario
      self.registration.showNotification('🚍 Viaje programado', {
        body: `${v.origen} → ${v.destino} | Salida: ${v.departureTime}`,
        icon: './icons/icon-192.png',
        badge: './icons/icon-72.png',
        tag: 'viaje-' + v.id,
        requireInteraction: true,        // no desaparece sola
        data: { viajeId: v.id, tipo: 'viaje_programado' }
      });
    }
  });

  if (huboActivacion) {
    // Avisar a todos los clientes (tabs abiertas) para que actualicen la UI
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    allClients.forEach(client => {
      client.postMessage({ tipo: 'ACTIVAR_VIAJES_PROGRAMADOS', ts: ahora });
    });
  }
}

// =====================================================
// MENSAJES DESDE LA APP → SW
// =====================================================

self.addEventListener('message', async (event) => {
  const { tipo, payload } = event.data || {};

  switch (tipo) {

    // La app manda el estado actual de viajes programados al SW
    case 'SYNC_ESTADO_BG':
      await escribirEstadoBG(payload);
      if (!_bgActivo) iniciarBackgroundRunner();
      event.source?.postMessage({ tipo: 'SYNC_OK' });
      break;

    // La app pide que el SW verifique ahora mismo
    case 'VERIFICAR_AHORA':
      await verificarYNotificarViajesProgramados();
      break;

    // La app está activa — el SW puede pausar (la app maneja su propio motor)
    case 'APP_FOREGROUND':
      console.log('[SW] App en foreground — background runner en modo pasivo');
      // No detener — seguir corriendo por si la app va a background
      break;

    // La app va a background — asegurarse de que el runner esté activo
    case 'APP_BACKGROUND':
      console.log('[SW] App en background — activando runner agresivo');
      if (!_bgActivo) iniciarBackgroundRunner();
      break;

    // Limpiar estado
    case 'LIMPIAR_ESTADO_BG':
      await escribirEstadoBG(null);
      detenerBackgroundRunner();
      break;
      //aviso de 5 min de fin de guardia
      case 'NOTIF_GUARDIA':
      self.registration.showNotification('⏰ Aviso de Guardia', {
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
// CLICK EN NOTIFICACIÓN → abrir app
// =====================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si la app ya está abierta, enfocarla y mandarle el evento
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ tipo: 'NOTIF_CLICK', data });
          return;
        }
      }
      // Si no está abierta, abrirla
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

// =====================================================
// PUSH FCM — recibir notificación del servidor
// =====================================================

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch(e) {}

  // Si el servidor manda un viaje programado via FCM, activar verificación
  if (payload.tipo === 'viaje_programado' || payload.tipo === 'activar_viaje') {
    event.waitUntil(verificarYNotificarViajesProgramados());
    return;
  }

  // Notificación genérica
  const titulo = payload.title || 'COT Driver';
   const opciones = {
    body: payload.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    data: payload,
    // ── canal alta prioridad ──
    android: { channelId: 'mensajes_driver' }
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// Iniciar runner al cargar el SW
iniciarBackgroundRunner();
