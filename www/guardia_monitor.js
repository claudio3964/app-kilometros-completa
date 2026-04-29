"use strict";

// =====================================================
// GUARDIA MONITOR — COT Driver
// Avisa 5 min antes de cumplir 8h, 9h, 10h... de guardia
// + Recordatorio de tipo cada 1 hora (nueva funcionalidad)
// =====================================================

console.log("guardia_monitor cargado");

const GUARDIA_AVISO_MINUTOS_ANTES  = 5;         // avisar 5 min antes de umbral de horas
const GUARDIA_HORAS_BASE           = 8;         // primera alerta de duración: 8 horas
const GUARDIA_INTERVALO_MS         = 60 * 1000; // verificar cada 60s

// --- Estado interno ---
let _monitorTimer         = null;
let _ultimoAvisoHoras     = null;
let _choferDecidio        = false;

// Recordatorio de tipo: registra la última hora (HH) en que se mostró el recordatorio
let _ultimoRecordatorioTipo = null;

// =====================================================
// INICIAR / DETENER
// =====================================================

function iniciarMonitorGuardia() {
  if (_monitorTimer) return;
  console.log("[GUARDIA] Monitor iniciado");
  _monitorTimer = setInterval(_verificarGuardia, GUARDIA_INTERVALO_MS);
  _verificarGuardia();
}

function detenerMonitorGuardia() {
  if (_monitorTimer) { clearInterval(_monitorTimer); _monitorTimer = null; }
  _ultimoAvisoHoras        = null;
  _choferDecidio           = false;
  _ultimoRecordatorioTipo  = null;
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
    _ultimoAvisoHoras       = null;
    _choferDecidio          = false;
    _ultimoRecordatorioTipo = null;
    return;
  }

  const ahora      = new Date();
  const [hI, mI]   = guardiaActiva.inicio.split(":").map(Number);
  const inicioDate = new Date();
  inicioDate.setHours(hI, mI, 0, 0);

  let transcurridoMs = ahora - inicioDate;
  if (transcurridoMs < 0) transcurridoMs += 24 * 60 * 60 * 1000;
  const transcurridoMin = Math.floor(transcurridoMs / 60000);

  // --- Check 1: aviso de duración (8h, 9h, 10h...) ---
  const horasSiguiente = _calcularProximoUmbral(transcurridoMin);
  if (horasSiguiente) {
    const minUmbral = horasSiguiente * 60 - GUARDIA_AVISO_MINUTOS_ANTES;
    const enVentana = transcurridoMin >= minUmbral && transcurridoMin < minUmbral + 3;

    if (enVentana && !(_ultimoAvisoHoras === horasSiguiente && _choferDecidio)) {
      _ultimoAvisoHoras = horasSiguiente;
      _choferDecidio    = false;
      console.log(`[GUARDIA] ⚠️ Aviso duración: faltan ${GUARDIA_AVISO_MINUTOS_ANTES} min para ${horasSiguiente}h`);
      _mostrarAvisoGuardia(guardiaActiva, horasSiguiente, transcurridoMin);
      return; // no mostrar ambos toasts a la vez
    }
  }

  // --- Check 2: recordatorio de tipo cada 1 hora exacta ---
  _verificarRecordatorioTipo(guardiaActiva, transcurridoMin);
}

// =====================================================
// RECORDATORIO DE TIPO — cada hora completa
// =====================================================

function _verificarRecordatorioTipo(guardiaActiva, transcurridoMin) {
  // Solo si ya pasó al menos 1 hora de guardia
  if (transcurridoMin < 60) return;

  // Calcular en qué hora entera estamos (1, 2, 3...)
  const horaCompletaActual = Math.floor(transcurridoMin / 60);

  // Ventana: entre el minuto exacto de la hora y los 2 minutos siguientes
  const minEnHora = transcurridoMin % 60;
  const enVentanaHora = minEnHora >= 0 && minEnHora < 3;

  if (!enVentanaHora) return;

  // ¿Ya mostramos el recordatorio para esta hora?
  if (_ultimoRecordatorioTipo === horaCompletaActual) return;

  // Detectar si el tipo actual difiere del tipo del primer tramo del día
  // (para saber si ya hubo un cambio)
  const order = getActiveOrder ? getActiveOrder() : null;
  if (!order || !order.guards) return;

  const tipoActual = guardiaActiva.type;
  const primerTramo = order.guards.find(g => g.dia === guardiaActiva.dia);
  const tipoOriginal = primerTramo ? primerTramo.type : tipoActual;

  _ultimoRecordatorioTipo = horaCompletaActual;

  console.log(`[GUARDIA] 🔔 Recordatorio tipo — hora ${horaCompletaActual} transcurrida. Tipo actual: ${tipoActual}, Original: ${tipoOriginal}`);

  _mostrarRecordatorioTipo(guardiaActiva, tipoActual, tipoOriginal, horaCompletaActual);
}

