"use strict";


// =====================================================
// 🚀 APP BOOTSTRAP — COT Driver
// =====================================================

console.log("app_bootstrap cargado");


// =====================================================
// DETECCIÓN DE CAMBIO DE DÍA
// =====================================================

function verificarCambioDeDia() {
  const order = getActiveOrder();
  if (!order) return;
  const hoy = new Date().toISOString().split("T")[0];
  if (order.date !== hoy) {
    mostrarModalCierrePendiente(order);
  }
}

function verificarCambioDeDiaForzado() {
  const hoy = new Date().toISOString().split("T")[0];
  const orders = getOrders ? getOrders() : [];
  const jornadaAbierta = orders.find(o => !o.closed && o.date !== hoy);
  if (jornadaAbierta) {
    console.warn("Jornada de otro día detectada:", jornadaAbierta.date);
    mostrarModalCierrePendiente(jornadaAbierta);
  }
}

function mostrarModalCierrePendiente(order) {
  if (document.getElementById("modalCambioDia")) return;
  const modal = document.createElement("div");
  modal.id = "modalCambioDia";
  modal.style.cssText = `
    position:fixed; top:0; left:0;
    width:100%; height:100%;
    background:rgba(0,0,0,0.6);
    display:flex; align-items:center;
    justify-content:center; z-index:9999;
  `;
  modal.innerHTML = `
    <div style="background:white; padding:20px; border-radius:8px;
                max-width:340px; text-align:center;">
      <h3>Jornada pendiente</h3>
      <p>Tenés una jornada pendiente del día <b>${order.date}</b>.<br>
         Debés finalizarla antes de continuar.</p>
      <button id="btnForzarCierre" style="
        background:#c62828; color:white;
        padding:10px 20px; border:none;
        border-radius:6px; font-weight:bold; cursor:pointer;">
        Finalizar Jornada
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("btnForzarCierre").addEventListener("click", async function () {
    const resultado = closeActiveOrder();
    if (resultado) {
      document.body.removeChild(modal);
      await exportarJornada(resultado);
      renderBotonCerrarJornada?.();
      renderOrdenActivaUI?.();
    }
  });
}

// =====================================================
// SINCRONIZACIÓN SEGURA DE ACTIVE ORDER
// =====================================================

function syncActiveOrderBootstrap() {
  let active = getActiveOrder();
  const orders = getOrders();

  if (!active && orders.length) {
    const last = orders[orders.length - 1];
    if (!last.closed) {
      console.warn("🔄 Recuperando activeOrder desde storage");
      setActiveOrder(last);
      active = last;
    }
  }
  if (!active) return;
  const real = orders.find(o => o.orderNumber === active.orderNumber && !o.closed);
  if (!real) {
    console.warn("activeOrder inválido eliminado (bootstrap)");
    clearActiveOrder();
    return;
  }
  if (real.travels) {
    real.travels.forEach(t => {
      if (t.status === "en_curso") {
        console.warn("Viaje en curso recuperado al iniciar app:", t.id);
      }
    });
  }
}

// =====================================================
// RENDER PRINCIPAL
// =====================================================

function refreshMainUI() {
  const o = getActiveOrder();
  const driver = window.getDriver?.() || {};
  // ── Datos del chofer en el header ──
  const nombreEl = document.getElementById('mainNombreChofer');
  const legajoEl = document.getElementById('mainLegajoChofer');
  if (nombreEl) nombreEl.textContent = driver.nombre || '—';
  if (legajoEl) legajoEl.textContent = `Legajo ${driver.legajo || '—'} · ${driver.base || 'Montevideo'}`;
  const info = document.getElementById("ordenActivaInfo");
  if (info) {
   info.innerText = o ? o.orderNumber : "";
  }
  const diaInput = document.getElementById("diaGuardia");
  if (diaInput) {
    diaInput.value = new Date().toISOString().split("T")[0];
  }
  if (typeof renderListaViajes === "function") renderListaViajes();
  if (typeof renderResumenDia === "function") renderResumenDia();
  if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
  if (typeof renderOrdenActivaUI === "function") renderOrdenActivaUI();
  if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
  if (typeof renderListaGuardias === "function") renderListaGuardias();
}

// =====================================================
// LIMPIAR DATOS COMPLETO
// =====================================================

async function limpiarTodosLosDatos() {
  const c1 = confirm("¿Borrar todos los datos de este dispositivo?");
  if (!c1) return;
  const c2 = confirm("Esta acción no se puede deshacer.\n\nLos datos ya subidos a Supabase NO se borran.\n¿Confirmar?");
  if (!c2) return;

  try {
    // Limpiar estado BG del SW antes de borrar todo
    enviarMensajeSW({ tipo: 'LIMPIAR_ESTADO_BG' });

    const conservar = ['device_id', 'driverProfile'];
    Object.keys(localStorage).forEach(k => {
      if (!conservar.includes(k)) localStorage.removeItem(k);
    });
    sessionStorage.clear();

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }

    setTimeout(() => {
      window.location.href = window.location.href.split('?')[0] + '?limpio=' + Date.now();
    }, 600);

  } catch (e) {
    console.error("Error limpiando datos:", e);
    const conservar2 = ['device_id', 'driverProfile'];
    Object.keys(localStorage).forEach(k => {
      if (!conservar2.includes(k)) localStorage.removeItem(k);
    });
    sessionStorage.clear();
    setTimeout(() => location.reload(), 400);
  }
}
window.limpiarTodosLosDatos = limpiarTodosLosDatos;

// =====================================================
// COMUNICACIÓN CON SERVICE WORKER
// =====================================================

function enviarMensajeSW(mensaje) {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage(mensaje);
}

// Sincroniza el estado de viajes programados al SW
// para que pueda verificar aunque la app esté en background
function syncEstadoAlSW() {
  const order = getActiveOrder ? getActiveOrder() : null;
  if (!order) return;

  const viajesProgramados = (order.travels || []).filter(
    t => t.status === 'programado' || t.status === 'en_curso'
  );

  enviarMensajeSW({
    tipo: 'SYNC_ESTADO_BG',
    payload: {
      viajes: viajesProgramados,
      orderNumber: order.orderNumber,
      ts: Date.now()
    }
  });
}

// Escuchar mensajes del SW → app
function iniciarListenerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (window.__swListenerActivo) return;
  window.__swListenerActivo = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const { tipo, data } = event.data || {};

    switch (tipo) {

      // SW detectó que un viaje programado debe activarse
      case 'ACTIVAR_VIAJES_PROGRAMADOS':
        console.log('[APP] SW: activar viajes programados');
        if (typeof verificarViajesProgramados === 'function') verificarViajesProgramados();
        if (typeof renderListaViajes === 'function') renderListaViajes();
        if (typeof mostrarViajeEnCursoUI === 'function') mostrarViajeEnCursoUI();
        if (typeof renderBotonCerrarJornada === 'function') renderBotonCerrarJornada();
        if (typeof renderResumenDia === 'function') renderResumenDia();
        _mostrarToastViajeIniciado();
        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        syncEstadoAlSW();
        break;

      // FIX 2.2 — SW manda estado con viajes activados en background
      // La app reconcilia: cualquier viaje "activado_bg" pasa a "en_curso" en localStorage
      case 'ESTADO_BG':
        if (event.data.payload?.viajes) {
          reconciliarEstadoBG(event.data.payload.viajes);
        }
        break;

      // Usuario clickeó la notificación push
      case 'NOTIF_CLICK':
        console.log('🔔 Notificación clickeada:', data);
        if (typeof showScreen === 'function') showScreen('mainScreen');
        if (typeof mostrarViajeEnCursoUI === 'function') mostrarViajeEnCursoUI();
        break;
        
    }
  });
}

// =====================================================
// BOOTSTRAP PRINCIPAL
// =====================================================

// =====================================================
// FIX 2.2 — RECONCILIACIÓN DE ESTADO BG
// Cuando la app abre, pide al SW si activó viajes
// mientras la app estaba muerta y los aplica al localStorage
// =====================================================

function reconciliarEstadoBG(viajesBG) {
  if (!viajesBG || !viajesBG.length) return;
  const order = getActiveOrder ? getActiveOrder() : null;
  if (!order || !order.travels) return;

  let cambio = false;
  viajesBG.forEach(vBG => {
    if (vBG.status !== 'activado_bg') return;
    const vLocal = order.travels.find(t => t.id === vBG.id);
    if (!vLocal || vLocal.status !== 'programado') return;

    // Aplicar activación que el SW registró en background
    vLocal.status = 'en_curso';
    vLocal.inicioReal = vBG.activadoBgAt || Date.now();
    cambio = true;
    console.log('[APP] Reconciliado viaje activado en background:', vLocal.id);
  });

  if (cambio) {
    saveOrders(getOrders().map(o => o.orderNumber === order.orderNumber ? order : o));
    setActiveOrder(order);
    if (typeof onViajeIniciado === 'function') onViajeIniciado();
    if (typeof renderListaViajes === 'function') renderListaViajes();
    if (typeof mostrarViajeEnCursoUI === 'function') mostrarViajeEnCursoUI();
    if (typeof renderBotonCerrarJornada === 'function') renderBotonCerrarJornada();
    if (typeof renderResumenDia === 'function') renderResumenDia();
    console.log('[APP] Reconciliación completada');
  }
}
window.reconciliarEstadoBG = reconciliarEstadoBG;

// =====================================================
// 🔄 OTA UPDATE CHECK
// =====================================================

const APP_VERSION = '2.1.4';
const OTA_URL = 'https://frjeivfpldcigklwepqt.supabase.co/storage/v1/object/public/app-updates/version.json';

async function checkOTA() {
  try {
    const res = await fetch(OTA_URL + '?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();

    if (data.version && data.version !== APP_VERSION) {
      mostrarModalOTA(data);
    }
  } catch (e) {
    console.warn('OTA check fallido:', e);
  }
}

function mostrarModalOTA(data) {
  if (document.getElementById('modalOTA')) return;

  const modal = document.createElement('div');
  modal.id = 'modalOTA';
  modal.style.cssText = `
    position:fixed; top:0; left:0;
    width:100%; height:100%;
    background:rgba(0,0,0,0.7);
    display:flex; align-items:center;
    justify-content:center; z-index:99999;
  `;
  modal.innerHTML = `
    <div style="background:#1e293b; padding:24px; border-radius:12px;
                max-width:320px; width:90%; text-align:center;
                border:1px solid #3b82f6; color:white;">
      <div style="font-size:36px; margin-bottom:12px;">🚀</div>
      <h3 style="margin:0 0 8px; color:#3b82f6;">Nueva versión disponible</h3>
      <p style="font-size:13px; color:#94a3b8; margin:0 0 6px;">
        v${APP_VERSION} → v${data.version}
      </p>
      <p style="font-size:13px; color:#e2e8f0; margin:0 0 20px;">
        ${data.changelog || ''}
      </p>
      <button id="btnOTAActualizar" style="
        background:#3b82f6; color:white;
        padding:12px 24px; border:none;
        border-radius:8px; font-weight:bold;
        font-size:15px; cursor:pointer; width:100%;
        margin-bottom:8px;">
        Actualizar ahora
      </button>
      ${!data.mandatory ? `<button id="btnOTALuego" style="
        background:transparent; color:#64748b;
        padding:8px; border:none;
        font-size:13px; cursor:pointer; width:100%;">
        Más tarde
      </button>` : ''}
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnOTAActualizar').addEventListener('click', () => {
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .finally(() => location.reload(true));
    } else {
      location.reload(true);
    }
  });

  const btnLuego = document.getElementById('btnOTALuego');
  if (btnLuego) {
    btnLuego.addEventListener('click', () => modal.remove());
  }
}

