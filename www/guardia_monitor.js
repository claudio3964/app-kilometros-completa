"use strict";

// =====================================================
// GUARDIA MONITOR — COT Driver
// Avisa 5 min antes de cumplir 8h, 9h, 10h... de guardia
// =====================================================

console.log("guardia_monitor cargado");

const GUARDIA_AVISO_MINUTOS_ANTES = 5;   // avisar 5 min antes
const GUARDIA_HORAS_BASE          = 8;   // primera alerta: 8 horas
const GUARDIA_INTERVALO_MS        = 60 * 1000; // verificar cada 60s

let _monitorTimer        = null;
let _ultimoAvisoHoras    = null;  // última hora en la que se avisó
let _choferDecidio       = false; // chofer ya vio el aviso actual

// =====================================================
// INICIAR / DETENER
// =====================================================

function iniciarMonitorGuardia() {
  if (_monitorTimer) return;
  console.log("[GUARDIA] Monitor iniciado");
  _monitorTimer = setInterval(_verificarGuardia, GUARDIA_INTERVALO_MS);
  _verificarGuardia(); // verificar inmediatamente al iniciar
}

function detenerMonitorGuardia() {
  if (_monitorTimer) { clearInterval(_monitorTimer); _monitorTimer = null; }
  _ultimoAvisoHoras = null;
  _choferDecidio    = false;
  console.log("[GUARDIA] Monitor detenido");
}

// =====================================================
// LÓGICA PRINCIPAL
// =====================================================

function _verificarGuardia() {
  const order = getActiveOrder ? getActiveOrder() : null;
  if (!order || !order.guards) return;

  const guardiaActiva = order.guards.find(g => g.status === "en_curso");
  if (!guardiaActiva) {
    // No hay guardia activa — resetear estado
    _ultimoAvisoHoras = null;
    _choferDecidio    = false;
    return;
  }

  // Calcular minutos transcurridos
  const ahora      = new Date();
  const [hI, mI]   = guardiaActiva.inicio.split(":").map(Number);
  const inicioDate = new Date();
  inicioDate.setHours(hI, mI, 0, 0);

  // Manejar cruce de medianoche
  let transcurridoMs = ahora - inicioDate;
  if (transcurridoMs < 0) transcurridoMs += 24 * 60 * 60 * 1000;
  const transcurridoMin = Math.floor(transcurridoMs / 60000);

  // Calcular próximo umbral de aviso
  // Umbrales: 7h55, 8h55, 9h55, 10h55...
  const horasSiguiente = _calcularProximoUmbral(transcurridoMin);
  if (!horasSiguiente) return;

  const minUmbral = horasSiguiente * 60 - GUARDIA_AVISO_MINUTOS_ANTES;

  // ¿Estamos en la ventana de aviso? (entre minUmbral y minUmbral+2)
  const enVentana = transcurridoMin >= minUmbral && transcurridoMin < minUmbral + 3;

  if (!enVentana) return;

  // ¿Ya avisamos para este umbral?
  if (_ultimoAvisoHoras === horasSiguiente && _choferDecidio) return;

  _ultimoAvisoHoras = horasSiguiente;
  _choferDecidio    = false;

  console.log(`[GUARDIA] ⚠️ Aviso: faltan ${GUARDIA_AVISO_MINUTOS_ANTES} min para ${horasSiguiente}h`);
  _mostrarAvisoGuardia(guardiaActiva, horasSiguiente, transcurridoMin);
}

// Calcula el próximo umbral de horas a avisar
function _calcularProximoUmbral(transcurridoMin) {
  // Umbrales: 8h, 9h, 10h, 11h...
  for (let h = GUARDIA_HORAS_BASE; h <= 24; h++) {
    const minAviso = h * 60 - GUARDIA_AVISO_MINUTOS_ANTES;
    // Si estamos cerca de este umbral o lo pasamos pero no llegamos al siguiente
    if (transcurridoMin >= minAviso - 1 && transcurridoMin < h * 60 + 60) {
      return h;
    }
  }
  return null;
}

// =====================================================
// TOAST DE AVISO
// =====================================================

