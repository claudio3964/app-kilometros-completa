"use strict";

const SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";
console.log("🔥 SYNC CARGADO OK");
async function syncPendientes() {
  const orders = getOrders();
  let algoCambio = false;
  for (let order of orders) {
    if (order.syncStatus !== "pending") continue;
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
async function checkComandosPendientes() {
  console.log('checkComandos ejecutando... deviceId:', localStorage.getItem('device_id'));
  try {
    const deviceId = localStorage.getItem('device_id');
    if (!deviceId) return;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comandos_dispositivo?device_id=eq.${deviceId}&ejecutado=eq.false&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const comandos = await res.json();
    if (!Array.isArray(comandos) || !comandos.length) return;

    for (const cmd of comandos) {
      if (cmd.tipo === 'limpiar_jornadas') {
        const conservar = ['device_id', 'driverProfile'];
        Object.keys(localStorage).forEach(k => {
          if (!conservar.includes(k)) localStorage.removeItem(k);
        });
        console.log('DESPUES de limpiar:', Object.keys(localStorage));
  console.log('Jornadas locales limpiadas por comando admin');
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/comandos_dispositivo?id=eq.${cmd.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ejecutado: true, ejecutado_at: new Date().toISOString() })
        }
      );
    }
  } catch(e) {
    console.warn('checkComandos error:', e);
  }
}
setInterval(checkComandosPendientes, 30000);
checkComandosPendientes();
