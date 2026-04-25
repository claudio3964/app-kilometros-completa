
const SUPABASE_URL_MSG = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY_MSG = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";
 
let _mensajesVistos = new Set(JSON.parse(localStorage.getItem('mensajes_vistos') || '[]'));
let _pollerMensajes = null;
let _consultandoMensajes = false;
let _asignacionPendiente = null;
 
function _escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
 
async function consultarMensajes() {
  if (_consultandoMensajes) return;
  const driver = getDriver ? getDriver() : null;
  if (!driver || !driver.legajo) return;
  _consultandoMensajes = true;
  try {
    const res = await fetch(
      `${SUPABASE_URL_MSG}/rest/v1/mensajes?empresa_id=eq.cot&or=(para.eq.todos,para.eq.${driver.legajo})&leido=eq.false&order=creado_at.desc&limit=10`,
      { headers: { "apikey": SUPABASE_KEY_MSG, "Authorization": `Bearer ${SUPABASE_KEY_MSG}` } }
    );
    const mensajes = await res.json();
    if (!Array.isArray(mensajes) || mensajes.length === 0) return;
    const nuevos = mensajes.filter(m => !_mensajesVistos.has(m.id));
    if (nuevos.length === 0) return;
    mostrarNotificacionMensaje(nuevos[0]);
    nuevos.forEach(m => _mensajesVistos.add(m.id));
    localStorage.setItem('mensajes_vistos', JSON.stringify([..._mensajesVistos]));
    nuevos.forEach(m => { if (m.tipo !== 'asignacion') marcarLeido(m.id); });
  } catch(e) { console.warn("Error mensajes:", e.message); }
  finally { _consultandoMensajes = false; }
}
 
