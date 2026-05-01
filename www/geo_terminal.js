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
  "Montevideo":     { lat: -34.894149,  lng: -56.167112,  nombre: "Terminal Tres Cruces" },
  "MVDEO":          { lat: -34.894149,  lng: -56.167112,  nombre: "Terminal Tres Cruces" },
  "Punta del Este": { lat: -34.95738,   lng: -54.938867,  nombre: "Terminal Punta del Este" },
  "Colonia":        { lat: -34.4726414, lng: -57.8425142, nombre: "Terminal Colonia" },
  "Piriápolis":     { lat: -34.8613073, lng: -55.2746958, nombre: "Terminal Piriápolis" },
  "La Paloma":      { lat: -34.6565574, lng: -54.159223,  nombre: "Terminal La Paloma" },
  "La Pedrera":     { lat: -34.5920808, lng: -54.1326961, nombre: "Terminal La Pedrera" },
  "Chuy":           { lat: -33.7012,    lng: -53.453986,  nombre: "Terminal Chuy" },
  "Rocha":          { lat: -34.4833,    lng: -54.3333,    nombre: "Terminal Rocha" },
  "Maldonado":      { lat: -34.9024,    lng: -54.9576,    nombre: "Terminal Maldonado" },
  "San Carlos":     { lat: -34.7977,    lng: -54.9154,    nombre: "Terminal San Carlos" },
  "Laguna Garzón":  { lat: -34.7200,    lng: -54.6500,    nombre: "Parada Laguna Garzón" },
  "Aguas Dulces":   { lat: -33.9667,    lng: -53.5500,    nombre: "Parada Aguas Dulces" },
  "Punta del Diablo": { lat: -33.9167,  lng: -53.5500,    nombre: "Parada Punta del Diablo" },
};