function _mostrarRecordatorioTipo(guardia, tipoActual, tipoOriginal, horaTranscurrida) {
  // Evitar duplicados
  if (document.getElementById("guardiaRecordatorioTipoToast")) return;

  const labelActual   = tipoActual   === "comun" ? "Común"   : "Especial";
  const labelOriginal = tipoOriginal === "comun" ? "Común"   : "Especial";
  const cambiado      = tipoActual !== tipoOriginal;
  const colorBorde    = tipoActual === "especial" ? "#7c3aed" : "#0369a1";

  const toast = document.createElement("div");
  toast.id = "guardiaRecordatorioTipoToast";
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    width:92%;max-width:400px;
    background:#111827;border:2px solid ${colorBorde};
    border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:slideUpGuardia .3s ease;
  `;

  const mensajeInfo = cambiado
    ? `Estás en guardia <b style="color:${colorBorde};">${labelActual}</b> (comenzaste en <b>${labelOriginal}</b>).`
    : `Estás en guardia <b style="color:${colorBorde};">${labelActual}</b>.`;

  toast.innerHTML = `
    <style>
      @keyframes slideUpGuardia {
        from { transform:translateX(-50%) translateY(20px); opacity:0; }
        to   { transform:translateX(-50%) translateY(0);    opacity:1; }
      }
    </style>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:20px;">🔔</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#94a3b8;">RECORDATORIO — ${horaTranscurrida}h de guardia</div>
        <div style="font-size:12px;color:#64748b;">Inicio: ${guardia.inicio}</div>
      </div>
    </div>
    <div style="font-size:13px;color:#e2e8f0;margin-bottom:12px;line-height:1.6;">
      ${mensajeInfo}<br>
      <span style="font-size:12px;color:#64748b;">¿Continuás con el mismo tipo o cambiás?</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button id="tipoVolverBtn" style="
        flex:1;background:transparent;color:#10b981;
        border:2px solid #10b981;border-radius:8px;padding:10px;
        font-size:13px;font-weight:600;cursor:pointer;
        ${!cambiado ? 'opacity:0.4;pointer-events:none;' : ''}
      ">
        ← Volver a ${labelOriginal}
      </button>
      <button id="tipoContinuarBtn" style="
        flex:1;background:${colorBorde};color:white;
        border:none;border-radius:8px;padding:10px;
        font-size:13px;font-weight:600;cursor:pointer;">
        ✓ Continuar ${labelActual}
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Botón continuar
  document.getElementById("tipoContinuarBtn").addEventListener("click", () => {
    _cerrarRecordatorioTipo();
    console.log(`[GUARDIA] Chofer continúa en ${tipoActual}`);
  });

  // Botón volver al tipo original (solo si hubo cambio)
  document.getElementById("tipoVolverBtn").addEventListener("click", () => {
    _cerrarRecordatorioTipo();
    if (typeof cambiarTipoGuardiaUI === "function") {
      cambiarTipoGuardiaUI();
    }
  });

  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);

  // Notificar via SW (celu bloqueado)
  _notificarSWTipo(tipoActual, labelOriginal, cambiado, guardia.inicio);
}

function _cerrarRecordatorioTipo() {
  const t = document.getElementById("guardiaRecordatorioTipoToast");
  if (t) t.remove();
}

// =====================================================
// AVISO DE DURACIÓN (8h, 9h, 10h...)
// =====================================================

function _calcularProximoUmbral(transcurridoMin) {
  for (let h = GUARDIA_HORAS_BASE; h <= 24; h++) {
    const minAviso = h * 60 - GUARDIA_AVISO_MINUTOS_ANTES;
    if (transcurridoMin >= minAviso - 1 && transcurridoMin < h * 60 + 60) {
      return h;
    }
  }
  return null;
}

function _mostrarAvisoGuardia(guardia, horasSiguiente, transcurridoMin) {
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

  document.getElementById("guardiaFinalizarBtn").addEventListener("click", () => {
    _cerrarAvisoGuardia();
    if (typeof finalizarGuardiaUI === "function") {
      finalizarGuardiaUI(guardia.createdAt);
    } else if (typeof finalizarGuardia === "function") {
      finalizarGuardia(guardia.createdAt);
      if (typeof renderListaGuardias     === "function") renderListaGuardias();
      if (typeof renderResumenDia        === "function") renderResumenDia();
      if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    }
    detenerMonitorGuardia();
  });

  document.getElementById("guardiaContinuarBtn").addEventListener("click", () => {
    _cerrarAvisoGuardia();
    _choferDecidio = true;
    console.log(`[GUARDIA] Chofer decidió continuar más allá de ${horasSiguiente}h`);
  });

  if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
  _notificarSW(horasSiguiente, hTrans, mTrans, guardia.inicio);
}

function _cerrarAvisoGuardia() {
  const t = document.getElementById("guardiaAvisoToast");
  if (t) t.remove();
}

// =====================================================
// NOTIFICACIONES VÍA SERVICE WORKER
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

function _notificarSWTipo(tipoActual, labelOriginal, cambiado, inicioGuardia) {
  if (!navigator.serviceWorker?.controller) return;
  const body = cambiado
    ? `Estás en ${tipoActual}. ¿Continuás o volvés a ${labelOriginal}?`
    : `Estás en guardia ${tipoActual}. ¿Continuás?`;
  navigator.serviceWorker.controller.postMessage({
    tipo: "NOTIF_TIPO_GUARDIA",
    payload: {
      body,
      inicio: inicioGuardia,
      channel_id: "guardias_driver"
    }
  });
}

// =====================================================
// INTEGRACIÓN
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