async function marcarLeido(id) {
  try {
    await fetch(`${SUPABASE_URL_MSG}/rest/v1/mensajes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { "apikey": SUPABASE_KEY_MSG, "Authorization": `Bearer ${SUPABASE_KEY_MSG}`, "Content-Type": "application/json" },
      body: JSON.stringify({ leido: true })
    });
  } catch(e) {}
}
 
function mostrarNotificacionMensaje(msg) {
  const anterior = document.getElementById('notifMensaje');
  if (anterior) anterior.remove();
 
  const tipoColor = msg.tipo === 'urgente' ? '#ef4444' : msg.tipo === 'asignacion' ? '#10b981' : '#3b82f6';
  const tipoIcon  = msg.tipo === 'urgente' ? '🔴' : msg.tipo === 'asignacion' ? '✅' : '💬';
  const tipoLabel = msg.tipo === 'urgente' ? 'URGENTE' : msg.tipo === 'asignacion' ? 'ASIGNACIÓN DE VIAJE' : 'MENSAJE';
 
  let viajeData = null;
  if (msg.tipo === 'asignacion' && msg.data) {
    try {
      const d = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
      viajeData = d.viaje || null;
    } catch(e) {}
  }
 
  if (msg.tipo === 'asignacion' && viajeData) {
    _asignacionPendiente = { id: msg.id, viaje: viajeData };
  }
 
  let viajeHTML = '';
  if (viajeData) {
    viajeHTML = `
      <div style="background:#1c2537;border-radius:8px;padding:10px 12px;margin:10px 0;font-size:13px;line-height:1.9;color:#94a3b8;">
        🚍 <b style="color:#e2e8f0">${_escHtml(viajeData.origen)}</b> → <b style="color:#e2e8f0">${_escHtml(viajeData.destino)}</b><br>
        🕒 Salida: <b style="color:#10b981">${_escHtml(viajeData.horaSalida) || '—'}</b>
        ${viajeData.horaLlegada ? ` &nbsp;–&nbsp; Llegada: <b style="color:#94a3b8">${_escHtml(viajeData.horaLlegada)}</b>` : ''}<br>
        🚌 Coche: <b style="color:#e2e8f0">${_escHtml(viajeData.coche) || '—'}</b>
        &nbsp;|&nbsp; 🎫 <b style="color:#e2e8f0">${_escHtml(viajeData.tipoServicio) || '—'}</b>
      </div>`;
  }
 
  let botonesHTML = '';
  if (msg.tipo === 'asignacion' && viajeData) {
    botonesHTML = `
      <div style="display:flex;gap:10px;margin-top:14px">
        <button onclick="aceptarAsignacion(${parseInt(msg.id, 10)})" style="flex:1;background:#10b981;color:white;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">✓ Aceptar</button>
        <button onclick="rechazarAsignacion(${parseInt(msg.id, 10)})" style="flex:1;background:transparent;color:#ef4444;border:2px solid #ef4444;border-radius:8px;padding:11px;font-size:14px;cursor:pointer;">✕ Rechazar</button>
      </div>`;
  } else {
    botonesHTML = `<button onclick="cerrarNotifMensaje()" style="width:100%;background:transparent;color:${tipoColor};border:1px solid ${tipoColor};border-radius:8px;padding:10px;font-size:14px;cursor:pointer;margin-top:12px;">Entendido</button>`;
  }
 
  const notif = document.createElement('div');
  notif.id = 'notifMensaje';
  notif.style.cssText = `
    position:fixed;top:70px;left:50%;transform:translateX(-50%);
    width:92%;max-width:420px;background:#111827;
    border:2px solid ${tipoColor};border-radius:14px;padding:16px 18px;
    z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.5);
    animation:slideDownMsg .3s ease;
  `;
  notif.innerHTML = `
    <style>@keyframes slideDownMsg{from{transform:translateX(-50%) translateY(-20px);opacity:0;}to{transform:translateX(-50%) translateY(0);opacity:1;}}</style>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${tipoIcon}</span>
        <span style="font-size:11px;font-weight:700;color:${tipoColor};letter-spacing:1px">${tipoLabel} — TRÁNSITO</span>
      </div>
      <button onclick="cerrarNotifMensaje()" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
    </div>
    ${msg.texto ? `<div style="font-size:14px;color:#e2e8f0;line-height:1.5;margin-bottom:4px">${_escHtml(msg.texto)}</div>` : ''}
    ${viajeHTML}
    <div style="font-size:11px;color:#475569">${msg.creado_at ? new Date(msg.creado_at).toLocaleString('es-UY') : ''}</div>
    ${botonesHTML}
  `;
  document.body.appendChild(notif);
 
  if (msg.tipo !== 'asignacion') setTimeout(() => cerrarNotifMensaje(), 15000);
}
 
function cerrarNotifMensaje() {
  const n = document.getElementById('notifMensaje');
  if (n) n.remove();
}
 
async function aceptarAsignacion(id) {
  let viajeData = null;
  if (_asignacionPendiente && _asignacionPendiente.id === id) {
    viajeData = _asignacionPendiente.viaje;
    _asignacionPendiente = null;
  }
 
  // Guardar respuesta en Supabase
  try {
    await fetch(`${SUPABASE_URL_MSG}/rest/v1/mensajes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { "apikey": SUPABASE_KEY_MSG, "Authorization": `Bearer ${SUPABASE_KEY_MSG}`, "Content-Type": "application/json" },
      body: JSON.stringify({ leido: true, data: { viaje: viajeData, respuesta: 'aceptado', respondidoAt: new Date().toISOString() } })
    });
  } catch(e) { console.warn("Error guardando respuesta:", e); }
 
  cerrarNotifMensaje();
 
  if (viajeData && typeof agregarViajeAsignado === 'function') {
 
    // ── AUTO-APERTURA DE JORNADA ──────────────────────────────────────────
    let ordenActual = getActiveOrder ? getActiveOrder() : null;
    if (!ordenActual) {
      try {
        ordenActual = createOrder();
        // Pequeña pausa visual para que el chofer note que se abrió la jornada
        _mostrarConfirmacion('📋 Jornada abierta automáticamente', '#3b82f6');
        if (typeof renderResumenDia === 'function') renderResumenDia();
        // Esperar que se vea el mensaje antes de continuar
        await new Promise(r => setTimeout(r, 1200));
      } catch(e) {
        _mostrarConfirmacion('⚠️ No se pudo abrir la jornada: ' + e.message, '#ef4444');
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────
 
    const travels = ordenActual.travels || [];
    const yaExiste = travels.some(t =>
      t.origen === viajeData.origen &&
      t.destino === viajeData.destino &&
      t.departureTime === viajeData.horaSalida &&
      t.status !== 'cancelado'
    );
    if (yaExiste) {
      _mostrarConfirmacion('⚠️ Este viaje ya está en tu jornada', '#f59e0b');
      return;
    }
 
    const ok = agregarViajeAsignado(viajeData);
    if (ok) {
      if (typeof renderResumenDia === 'function') renderResumenDia();
      if (typeof renderListaViajes === 'function') renderListaViajes();
      if (typeof mostrarViajeEnCursoUI === 'function') mostrarViajeEnCursoUI();
      if (typeof renderBotonCerrarJornada === 'function') renderBotonCerrarJornada();
      _mostrarConfirmacion('✅ Viaje cargado en tu jornada', '#10b981');
      return;
    }
  }
 
  _mostrarConfirmacion('⚠️ No se pudo agregar el viaje a la jornada', '#f59e0b');
}
 
async function rechazarAsignacion(id) {
  let viajeData = null;
  if (_asignacionPendiente && _asignacionPendiente.id === id) {
    viajeData = _asignacionPendiente.viaje;
    _asignacionPendiente = null;
  }
  try {
    await fetch(`${SUPABASE_URL_MSG}/rest/v1/mensajes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { "apikey": SUPABASE_KEY_MSG, "Authorization": `Bearer ${SUPABASE_KEY_MSG}`, "Content-Type": "application/json" },
      body: JSON.stringify({ leido: true, data: { viaje: viajeData, respuesta: 'rechazado', respondidoAt: new Date().toISOString() } })
    });
  } catch(e) {}
  cerrarNotifMensaje();
  _mostrarConfirmacion('✕ Asignación rechazada', '#ef4444');
}
 
function _mostrarConfirmacion(texto, color) {
  const conf = document.createElement('div');
  conf.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#111827;border:2px solid ${color};border-radius:12px;padding:20px 32px;z-index:9999;font-size:16px;color:${color};font-weight:600;text-align:center;`;
  conf.textContent = texto;
  document.body.appendChild(conf);
  setTimeout(() => conf.remove(), 2500);
}
 
function iniciarPollingMensajes() {
  if (_pollerMensajes) return;
  console.log("📬 Polling mensajes iniciado");
  consultarMensajes();
  _pollerMensajes = setInterval(consultarMensajes, 30000);
}
 
function detenerPollingMensajes() {
  if (_pollerMensajes) { clearInterval(_pollerMensajes); _pollerMensajes = null; }
}
 
window.iniciarPollingMensajes = iniciarPollingMensajes;
window.detenerPollingMensajes = detenerPollingMensajes;
window.cerrarNotifMensaje     = cerrarNotifMensaje;
window.aceptarAsignacion      = aceptarAsignacion;
window.rechazarAsignacion     = rechazarAsignacion;