function _mostrarAvisoGuardia(guardia, horasSiguiente, transcurridoMin) {
  // Evitar duplicados
  if (document.getElementById("guardiaAvisoToast")) return;

  const hTrans = Math.floor(transcurridoMin / 60);
  const mTrans = transcurridoMin % 60;

  const toast = document.createElement("div");
  toast.id = "guardiaAvisoToast";
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    width:92%;max-width:400px;
    background:#111827;border:2px solid #f59e0b;
    border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:slideUpGuardia .3s ease;
  `;
  toast.innerHTML = `
    <style>
      @keyframes slideUpGuardia {
        from { transform:translateX(-50%) translateY(20px); opacity:0; }
        to   { transform:translateX(-50%) translateY(0);    opacity:1; }
      }
    </style>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:22px;">⏰</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#f59e0b;">AVISO DE GUARDIA</div>
        <div style="font-size:12px;color:#94a3b8;">Transcurrido: ${hTrans}h ${mTrans}min</div>
      </div>
    </div>
    <div style="font-size:13px;color:#e2e8f0;margin-bottom:12px;line-height:1.6;">
      ⚠️ Faltan <b style="color:#f59e0b;">${GUARDIA_AVISO_MINUTOS_ANTES} minutos</b> para completar
      <b style="color:#f59e0b;">${horasSiguiente} horas</b> de guardia.
      <br><span style="color:#64748b;font-size:12px;">Guardia ${guardia.type} — inicio: ${guardia.inicio}</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button id="guardiaFinalizarBtn" style="
        flex:1;background:#ef4444;color:white;
        border:none;border-radius:8px;padding:11px;
        font-size:14px;font-weight:600;cursor:pointer;">
        ✓ Finalizar guardia
      </button>
      <button id="guardiaContinuarBtn" style="
        flex:1;background:transparent;color:#10b981;
        border:2px solid #10b981;border-radius:8px;padding:11px;
        font-size:14px;cursor:pointer;">
        → Continuar
      </button>
    </div>
  `;
  document.body.appendChild(toast);

  // Botón finalizar
  document.getElementById("guardiaFinalizarBtn").addEventListener("click", () => {
    _cerrarAvisoGuardia();
    // Llamar la función de finalizar guardia
    if (typeof finalizarGuardiaUI === "function") {
      finalizarGuardiaUI(guardia.createdAt);
    } else if (typeof finalizarGuardia === "function") {
      finalizarGuardia(guardia.createdAt);
      if (typeof renderListaGuardias === "function") renderListaGuardias();
      if (typeof renderResumenDia === "function") renderResumenDia();
      if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    }
    detenerMonitorGuardia();
  });

  // Botón continuar
  document.getElementById("guardiaContinuarBtn").addEventListener("click", () => {
    _cerrarAvisoGuardia();
    _choferDecidio = true;
    console.log(`[GUARDIA] Chofer decidió continuar más allá de ${horasSiguiente}h`);
  });

  // Vibrar si está disponible
  if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

  // Mandar notificación local via SW si está disponible
  _notificarSW(horasSiguiente, hTrans, mTrans, guardia.inicio);
}

function _cerrarAvisoGuardia() {
  const t = document.getElementById("guardiaAvisoToast");
  if (t) t.remove();
}

// =====================================================
// NOTIFICACIÓN VÍA SERVICE WORKER (celu bloqueado)
// =====================================================

function _notificarSW(horasSiguiente, hTrans, mTrans, inicioGuardia) {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    tipo: "NOTIF_GUARDIA",
    payload: {
      horasSiguiente,
      transcurrido: `${hTrans}h ${mTrans}min`,
      inicio: inicioGuardia,
      channel_id: "guardias_driver"
    }
  });
}

// =====================================================
// INTEGRACIÓN — llamar desde app_bootstrap.js
// =====================================================

function onGuardiaIniciada() {
  detenerMonitorGuardia();
  setTimeout(() => iniciarMonitorGuardia(), 1000);
}

function onGuardiaFinalizada() {
  detenerMonitorGuardia();
}

// =====================================================
// EXPORTS
// =====================================================
window.iniciarMonitorGuardia  = iniciarMonitorGuardia;
window.detenerMonitorGuardia  = detenerMonitorGuardia;
window.onGuardiaIniciada      = onGuardiaIniciada;
window.onGuardiaFinalizada    = onGuardiaFinalizada;