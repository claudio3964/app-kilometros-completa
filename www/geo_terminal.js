"use strict";

// =====================================================
// GEO TERMINAL — COT Driver
// Cierre automático de viaje al detectar llegada
// a terminal destino con GPS
// =====================================================

console.log("geo_terminal cargado");

// =====================================================
// CATÁLOGO DE TERMINALES — coordenadas fijas
// =====================================================
const TERMINALES_GPS = {
  "Montevideo":         { lat: -34.9058, lng: -56.1882, nombre: "Terminal Tres Cruces" },
  "MVDEO":              { lat: -34.9058, lng: -56.1882, nombre: "Terminal Tres Cruces" },
  "Maldonado":          { lat: -34.9024, lng: -54.9576, nombre: "Terminal Maldonado" },
  "Punta del Este":     { lat: -34.9665, lng: -54.9516, nombre: "Terminal Punta del Este" },
  "San Carlos":         { lat: -34.7977, lng: -54.9154, nombre: "Terminal San Carlos" },
  "Rocha":              { lat: -34.4833, lng: -54.3333, nombre: "Terminal Rocha" },
  "Chuy":               { lat: -33.6947, lng: -53.4617, nombre: "Terminal Chuy" },
  "La Paloma":          { lat: -34.6561, lng: -54.1697, nombre: "Terminal La Paloma" },
  "La Pedrera":         { lat: -34.5878, lng: -54.1219, nombre: "Terminal La Pedrera" },
  "Laguna Garzón":      { lat: -34.7200, lng: -54.6500, nombre: "Parada Laguna Garzón" },
  "Aguas Dulces":       { lat: -33.9667, lng: -53.5500, nombre: "Parada Aguas Dulces" },
  "Punta del Diablo":   { lat: -33.9167, lng: -53.5500, nombre: "Parada Punta del Diablo" },
};

// =====================================================
// CONFIGURACIÓN — todos los valores en un lugar
// =====================================================
const GEO_CONFIG = {
  RADIO_METROS:              50,              // radio alrededor de la terminal destino
  TIEMPO_QUIETO_MS:          5 * 60 * 1000,  // 5 min quieto dentro del radio
  MOVIMIENTO_MINIMO_M:       15,             // menos de 15m entre lecturas = "quieto"
  COUNTDOWN_SEGUNDOS:        30,             // tiempo para cancelar el cierre
  INTERVALO_GPS_MS:          30000,          // cada 30s pedir posición (ahorro batería)
  // ── Anti falso positivo ────────────────────────
  TIEMPO_MINIMO_VIAJE_MS:    90 * 60 * 1000, // REGLA 2: viaje debe llevar ≥90min en curso
  DISTANCIA_MINIMA_ORIGEN_M: 500,            // REGLA 3: debe haberse alejado ≥500m del origen
};

// =====================================================
// ESTADO INTERNO
// =====================================================
let _watchId               = null;
let _ultimaPosicion        = null;  // { lat, lng, ts }
let _tiempoQuieto          = null;  // timestamp desde cuándo está quieto en radio
let _viajeMonitoreado      = null;  // ID del viaje en curso
let _viajeInicioReal       = null;  // timestamp de cuando arrancó el viaje
let _posicionOrigen        = null;  // primera posición GPS registrada
let _maxDistanciaOrigen    = 0;     // máxima distancia alcanzada desde el origen
let _cierreEnCurso         = false;
let _countdownTimer        = null;
let _geoActivo             = false;

// =====================================================
// API PÚBLICA
// =====================================================