// =====================================================
// CONFIGURACIÓN — todos los valores en un lugar
// =====================================================
const GEO_CONFIG = {
  RADIO_METROS:              150,             // radio alrededor de la terminal destino
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
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
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
// AUTO-INICIO DE VIAJE — detección en terminal origen
// =====================================================

let _watchIdOrigen   = null;
let _monitoreoOrigen = false;

function iniciarMonitoreoOrigen() {
  if (_monitoreoOrigen) return;
  if (!navigator.geolocation) return;

  const order = getActiveOrder ? getActiveOrder() : null;
  const viajeProgramado = order?.travels?.find(t => t.status === "programado");
  if (!viajeProgramado) return;

  const terminalOrigen = _resolverTerminal(viajeProgramado.origen);
  if (!terminalOrigen) {
    console.warn("[GEO] Terminal origen sin coordenadas:", viajeProgramado.origen);
    _mostrarBotonesManuales(viajeProgramado);
    return;
  }

  _monitoreoOrigen = true;
  console.log(`[GEO] Monitoreando origen → ${terminalOrigen.nombre}`);

  _watchIdOrigen = navigator.geolocation.watchPosition(
    (pos) => _onPosicionOrigen(pos, terminalOrigen, viajeProgramado),
    (err) => console.warn("[GEO] Error GPS origen:", err.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}

function detenerMonitoreoOrigen() {
  if (_watchIdOrigen !== null) {
    navigator.geolocation.clearWatch(_watchIdOrigen);
    _watchIdOrigen = null;
  }
  _monitoreoOrigen = false;
}

function _onPosicionOrigen(pos, terminal, viaje) {
  const { latitude: lat, longitude: lng } = pos.coords;
  const ahora = Date.now();

  // Verificar que el viaje siga programado
  const order = getActiveOrder ? getActiveOrder() : null;
  const viajeActual = order?.travels?.find(t => t.id === viaje.id && t.status === "programado");
  if (!viajeActual) {
    detenerMonitoreoOrigen();
    return;
  }

  // Verificar hora — debe ser >= hora de salida programada
  const horaSalida = viaje.departureTime; // "18:39"
  if (horaSalida) {
    const [h, m]     = horaSalida.split(":").map(Number);
    const ahora_d    = new Date();
    const salidaMs   = new Date(ahora_d.getFullYear(), ahora_d.getMonth(), ahora_d.getDate(), h, m, 0).getTime();
    if (ahora < salidaMs) {
      const minFaltan = Math.ceil((salidaMs - ahora) / 60000);
      console.log(`[GEO] Faltan ${minFaltan}min para hora de salida`);
      return;
    }
  }

  const distancia = _distanciaMetros(lat, lng, terminal.lat, terminal.lng);
  console.log(`[GEO] Origen: ${Math.round(distancia)}m de ${terminal.nombre}`);

  if (distancia <= GEO_CONFIG.RADIO_METROS) {
    detenerMonitoreoOrigen();
    _mostrarToastInicio(terminal.nombre, viajeActual);
  }
}

function _mostrarToastInicio(nombreTerminal, viaje) {
  if (document.getElementById("geoToastInicio")) return;
  let seg = GEO_CONFIG.COUNTDOWN_SEGUNDOS;

  const toast = document.createElement("div");
  toast.id = "geoToastInicio";
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    width:92%;max-width:400px;background:#111827;
    border:2px solid #f59e0b;border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:slideUpGeo .3s ease;
  `;
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:22px;">🚌</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#f59e0b;">SALIDA DETECTADA</div>
        <div style="font-size:12px;color:#94a3b8;">${nombreTerminal}</div>
      </div>
    </div>
    <div style="font-size:13px;color:#e2e8f0;margin-bottom:10px;">
      ${viaje.origen} → ${viaje.destino}<br>
      <span style="color:#475569;font-size:11px;">Hora programada: ${viaje.departureTime || "—"}</span>
    </div>
    <div id="geoCountdownBarInicio" style="height:4px;background:#f59e0b;border-radius:2px;width:100%;margin-bottom:10px;transition:width 1s linear;"></div>
    <div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:12px;">
      Iniciando en <span id="geoCountdownNumInicio" style="color:#f59e0b;font-weight:700;">${seg}s</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button id="geoBtnIniciar" style="flex:1;background:#f59e0b;color:#111;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">▶ Iniciar ahora</button>
      <button id="geoBtnCancelarInicio" style="flex:1;background:transparent;color:#ef4444;border:2px solid #ef4444;border-radius:8px;padding:11px;font-size:14px;cursor:pointer;">✕ Cancelar</button>
    </div>
  `;
  document.body.appendChild(toast);

  let timer = null;

  document.getElementById("geoBtnIniciar").addEventListener("click", () => {
    clearInterval(timer);
    toast.remove();
    _ejecutarInicioViaje(viaje);
  });

  document.getElementById("geoBtnCancelarInicio").addEventListener("click", () => {
    clearInterval(timer);
    toast.remove();
    _mostrarBotonesManuales(viaje);
  });

  const barEl = document.getElementById("geoCountdownBarInicio");
  const numEl = document.getElementById("geoCountdownNumInicio");
  timer = setInterval(() => {
    seg--;
    if (numEl) numEl.textContent = seg + "s";
    if (barEl) barEl.style.width = ((seg / GEO_CONFIG.COUNTDOWN_SEGUNDOS) * 100) + "%";
    if (seg <= 0) { clearInterval(timer); toast.remove(); _ejecutarInicioViaje(viaje); }
  }, 1000);
}

function _ejecutarInicioViaje(viaje) {
  console.log("[GEO] Iniciando viaje automáticamente:", viaje.id);
  if (typeof iniciarViajeDesdeGeo === "function") {
    iniciarViajeDesdeGeo(viaje.id);
  } else if (typeof iniciarViaje === "function") {
    iniciarViaje(viaje.id);
  }
}

function _mostrarBotonesManuales(viaje) {
  console.log("[GEO] Sin coordenadas origen — mostrando botón manual");
  // El botón manual ya existe en la UI del viaje programado
  // Esta función es placeholder para futura lógica
}

// Llamar cuando se agrega un viaje programado
function onViajeProgramadoAgregado() {
  detenerMonitoreoOrigen();
  setTimeout(() => iniciarMonitoreoOrigen(), 1000);
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
// MODO PRUEBA — coordenadas GPS actuales como terminal
// =====================================================

let _modoPrueba = false;
let _coordsOriginales = null;

function activarModoPrueba() {
  if (!navigator.geolocation) {
    alert("GPS no disponible");
    return;
  }

  const btn = document.getElementById("geoPruebaBtn");
  if (btn) { btn.textContent = "📡 Obteniendo GPS..."; btn.disabled = true; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      // Guardar coords originales si es la primera vez
      if (!_coordsOriginales) {
        _coordsOriginales = {};
        for (const k of Object.keys(TERMINALES_GPS)) {
          _coordsOriginales[k] = { ...TERMINALES_GPS[k] };
        }
      }

      // Pisar TODAS las terminales con la posición actual
      for (const k of Object.keys(TERMINALES_GPS)) {
        TERMINALES_GPS[k].lat = lat;
        TERMINALES_GPS[k].lng = lng;
      }

      // Configuración relajada para pruebas
      GEO_CONFIG.RADIO_METROS              = 50;
      GEO_CONFIG.TIEMPO_QUIETO_MS          = 15 * 1000;   // 15 segundos
      GEO_CONFIG.TIEMPO_MINIMO_VIAJE_MS    = 0;            // sin mínimo
      GEO_CONFIG.DISTANCIA_MINIMA_ORIGEN_M = 0;            // sin alejamiento mínimo
      GEO_CONFIG.MOVIMIENTO_MINIMO_M       = 2;
      GEO_CONFIG.INTERVALO_GPS_MS          = 5000;

      _modoPrueba = true;

      console.log(`[GEO TEST] ✅ Modo prueba activo — todas las terminales → (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
      console.log(`[GEO TEST] Radio: ${GEO_CONFIG.RADIO_METROS}m | Quieto: ${GEO_CONFIG.TIEMPO_QUIETO_MS/1000}s`);

      _actualizarPanelPrueba(lat, lng);

      if (btn) { btn.textContent = "✅ Prueba activa"; btn.disabled = false; }
    },
    (err) => {
      console.warn("[GEO TEST] Error GPS:", err.message);
      if (btn) { btn.textContent = "⚠️ Error GPS — reintentar"; btn.disabled = false; }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function desactivarModoPrueba() {
  if (_coordsOriginales) {
    for (const k of Object.keys(TERMINALES_GPS)) {
      if (_coordsOriginales[k]) {
        TERMINALES_GPS[k].lat = _coordsOriginales[k].lat;
        TERMINALES_GPS[k].lng = _coordsOriginales[k].lng;
      }
    }
  }

  // Restaurar config original
  GEO_CONFIG.RADIO_METROS              = 150;
  GEO_CONFIG.TIEMPO_QUIETO_MS          = 5 * 60 * 1000;
  GEO_CONFIG.TIEMPO_MINIMO_VIAJE_MS    = 90 * 60 * 1000;
  GEO_CONFIG.DISTANCIA_MINIMA_ORIGEN_M = 500;
  GEO_CONFIG.MOVIMIENTO_MINIMO_M       = 15;
  GEO_CONFIG.INTERVALO_GPS_MS          = 30000;

  _modoPrueba = false;
  _coordsOriginales = null;

  console.log("[GEO TEST] 🔴 Modo prueba desactivado — coords reales restauradas");

  const panel = document.getElementById("geoPruebaPanel");
  if (panel) panel.remove();
}

function _actualizarPanelPrueba(lat, lng) {
  let panel = document.getElementById("geoPruebaPanel");
  if (!panel) return;

  const coordEl = document.getElementById("geoPruebaCoordsActivas");
  if (coordEl) coordEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function mostrarPanelPrueba() {
  if (document.getElementById("geoPruebaPanel")) return;

  const panel = document.createElement("div");
  panel.id = "geoPruebaPanel";
  panel.style.cssText = `
    position:fixed;bottom:80px;right:12px;
    width:220px;background:#0f172a;
    border:2px solid #f59e0b;border-radius:12px;
    padding:12px;z-index:9998;
    box-shadow:0 4px 20px rgba(0,0,0,.7);
    font-family:monospace;
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:11px;font-weight:700;color:#f59e0b;">🧪 MODO PRUEBA GEO</span>
      <button onclick="document.getElementById('geoPruebaPanel').remove()" 
              style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;line-height:1;">✕</button>
    </div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">Coords activas:</div>
    <div id="geoPruebaCoordsActivas" style="font-size:10px;color:#94a3b8;margin-bottom:10px;word-break:break-all;">
      ${_modoPrueba ? `${TERMINALES_GPS["Montevideo"].lat.toFixed(5)}, ${TERMINALES_GPS["Montevideo"].lng.toFixed(5)}` : "—"}
    </div>
    <div style="font-size:10px;color:#64748b;margin-bottom:8px;">
      Radio: <span style="color:#f59e0b;">50m</span> &nbsp;·&nbsp;
      Quieto: <span style="color:#f59e0b;">15s</span><br>
      Sin mín. tiempo ni alejamiento
    </div>
    <button id="geoPruebaBtn"
      onclick="activarModoPrueba()"
      style="width:100%;padding:8px;background:#f59e0b;color:#111;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px;">
      📍 Usar mi posición como terminal
    </button>
    <button onclick="desactivarModoPrueba()"
      style="width:100%;padding:7px;background:transparent;color:#ef4444;border:1.5px solid #ef4444;border-radius:7px;font-size:11px;cursor:pointer;">
      🔴 Desactivar modo prueba
    </button>
  `;
  document.body.appendChild(panel);
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
window.iniciarMonitoreoOrigen      = iniciarMonitoreoOrigen;
window.detenerMonitoreoOrigen      = detenerMonitoreoOrigen;
window.onViajeProgramadoAgregado   = onViajeProgramadoAgregado;
window.mostrarPanelPrueba          = mostrarPanelPrueba;
window.activarModoPrueba           = activarModoPrueba;
window.desactivarModoPrueba        = desactivarModoPrueba;