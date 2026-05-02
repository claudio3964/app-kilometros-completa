"use strict";

const SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";
console.log("🔥 SYNC CARGADO OK");
async function syncPendientes() {
  const orders = getOrders();
  let algoCambio = false;
  for (let order of orders) {
    if (order.syncStatus === "synced" && order.closed) continue;
    try {
      var _getDriver;
      console.log("🔄 Sync jornada:", order.orderNumber);
      const driver = ((_getDriver = getDriver) === null || _getDriver === void 0 ? void 0 : _getDriver()) || {};
      const response = await fetch("".concat(SUPABASE_URL, "/rest/v1/jornadas?on_conflict=order_number"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer ".concat(SUPABASE_KEY),
          "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          empresa_id: "cot",
          chofer_id: driver.legajo || "unknown",
          legajo: driver.legajo || "unknown",
          order_number: order.orderNumber,
          fecha: order.date,
          data: {      
            ...order,
            syncStatus: "synced"
          }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Sync error HTTP:", response.status, errorText);
        continue; // no marcar como synced, reintentar la próxima vez
      }
      order.syncStatus = "synced";
      algoCambio = true;
      console.log("✅ Sync OK:", order.orderNumber);
    } catch (e) {
      console.error("❌ Sync fallo:", e.message);
// no marcar como synced — se reintenta la próxima vez
    }
  }
  if (algoCambio) {
    saveOrders(orders);
    console.log("💾 Storage actualizado con syncStatus synced");
  }
}
async function procesarComandos(comandos) {
  for (const cmd of comandos) {
  // ── Marcar como ejecutado PRIMERO (idempotencia) ──
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/comandos_dispositivo?id=eq.${cmd.id}&ejecutado=eq.false`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ ejecutado: true, ejecutado_at: new Date().toISOString() })
    }
  );

  // Solo procesar si el PATCH actualizó algo (rowCount > 0)
  // Si otra instancia ya lo marcó, el PATCH no actualiza nada y lo ignoramos
  if (!patchRes.ok) continue;

  if (cmd.tipo === 'limpiar_jornadas') {
    const conservar = ['device_id', 'driverProfile'];
    Object.keys(localStorage).forEach(k => {
      if (!conservar.includes(k)) localStorage.removeItem(k);
    });
  }
}
}
async function checkComandosPendientes() {
  try {
    const deviceId = localStorage.getItem('device_id');
    if (!deviceId) return;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comandos_dispositivo?device_id=eq.${deviceId}&ejecutado=eq.false&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (!res.ok) return;
    const comandos = await res.json();
    if (!Array.isArray(comandos) || comandos.length === 0) return;
    await procesarComandos(comandos);
  } catch(e) {
    console.warn('checkComandosPendientes error:', e.message);
  }
}

setInterval(() => syncPendientes(), 60000);
setInterval(checkComandosPendientes, 30000);
checkComandosPendientes();

