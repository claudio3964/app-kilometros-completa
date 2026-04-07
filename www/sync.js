
const SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

console.log("🔥 SYNC CARGADO OK");

async function syncPendientes(){
alert("SYNC EJECUTANDO");
  const orders = getOrders();

  for (let order of orders){

    if(order.syncStatus !== "pending") continue;

    try{
alert("ENVIANDO A SUPABASE");
      console.log("🔄 Sync jornada:", order.orderNumber);

   const response = await fetch(`${SUPABASE_URL}/rest/v1/jornadas`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer": "return-minimal"
  },
  body: JSON.stringify({
    empresa_id: "cot",
    chofer_id: "driver1",
    order_number: order.orderNumber,
    data: order
  })
});

       if (!response.ok) {
    const errorText = await response.text();
    alert("ERROR SUPABASE: " + errorText);
  } else {
    alert("SYNC OK SUPABASE");
  }

      order.syncStatus = "synced";

      console.log("✅ Sync OK:", order.orderNumber);

    }catch(e){

      console.log("❌ Sync fallo:", e.message);
alert("ERROR GENERAL: " + e.message);
    }

  }

  saveOrders(orders);
}