const SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

console.log("🔥 SYNC CARGADO OK");

async function syncPendientes(){

  const orders = getOrders();
  let algoCambio = false;

  for (let order of orders){

    if(order.syncStatus !== "pending") continue;

    try{

      console.log("🔄 Sync jornada:", order.orderNumber);

      const driver = getDriver?.() || {};

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/jornadas?on_conflict=order_number`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "apikey":        SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Prefer":        "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            empresa_id:   "cot",
            chofer_id:    driver.legajo || "unknown",
            legajo:       driver.legajo || "unknown",
            order_number: order.orderNumber,
            fecha:        order.date,
            data: { ...order, syncStatus: "synced" }
          })
        }
      );

      if(!response.ok){
        const errorText = await response.text();
        console.error("❌ Sync error HTTP:", response.status, errorText);
        continue; // no marcar como synced, reintentar la próxima vez
      }

      order.syncStatus = "synced";
      algoCambio = true;

      console.log("✅ Sync OK:", order.orderNumber);

    }catch(e){

      console.error("❌ Sync fallo:", e.message);
      // no marcar como synced — se reintenta la próxima vez

    }

  }

  if(algoCambio){
    saveOrders(orders);
    console.log("💾 Storage actualizado con syncStatus synced");
  }

}