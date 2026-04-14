"use strict";

// =====================================================
// UI MENSAJES — COT Driver App
// Polling cada 30s para mensajes del admin
// =====================================================

console.log("ui_mensajes cargado");

const SUPABASE_URL_MSG = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY_MSG = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

let _mensajesVistos = new Set(JSON.parse(localStorage.getItem('mensajes_vistos') || '[]'));
let _pollerMensajes = null;

// =====================================================
// CONSULTAR MENSAJES PARA ESTE CHOFER
// =====================================================
async function consultarMensajes() {
  const driver = getDriver ? getDriver() : null;
  if (!driver || !driver.legajo) return;

  try {
    const res = await fetch(
      `${SUPABASE_URL_MSG}/rest/v1/mensajes?empresa_id=eq.cot&or=(para.eq.todos,para.eq.${driver.legajo})&leido=eq.false&order=creado_at.desc&limit=10`,
      { headers: { "apikey": SUPABASE_KEY_MSG, "Authorization": `Bearer ${SUPABASE_KEY_MSG}` } }
    );
    const mensajes = await res.json();
    if (!Array.isArray(mensajes) || mensajes.length === 0) return;

    // Filtrar los que ya vimos en esta sesión
    const nuevos = mensajes.filter(m => !_mensajesVistos.has(m.id));
    if (nuevos.length === 0) return;

    // Mostrar el más reciente
    mostrarNotificacionMensaje(nuevos[0]);

    // Marcar todos los nuevos como vistos localmente
    nuevos.forEach(m => _mensajesVistos.add(m.id));
    localStorage.setItem('mensajes_vistos', JSON.stringify([..._mensajesVistos]));

    // Marcar como leído en Supabase
    nuevos.forEach(m => marcarLeido(m.id));

  } catch(e) {
    console.warn("Error consultando mensajes:", e.message);
  }
}

// =====================================================
// MARCAR MENSAJE COMO LEÍDO EN SUPABASE
// =====================================================
async function marcarLeido(id) {
  try {
    await fetch(`${SUPABASE_URL_MSG}/rest/v1/mensajes?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        "apikey": SUPABASE_KEY_MSG,
        "Authorization": `Bearer ${SUPABASE_KEY_MSG}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ leido: true })
    });
  } catch(e) { console.warn("Error marcando leído:", e.message); }
}

// =====================================================
// MOSTRAR NOTIFICACIÓN EN LA APP
// =====================================================
function mostrarNotificacionMensaje(msg) {
  // Quitar notificación anterior si existe
  const anterior = document.getElementById('notifMensaje');
  if (anterior) anterior.remove();

  const tipoColor = msg.tipo === 'urgente' ? '#ef4444' : msg.tipo === 'asignacion' ? '#10b981' : '#3b82f6';
  const tipoIcon  = msg.tipo === 'urgente' ? '🔴' : msg.tipo === 'asignacion' ? '✅' : '💬';
  const tipoLabel = msg.tipo === 'urgente' ? 'URGENTE' : msg.tipo === 'asignacion' ? 'ASIGNACIÓN' : 'MENSAJE';

  const notif = document.createElement('div');
  notif.id = 'notifMensaje';
  notif.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 92%;
    max-width: 420px;
    background: #111827;
    border: 2px solid ${tipoColor};
    border-radius: 14px;
    padding: 16px 18px;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: slideDownMsg 0.3s ease;
  `;

  notif.innerHTML = `
    <style>
      @keyframes slideDownMsg {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
      }
    </style>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${tipoIcon}</span>
        <span style="font-size:11px;font-weight:700;color:${tipoColor};letter-spacing:1px">${tipoLabel} — TRÁNSITO</span>
      </div>
      <button onclick="cerrarNotifMensaje()" style="
        background:transparent;border:none;color:#94a3b8;
        font-size:18px;cursor:pointer;padding:0 4px;line-height:1;
      ">✕</button>
    </div>
    <div style="font-size:15px;color:#e2e8f0;line-height:1.5;margin-bottom:12px">${msg.texto || '—'}</div>
    <div style="font-size:11px;color:#475569">${msg.creado_at ? new Date(msg.creado_at).toLocaleString('es-UY') : ''}</div>
    ${msg.tipo === 'asignacion' ? `
    <div style="display:flex;gap:10px;margin-top:14px">
      <button onclick="responderMensaje(${msg.id},'aceptado')" style="
        flex:1;background:#10b981;color:white;border:none;border-radius:8px;
        padding:10px;font-size:14px;font-weight:600;cursor:pointer;">
        ✓ Aceptar
      </button>
      <button onclick="responderMensaje(${msg.id},'rechazado')" style="
        flex:1;background:transparent;color:#ef4444;border:2px solid #ef4444;
        border-radius:8px;padding:10px;font-size:14px;cursor:pointer;">
        ✕ Rechazar
      </button>
    </div>` : `
    <button onclick="cerrarNotifMensaje()" style="
      width:100%;background:transparent;color:#3b82f6;border:1px solid #3b82f6;
      border-radius:8px;padding:10px;font-size:14px;cursor:pointer;margin-top:12px;">
      Entendido
    </button>`}
  `;

  document.body.appendChild(notif);

  // Auto-cerrar mensajes normales después de 15s
  if (msg.tipo === 'mensaje') {
    setTimeout(() => cerrarNotifMensaje(), 15000);
  }
}

function cerrarNotifMensaje() {
  const n = document.getElementById('notifMensaje');
  if (n) n.remove();
}

// =====================================================
// RESPONDER ASIGNACIÓN
// =====================================================
async function responderMensaje(id, respuesta) {
  try {
    await fetch(`${SUPABASE_URL_MSG}/rest/v1/mensajes?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        "apikey": SUPABASE_KEY_MSG,
        "Authorization": `Bearer ${SUPABASE_KEY_MSG}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ leido: true, data: { respuesta, respondidoAt: new Date().toISOString() } })
    });
    cerrarNotifMensaje();
    // Mostrar confirmación breve
    const conf = document.createElement('div');
    conf.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#111827;border:1px solid #10b981;border-radius:12px;padding:20px 32px;z-index:9999;font-size:16px;color:#10b981;font-weight:600;';
    conf.textContent = respuesta === 'aceptado' ? '✅ Asignación aceptada' : '✕ Asignación rechazada';
    document.body.appendChild(conf);
    setTimeout(() => conf.remove(), 2500);
  } catch(e) { console.warn("Error respondiendo:", e.message); }
}

// =====================================================
// INICIAR POLLING
// =====================================================
function iniciarPollingMensajes() {
  if (_pollerMensajes) return; // ya está corriendo
  console.log("📬 Polling mensajes iniciado");
  consultarMensajes(); // primera consulta inmediata
  _pollerMensajes = setInterval(consultarMensajes, 30000);
}

function detenerPollingMensajes() {
  if (_pollerMensajes) { clearInterval(_pollerMensajes); _pollerMensajes = null; }
}

// Exportar
window.iniciarPollingMensajes  = iniciarPollingMensajes;
window.detenerPollingMensajes  = detenerPollingMensajes;
window.cerrarNotifMensaje      = cerrarNotifMensaje;
window.responderMensaje        = responderMensaje;