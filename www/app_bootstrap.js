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
  const info = document.getElementById("ordenActivaInfo");
  if (info) {
    info.innerText = o ? "🟢 Jornada activa: " + o.orderNumber : "🔴 Sin jornada activa";
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
// LIMPIAR DATOS COMPLETO — funciona en PWA iOS/Android
// =====================================================

async function limpiarTodosLosDatos() {
  const c1 = confirm("¿Borrar todos los datos de este dispositivo?");
  if (!c1) return;
  const c2 = confirm("Esta acción no se puede deshacer.\n\nLos datos ya subidos a Supabase NO se borran.\n¿Confirmar?");
  if (!c2) return;

  try {
    // 1. Limpiar localStorage y sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // 2. Limpiar cache del service worker (crítico en PWA iOS Safari)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log("✅ Cache limpiado:", cacheNames);
    }

    // 3. Desregistrar service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log("✅ Service workers desregistrados:", registrations.length);
    }

    // 4. Esperar un momento y recargar forzando recarga desde servidor
    setTimeout(() => {
      // location.reload(true) fuerza recarga ignorando cache en la mayoría de browsers
      window.location.href = window.location.href.split('?')[0] + '?limpio=' + Date.now();
    }, 600);

  } catch (e) {
    console.error("Error limpiando datos:", e);
    // Fallback: solo limpiar localStorage y recargar
    localStorage.clear();
    sessionStorage.clear();
    setTimeout(() => location.reload(), 400);
  }
}
window.limpiarTodosLosDatos = limpiarTodosLosDatos;

// =====================================================
// BOOTSTRAP PRINCIPAL
// =====================================================

function iniciarBootstrap() {
  syncActiveOrderBootstrap();
  refreshMainUI();
  verificarCambioDeDia();
  verificarCambioDeDiaForzado();

  // Cargar viajes programados desde Supabase (efectivos)
  if (typeof cargarViajesProgramadosDesdeSupabase === "function") {
    setTimeout(() => cargarViajesProgramadosDesdeSupabase(), 2000);
  }

  // Sincronizar pendientes con Supabase
  if (typeof syncPendientes === "function") {
    setTimeout(() => syncPendientes(), 1000);
  }

  // Motor automático de viajes programados (cada 15s)
  if (!window.__motorViajesProgramados) {
    window.__motorViajesProgramados = setInterval(() => {
      if (typeof verificarViajesProgramados === "function") verificarViajesProgramados();
      if (typeof renderListaViajes === "function") renderListaViajes();
      if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
      if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    }, 15000);
  }

  // Motor de sync (cada 60s)
  if (!window.__motorSync) {
    window.__motorSync = setInterval(() => {
      if (typeof activarViajesProgramados === "function") activarViajesProgramados();
    }, 60000);
  }

  // Reactivación al volver a la app
  if (!window.__visibilityHandler) {
    window.__visibilityHandler = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        console.log("🔄 App volvió a foreground");
        if (typeof activarViajesProgramados === "function") activarViajesProgramados();
        if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
      }
    });
  }

  // ── Botón limpiar storage (versión vieja — por compatibilidad) ──
  const btnLimpiar = document.getElementById("btnLimpiarStorage");
  if (btnLimpiar && !btnLimpiar._bound) {
    btnLimpiar._bound = true;
    btnLimpiar.addEventListener("click", limpiarTodosLosDatos);
  }
  // Iniciar polling de mensajes
if (typeof iniciarPollingMensajes === 'function') {
  setTimeout(() => {
    
    iniciarPollingMensajes();
  }, 5000);
}
}

window.iniciarBootstrap = iniciarBootstrap;
window.refreshMainUI = refreshMainUI;
window.verificarCambioDeDia = verificarCambioDeDia;
window.mostrarModalCierrePendiente = mostrarModalCierrePendiente;
