// =====================================================
// GUARDIA MONITOR — COT Driver
// Avisa 5 min antes de 8h, 9h, 10h...
// Si no hay respuesta en 10 min → cierra a la hora exacta
// =====================================================

console.log("guardia_monitor cargado");

const GUARDIA_AVISO_MIN_ANTES  = 5;          // avisar 5 min antes del umbral
const GUARDIA_TIMEOUT_MIN      = 10;         // auto-cierre si no responde en 10 min
const GUARDIA_HORAS_BASE       = 8;          // primera alerta: 8 horas
const GUARDIA_INTERVALO_MS     = 60 * 1000;  // verificar cada 60s

let _monitorTimer      = null;
let _ultimoAvisoHoras  = null;
let _choferDecidio     = false;
let _autoCloseTimer    = null;

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
  if (_autoCloseTimer) { clearTimeout(_autoCloseTimer); _autoCloseTimer = null; }
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
    _ultimoAvisoHoras = null;
    _choferDecidio    = false;
    return;
  }

  const ahora      = new Date();
  const [hI, mI]   = guardiaActiva.inicio.split(":").map(Number);
  const inicioDate = new Date();
  inicioDate.setHours(hI, mI, 0, 0);

  let transcurridoMs = ahora - inicioDate;
  if (transcurridoMs < 0) transcurridoMs += 24 * 60 * 60 * 1000;
  const transcurridoMin = Math.floor(transcurridoMs / 60000);

  // Calcular próximo umbral (8h, 9h, 10h...)
  const horasSiguiente = _calcularProximoUmbral(transcurridoMin);
  if (!horasSiguiente) return;

  const minUmbral  = horasSiguiente * 60 - GUARDIA_AVISO_MIN_ANTES;
  const enVentana  = transcurridoMin >= minUmbral && transcurridoMin < minUmbral + 3;

  if (enVentana && !(_ultimoAvisoHoras === horasSiguiente && _choferDecidio)) {
    _ultimoAvisoHoras = horasSiguiente;
    _choferDecidio    = false;
    _mostrarAvisoGuardia(guardiaActiva, horasSiguiente, transcurridoMin);
  }
}

function _calcularProximoUmbral(transcurridoMin) {
  for (let h = GUARDIA_HORAS_BASE; h <= 14; h++) {
    const minUmbral = h * 60 - GUARDIA_AVISO_MIN_ANTES;
    if (transcurridoMin >= minUmbral && transcurridoMin < h * 60 + 5) {
      return h;
    }
  }
  return null;
}

// =====================================================
// MODAL DE AVISO
// =====================================================