function iniciarGeoTerminal() {
  if (_geoActivo) return;
  if (!navigator.geolocation) {
    console.warn("[GEO] Geolocalización no disponible");
    return;
  }

  const order = getActiveOrder ? getActiveOrder() : null;
  const viajeEnCurso = order?.travels?.find(t => t.status === "en_curso");
  if (!viajeEnCurso) {
    console.log("[GEO] No hay viaje en curso, geo no iniciada");
    return;
  }

  const terminalDestino = _resolverTerminal(viajeEnCurso.destino);
  if (!terminalDestino) {
    console.warn("[GEO] Terminal destino no encontrada en catálogo:", viajeEnCurso.destino);
    return;
  }

  _viajeMonitoreado   = viajeEnCurso.id;
  _viajeInicioReal    = viajeEnCurso.inicioReal || Date.now();
  _geoActivo          = true;
  _tiempoQuieto       = null;
  _ultimaPosicion     = null;
  _posicionOrigen     = null;
  _maxDistanciaOrigen = 0;
  _cierreEnCurso      = false;

  console.log(`[GEO] Monitoreando → ${terminalDestino.nombre}`);
  console.log(`[GEO] Reglas: radio ${GEO_CONFIG.RADIO_METROS}m | quieto ${GEO_CONFIG.TIEMPO_QUIETO_MS/60000}min | viaje mín ${GEO_CONFIG.TIEMPO_MINIMO_VIAJE_MS/60000}min | alejamiento mín ${GEO_CONFIG.DISTANCIA_MINIMA_ORIGEN_M}m`);

  _watchId = navigator.geolocation.watchPosition(
    (pos) => _onPosicion(pos, terminalDestino),
    (err) => console.warn("[GEO] Error GPS:", err.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: GEO_CONFIG.INTERVALO_GPS_MS }
  );
}

function detenerGeoTerminal() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
  _geoActivo = false; _ultimaPosicion = null; _tiempoQuieto = null;
  _viajeMonitoreado = null; _viajeInicioReal = null;
  _posicionOrigen = null; _maxDistanciaOrigen = 0;
  _cierreEnCurso = false;
  _cancelarCountdown();
  console.log("[GEO] Detenida");
}

// =====================================================
// LÓGICA PRINCIPAL — las 4 reglas deben cumplirse
// =====================================================

