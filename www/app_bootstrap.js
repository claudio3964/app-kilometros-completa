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
function mostrarModalCierrePendiente(order) {
  if (document.getElementById("modalCambioDia")) return;
  const modal = document.createElement("div");
  modal.id = "modalCambioDia";
  modal.style.cssText = "\n    position:fixed; top:0; left:0;\n    width:100%; height:100%;\n    background:rgba(0,0,0,0.6);\n    display:flex; align-items:center;\n    justify-content:center; z-index:9999;\n  ";
  modal.innerHTML = "\n    <div style=\"background:white; padding:20px; border-radius:8px;\n                max-width:340px; text-align:center;\">\n      <h3>Jornada pendiente</h3>\n      <p>Ten\xE9s una jornada pendiente del d\xEDa <b>".concat(order.date, "</b>.<br>\n         Deb\xE9s finalizarla antes de continuar.</p>\n      <button id=\"btnForzarCierre\" style=\"\n        background:#c62828; color:white;\n        padding:10px 20px; border:none;\n        border-radius:6px; font-weight:bold; cursor:pointer;\">\n        Finalizar Jornada\n      </button>\n    </div>\n  ");
  document.body.appendChild(modal);
  document.getElementById("btnForzarCierre").addEventListener("click", async function () {
    const resultado = closeActiveOrder();
    if (resultado) {
      var _renderBotonCerrarJor, _renderOrdenActivaUI;
      document.body.removeChild(modal);
      await exportarJornada(resultado);
      (_renderBotonCerrarJor = renderBotonCerrarJornada) === null || _renderBotonCerrarJor === void 0 || _renderBotonCerrarJor();
      (_renderOrdenActivaUI = renderOrdenActivaUI) === null || _renderOrdenActivaUI === void 0 || _renderOrdenActivaUI();
    }
  });
}

// =====================================================
// SINCRONIZACIÓN SEGURA DE ACTIVE ORDER
// =====================================================

function syncActiveOrderBootstrap() {
  let active = getActiveOrder();
  const orders = getOrders();

  // Recuperar orden abierta si no hay activa
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
// BOOTSTRAP PRINCIPAL — se ejecuta después del registro
// (llamado desde ui_registro.js al mostrar mainScreen)
// =====================================================

function iniciarBootstrap() {
  syncActiveOrderBootstrap();
  refreshMainUI();
  verificarCambioDeDia();

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

  // Motor de viajes programados (cada 60s)
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

  // Botón limpiar storage
  const btnLimpiar = document.getElementById("btnLimpiarStorage");
  if (btnLimpiar && !btnLimpiar._bound) {
    btnLimpiar._bound = true;
    btnLimpiar.addEventListener("click", function () {
      const c1 = confirm("¿Borrar todos los datos?");
      if (!c1) return;
      const c2 = confirm("Esta acción no se puede deshacer. ¿Confirmar?");
      if (!c2) return;
      localStorage.clear();
      location.reload();
    });
  }
}
window.iniciarBootstrap = iniciarBootstrap;
window.refreshMainUI = refreshMainUI;
window.verificarCambioDeDia = verificarCambioDeDia;
window.mostrarModalCierrePendiente = mostrarModalCierrePendiente;