window.checkOTA = checkOTA;

// =====================================================
// CONFIGURACIÓN DESDE SUPABASE (LAUDO)
// =====================================================
async function cargarConfiguracion() {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor');

    if (error || !data) return;

    data.forEach(item => {
      if (item.clave === 'precio_km_conductor') {
        window.LAUDO_KM = parseFloat(item.valor);
      }
      if (item.clave === 'viatico_comida') {
        window.VIATICO_COMIDA = parseFloat(item.valor);
      }
      if (item.clave === 'viatico_alojamiento') {
        window.VIATICO_ALOJAMIENTO = parseFloat(item.valor);
      }
    });

    console.log('[CONFIG] Laudo cargado desde Supabase:', window.LAUDO_KM);
  } catch(e) {
    console.warn('[CONFIG] Error cargando config, usando valores locales:', e.message);
  }
}

  async function iniciarBootstrap() {
  await cargarConfiguracion(); // ← agregar acá
  checkOTA();
  syncActiveOrderBootstrap();
  refreshMainUI();
  verificarCambioDeDia();
  verificarCambioDeDiaForzado();

  // Cargar viajes programados desde Supabase
  if (typeof cargarViajesProgramadosDesdeSupabase === "function") {
    setTimeout(() => cargarViajesProgramadosDesdeSupabase(), 2000);
  }

  // Sincronizar pendientes con Supabase
  if (typeof syncPendientes === "function") {
    setTimeout(() => syncPendientes(), 1000);
  }

  // ── Motor local de viajes programados (foreground) — cada 15s ──────────
  if (!window.__motorViajesProgramados) {
    window.__motorViajesProgramados = setInterval(() => {
      if (typeof verificarViajesProgramados === "function") verificarViajesProgramados();
      if (typeof renderListaViajes === "function") renderListaViajes();
      if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
      if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    }, 15000);
  }

  // ── Motor de sync (cada 60s) ───────────────────────────────────────────
  if (!window.__motorSync) {
    window.__motorSync = setInterval(() => {
      if (typeof activarViajesProgramados === "function") activarViajesProgramados();
    }, 60000);
  }

  // ── Motor de guardias programadas (cada 60s) ──────────────────────────
  if (!window.__motorGuardiasProgramadas) {
    window.__motorGuardiasProgramadas = setInterval(() => {
      if (typeof verificarGuardiasProgramadas === 'function') verificarGuardiasProgramadas();
    }, 60000);
  }

  // ── Sync al SW cada 60s para mantener estado fresco ───────────────────
  if (!window.__motorSyncSW) {
    window.__motorSyncSW = setInterval(() => {
      syncEstadoAlSW();
    }, 60000);
  }

  // ── Listener de mensajes del SW ────────────────────────────────────────
  iniciarListenerSW();

  // ── Sync inicial al SW (esperar a que el SW esté listo) ───────────────
  setTimeout(() => syncEstadoAlSW(), 3000);

  // FIX 2.2 — pedir estado del SW para reconciliar viajes activados en background
  setTimeout(() => {
    enviarMensajeSW({ tipo: 'PEDIR_ESTADO_BG' });
  }, 3500);
   // ── Geo monitoreo origen (auto-inicio viaje) ───────────────────────────
  setTimeout(() => {
  try {
    if (typeof iniciarMonitoreoOrigen === "function") iniciarMonitoreoOrigen();
  } catch(e) {
    console.warn('[GEO] iniciarMonitoreoOrigen no disponible aún:', e.message);
  }
}, 4000);

  // ── Visibilitychange — foreground/background ───────────────────────────
  if (!window.__visibilityHandler) {
    window.__visibilityHandler = true;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // App va a background — sincronizar estado al SW
        console.log("📴 App a background — sincronizando estado al SW");
        enviarMensajeSW({ tipo: 'APP_BACKGROUND' });
        syncEstadoAlSW();
      } else {
        // App vuelve a foreground
        console.log("🔄 App volvió a foreground");
        enviarMensajeSW({ tipo: 'APP_FOREGROUND' });
        if (typeof verificarViajesProgramados === "function") verificarViajesProgramados();
        if (typeof activarViajesProgramados === "function") activarViajesProgramados();
        if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
        if (typeof renderResumenDia === "function") renderResumenDia();
        if (typeof iniciarMonitoreoOrigen === "function") iniciarMonitoreoOrigen(); 
        syncEstadoAlSW();
        // Long press en logo → modo prueba
const logoTrigger = document.getElementById('mainLogoTrigger');
if (logoTrigger) {
  let pressTimer;
  logoTrigger.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      document.getElementById('modoPruebaContainer').style.display = 'block';
    }, 1500);
  });
  logoTrigger.addEventListener('touchend', () => clearTimeout(pressTimer));
}
      }
    });
  }

  function _mostrarToastViajeIniciado() {
  const order = getActiveOrder ? getActiveOrder() : null;
  const viaje = order?.travels?.find(t => t.status === 'en_curso');
  if (!viaje) return;
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;top:70px;left:50%;transform:translateX(-50%);
    width:92%;max-width:420px;background:#111827;
    border:2px solid #10b981;border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.5);
    animation:slideDownMsg .3s ease;
  `;
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="font-size:22px;">🚍</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#10b981;">VIAJE INICIADO</div>
        <div style="font-size:12px;color:#94a3b8;">${viaje.origen} → ${viaje.destino}</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
        style="margin-left:auto;background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div style="font-size:13px;color:#e2e8f0;">
      🕒 Salida: <b style="color:#10b981;">${viaje.departureTime}</b>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 10000);
}

  // ── Botón limpiar storage ──────────────────────────────────────────────
  const btnLimpiar = document.getElementById("btnLimpiarStorage");
  if (btnLimpiar && !btnLimpiar._bound) {
    btnLimpiar._bound = true;
    btnLimpiar.addEventListener("click", limpiarTodosLosDatos);
  }

  // ── Polling de mensajes ────────────────────────────────────────────────
  if (typeof iniciarPollingMensajes === 'function') {
    setTimeout(() => iniciarPollingMensajes(), 5000);
  }

  // ── Token FCM ─────────────────────────────────────────────────────────
  setTimeout(() => {
    if (typeof registrarTokenFCM === 'function') registrarTokenFCM();
  }, 3000);
}

window.iniciarBootstrap        = iniciarBootstrap;
window.refreshMainUI           = refreshMainUI;
window.verificarCambioDeDia    = verificarCambioDeDia;
window.mostrarModalCierrePendiente = mostrarModalCierrePendiente;
window.syncEstadoAlSW          = syncEstadoAlSW;
window.enviarMensajeSW         = enviarMensajeSW;