function _onPosicion(pos, terminal) {
  const { latitude: lat, longitude: lng } = pos.coords;
  const ahora = Date.now();

  // Verificar que el viaje siga en curso
  const order = getActiveOrder ? getActiveOrder() : null;
  const viajeActual = order?.travels?.find(t => t.id === _viajeMonitoreado && t.status === "en_curso");
  if (!viajeActual) {
    console.log("[GEO] Viaje finalizado externamente — deteniendo geo");
    detenerGeoTerminal();
    return;
  }

  // Registrar posición origen (primera lectura)
  if (!_posicionOrigen) {
    _posicionOrigen = { lat, lng };
    console.log("[GEO] Origen registrado:", _posicionOrigen);
  }

  // Actualizar máxima distancia al origen
  const distanciaOrigen = _distanciaMetros(lat, lng, _posicionOrigen.lat, _posicionOrigen.lng);
  if (distanciaOrigen > _maxDistanciaOrigen) _maxDistanciaOrigen = distanciaOrigen;

  const distanciaTerminal = _distanciaMetros(lat, lng, terminal.lat, terminal.lng);
  const tiempoEnViaje = ahora - _viajeInicioReal;

  console.log(
    `[GEO] terminal:${Math.round(distanciaTerminal)}m | ` +
    `origen_max:${Math.round(_maxDistanciaOrigen)}m | ` +
    `viaje:${Math.round(tiempoEnViaje/60000)}min`
  );

  // ── REGLA 1: dentro del radio de la terminal ──────────────────────────
  if (distanciaTerminal > GEO_CONFIG.RADIO_METROS) {
    _tiempoQuieto = null;
    _ultimaPosicion = { lat, lng, ts: ahora };
    return;
  }

  // ── REGLA 2: viaje lleva al menos 90 minutos en curso ────────────────
  if (tiempoEnViaje < GEO_CONFIG.TIEMPO_MINIMO_VIAJE_MS) {
    const minFaltan = Math.ceil((GEO_CONFIG.TIEMPO_MINIMO_VIAJE_MS - tiempoEnViaje) / 60000);
    console.log(`[GEO] ✗ Regla 2: faltan ${minFaltan}min para mínimo`);
    _ultimaPosicion = { lat, lng, ts: ahora };
    return;
  }

  // ── REGLA 3: se alejó al menos 500m del origen ───────────────────────
  if (_maxDistanciaOrigen < GEO_CONFIG.DISTANCIA_MINIMA_ORIGEN_M) {
    console.log(`[GEO] ✗ Regla 3: max alejamiento ${Math.round(_maxDistanciaOrigen)}m < ${GEO_CONFIG.DISTANCIA_MINIMA_ORIGEN_M}m`);
    _ultimaPosicion = { lat, lng, ts: ahora };
    return;
  }

  // ── REGLA 4: quieto al menos 5 minutos dentro del radio ──────────────
  if (!_ultimaPosicion) {
    _ultimaPosicion = { lat, lng, ts: ahora };
    _tiempoQuieto = ahora;
    console.log("[GEO] En radio — iniciando timer quieto");
    return;
  }

  const movimiento = _distanciaMetros(lat, lng, _ultimaPosicion.lat, _ultimaPosicion.lng);
  _ultimaPosicion = { lat, lng, ts: ahora };

  if (movimiento > GEO_CONFIG.MOVIMIENTO_MINIMO_M) {
    _tiempoQuieto = ahora;
    console.log(`[GEO] Movimiento ${Math.round(movimiento)}m — timer reseteado`);
    return;
  }

  if (!_tiempoQuieto) _tiempoQuieto = ahora;
  const tiempoQuietoMs = ahora - _tiempoQuieto;
  console.log(`[GEO] Quieto: ${Math.floor(tiempoQuietoMs/60000)}min ${Math.floor((tiempoQuietoMs%60000)/1000)}s`);

  // ── LAS 4 REGLAS CUMPLIDAS → disparar ────────────────────────────────
  if (tiempoQuietoMs >= GEO_CONFIG.TIEMPO_QUIETO_MS && !_cierreEnCurso) {
    _cierreEnCurso = true;
    console.log("[GEO] ✅ 4/4 reglas cumplidas — disparando cierre");
    _mostrarToastCierre(terminal.nombre, viajeActual);
  }
}

// =====================================================
// TOAST CON COUNTDOWN
// =====================================================