function _mostrarAvisoGuardia(guardia, horasSiguiente, transcurridoMin) {
  if (document.getElementById("guardiaAvisoToast")) return;

  const hTrans = Math.floor(transcurridoMin / 60);
  const mTrans = transcurridoMin % 60;

  // Calcular hora exacta del umbral para el auto-cierre
  const [hI, mI] = guardia.inicio.split(":").map(Number);
  const horaCorte = `${String((hI + horasSiguiente) % 24).padStart(2, '0')}:${String(mI).padStart(2, '0')}`;

  const toast = document.createElement("div");
  toast.id = "guardiaAvisoToast";
  toast.style.cssText = `
    position:fixed;top:70px;left:50%;transform:translateX(-50%);
    width:92%;max-width:420px;
    background:#111827;border:2px solid #f59e0b;
    border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:slideDownMsg .3s ease;
  `;
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:22px;">⚠️</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#f59e0b;">AVISO DE GUARDIA</div>
        <div style="font-size:12px;color:#94a3b8;">Transcurrido: ${hTrans}h ${mTrans}min</div>
      </div>
      <button onclick="document.getElementById('guardiaAvisoToast')?.remove()" 
        style="margin-left:auto;background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div style="font-size:13px;color:#e2e8f0;margin-bottom:12px;line-height:1.6;">
      ⚠️ Faltan <b style="color:#f59e0b;">${GUARDIA_AVISO_MIN_ANTES} minutos</b> para completar
      <b style="color:#f59e0b;">${horasSiguiente} horas</b> de guardia.<br>
      <span style="color:#64748b;font-size:12px;">
        Guardia ${guardia.type} — inicio: ${guardia.inicio}<br>
        Si no respondés, la guardia se cierra a las <b style="color:#f59e0b;">${horaCorte}</b>
      </span>
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
        → Continuar 1h más
      </button>
    </div>
    <div id="guardiaCountdown" style="text-align:center;font-size:11px;color:#475569;margin-top:8px;">
      Auto-cierre en ${GUARDIA_TIMEOUT_MIN}:00
    </div>
  `;
  document.body.appendChild(toast);

  // Botón finalizar
  document.getElementById("guardiaFinalizarBtn").addEventListener("click", () => {
    _cancelarAutoClose();
    _cerrarAvisoGuardia();
    _choferDecidio = true;
    if (typeof finalizarGuardiaUI === "function") {
      finalizarGuardiaUI(guardia.createdAt);
    } else if (typeof finalizarGuardia === "function") {
      finalizarGuardia(guardia.createdAt);
      if (typeof renderListaGuardias      === "function") renderListaGuardias();
      if (typeof renderResumenDia         === "function") renderResumenDia();
      if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    }
    detenerMonitorGuardia();
  });

  // Botón continuar
  document.getElementById("guardiaContinuarBtn").addEventListener("click", () => {
    _cancelarAutoClose();
    _cerrarAvisoGuardia();
    _choferDecidio = true;
    console.log(`[GUARDIA] Chofer continúa más allá de ${horasSiguiente}h`);
  });

  // Auto-cierre con countdown
  _iniciarAutoClose(guardia, horaCorte);

  if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
}

// =====================================================
// AUTO-CIERRE CON COUNTDOWN
// =====================================================

function _iniciarAutoClose(guardia, horaCorte) {
  let segundosRestantes = GUARDIA_TIMEOUT_MIN * 60;

  const countdownInterval = setInterval(() => {
    segundosRestantes--;
    const min = Math.floor(segundosRestantes / 60);
    const seg = segundosRestantes % 60;
    const el = document.getElementById("guardiaCountdown");
    if (el) el.textContent = `Auto-cierre en ${min}:${String(seg).padStart(2, '0')}`;

    if (segundosRestantes <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);

  _autoCloseTimer = setTimeout(() => {
    clearInterval(countdownInterval);
    _cerrarAvisoGuardia();
    _choferDecidio = true;
    console.log(`[GUARDIA] Auto-cierre a las ${horaCorte}`);

    // Cerrar guardia a la hora exacta del umbral
    const order = getActiveOrder ? getActiveOrder() : null;
    if (order && order.guards) {
      const g = order.guards.find(gu => gu.id === guardia.id);
      if (g && g.status === "en_curso") {
        g.fin       = horaCorte;
        g.status    = "finalizada";
        g.cortadaAuto = true;
        // Calcular horas y km
        const [hI, mI] = guardia.inicio.split(":").map(Number);
        const [hF, mF] = horaCorte.split(":").map(Number);
        let horas = (hF + mF / 60) - (hI + mI / 60);
        if (horas < 0) horas += 24;
        g.hours     = Math.round(horas * 100) / 100;
        g.kmGuardia = Math.round(horas * (g.type === "especial" ? 40 : 30));

        const orders = getOrders ? getOrders() : [];
        if (typeof saveOrders === "function") {
          saveOrders(orders.map(o => o.orderNumber === order.orderNumber ? order : o));
        }
        if (typeof setActiveOrder   === "function") setActiveOrder(order);
        if (typeof renderListaGuardias      === "function") renderListaGuardias();
        if (typeof renderResumenDia         === "function") renderResumenDia();
        if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();

        _mostrarConfirmacionGuardia(`⏱️ Guardia cerrada automáticamente a las ${horaCorte}`);
      }
    }
    detenerMonitorGuardia();
  }, GUARDIA_TIMEOUT_MIN * 60 * 1000);
}

function _cancelarAutoClose() {
  if (_autoCloseTimer) { clearTimeout(_autoCloseTimer); _autoCloseTimer = null; }
}

function _cerrarAvisoGuardia() {
  const t = document.getElementById("guardiaAvisoToast");
  if (t) t.remove();
}

function _mostrarConfirmacionGuardia(texto) {
  const conf = document.createElement("div");
  conf.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#111827;border:2px solid #f59e0b;
    border-radius:12px;padding:20px 32px;
    z-index:9999;font-size:16px;color:#f59e0b;
    font-weight:600;text-align:center;
  `;
  conf.textContent = texto;
  document.body.appendChild(conf);
  setTimeout(() => conf.remove(), 3000);
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