function _mostrarToastCierre(nombreTerminal, viaje) {
  if (document.getElementById("geoToastCierre")) return;
  let seg = GEO_CONFIG.COUNTDOWN_SEGUNDOS;

  const toast = document.createElement("div");
  toast.id = "geoToastCierre";
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    width:92%;max-width:400px;background:#111827;
    border:2px solid #10b981;border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:slideUpGeo .3s ease;
  `;
  toast.innerHTML = `
    <style>@keyframes slideUpGeo{from{transform:translateX(-50%) translateY(20px);opacity:0;}to{transform:translateX(-50%) translateY(0);opacity:1;}}</style>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:22px;">📍</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#10b981;">LLEGADA DETECTADA</div>
        <div style="font-size:12px;color:#94a3b8;">${nombreTerminal}</div>
      </div>
    </div>
    <div style="font-size:13px;color:#e2e8f0;margin-bottom:10px;line-height:1.6;">
      ${viaje.origen} → ${viaje.destino}<br>
      <span style="color:#475569;font-size:11px;">
        ✓ Radio ${GEO_CONFIG.RADIO_METROS}m &nbsp;·&nbsp;
        ✓ Quieto 5min &nbsp;·&nbsp;
        ✓ Viaje ≥90min &nbsp;·&nbsp;
        ✓ Salió del origen
      </span>
    </div>
    <div id="geoCountdownBar" style="height:4px;background:#10b981;border-radius:2px;width:100%;margin-bottom:10px;transition:width 1s linear;"></div>
    <div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:12px;">
      Cerrando en <span id="geoCountdownNum" style="color:#10b981;font-weight:700;">${seg}s</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button id="geoBtnCerrar" style="flex:1;background:#10b981;color:white;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">✓ Cerrar ahora</button>
      <button id="geoBtnCancelar" style="flex:1;background:transparent;color:#ef4444;border:2px solid #ef4444;border-radius:8px;padding:11px;font-size:14px;cursor:pointer;">✕ Cancelar</button>
    </div>
  `;
  document.body.appendChild(toast);

  document.getElementById("geoBtnCerrar").addEventListener("click", () => {
    _cancelarCountdown(); _ejecutarCierreViaje();
  });
  document.getElementById("geoBtnCancelar").addEventListener("click", () => {
    _cancelarCountdown();
    _cierreEnCurso = false;
    _tiempoQuieto = null;
    console.log("[GEO] Cancelado por el chofer");
  });

  const barEl = document.getElementById("geoCountdownBar");
  const numEl = document.getElementById("geoCountdownNum");
  _countdownTimer = setInterval(() => {
    seg--;
    if (numEl) numEl.textContent = seg + "s";
    if (barEl) barEl.style.width = ((seg / GEO_CONFIG.COUNTDOWN_SEGUNDOS) * 100) + "%";
    if (seg <= 0) { _cancelarCountdown(); _ejecutarCierreViaje(); }
  }, 1000);
}

function _cancelarCountdown() {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
  const t = document.getElementById("geoToastCierre");
  if (t) t.remove();
}

// =====================================================
// EJECUTAR CIERRE
// =====================================================

function _ejecutarCierreViaje() {
  console.log("[GEO] Ejecutando cierre automático");
  detenerGeoTerminal();

  const resultado = typeof finalizarViajeActual === "function" ? finalizarViajeActual() : null;

  if (resultado) {
    if (typeof renderListaViajes === "function") renderListaViajes();
    if (typeof renderResumenDia === "function") renderResumenDia();
    if (typeof mostrarViajeEnCursoUI === "function") mostrarViajeEnCursoUI();
    if (typeof renderBotonCerrarJornada === "function") renderBotonCerrarJornada();
    if (typeof syncEstadoAlSW === "function") syncEstadoAlSW();
    _mostrarConfirmacionGeo("✅ Viaje cerrado automáticamente al llegar a terminal");
  } else {
    _mostrarConfirmacionGeo("⚠️ No se pudo cerrar el viaje", "#f59e0b");
    _cierreEnCurso = false;
  }
}

// =====================================================
// HELPERS
// =====================================================

function _distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = _toRad(lat2 - lat1);
  const dLng = _toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function _toRad(deg) { return deg * Math.PI / 180; }

function _resolverTerminal(destino) {
  if (!destino) return null;
  const d = destino.toLowerCase();
  const key = Object.keys(TERMINALES_GPS).find(k =>
    d.includes(k.toLowerCase()) || k.toLowerCase().includes(d)
  );
  return key ? TERMINALES_GPS[key] : null;
}

function _mostrarConfirmacionGeo(texto, color = "#10b981") {
  const conf = document.createElement("div");
  conf.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#111827;border:2px solid ${color};border-radius:12px;padding:20px 32px;z-index:9999;font-size:15px;color:${color};font-weight:600;text-align:center;`;
  conf.textContent = texto;
  document.body.appendChild(conf);
  setTimeout(() => conf.remove(), 3000);
}

// =====================================================
// INTEGRACIÓN — llamar desde ui_travels.js
// =====================================================

function onViajeIniciado() {
  detenerGeoTerminal();
  setTimeout(() => iniciarGeoTerminal(), 2000);
}

function onViajeFinalizado() {
  detenerGeoTerminal();
}

// =====================================================
// EXPORTS
// =====================================================
window.iniciarGeoTerminal  = iniciarGeoTerminal;
window.detenerGeoTerminal  = detenerGeoTerminal;
window.onViajeIniciado     = onViajeIniciado;
window.onViajeFinalizado   = onViajeFinalizado;
window.TERMINALES_GPS      = TERMINALES_GPS;
window.GEO_CONFIG          = GEO_CONFIG;