console.log("ui_summary cargado");

// =====================================================
// RESUMEN GENERAL
// =====================================================

function renderResumenGeneral(){

  const lista=document.getElementById("summaryGeneralLista");
  const totalesBox=document.getElementById("summaryGeneralTotales");

  if(!lista||!totalesBox)return;

  lista.innerHTML="";

  // LEER FILTROS
  const desde=document.getElementById("filtroDesde")?.value||"";
  const hasta=document.getElementById("filtroHasta")?.value||"";
  const ordenFiltro=document.getElementById("filtroOrden")?.value.trim().toLowerCase()||"";
  const ordenarPor=document.getElementById("ordenarPor")?.value||"fecha_desc";

  // OBTENER ÓRDENES
  let orders=getOrders();

  // FILTRO POR FECHA
  if(desde){
    orders=orders.filter(o=>o.date>=desde);
  }

  if(hasta){
    orders=orders.filter(o=>o.date<=hasta);
  }

  // FILTRO POR ORDEN
  if(ordenFiltro){
    orders=orders.filter(o=>
      o.orderNumber&&
      o.orderNumber.toLowerCase().includes(ordenFiltro)
    );
  }

  // ORDENAMIENTO
  if(ordenarPor==="fecha_desc"){
    orders.sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  else if(ordenarPor==="fecha_asc"){
    orders.sort((a,b)=>new Date(a.date)-new Date(b.date));
  }
  else if(ordenarPor==="orden_desc"){
    orders.sort((a,b)=>b.orderNumber.localeCompare(a.orderNumber));
  }
  else if(ordenarPor==="orden_asc"){
    orders.sort((a,b)=>a.orderNumber.localeCompare(b.orderNumber));
  }

  // CALCULAR TOTALES
  let kmTotal=0;
  let montoTotal=0;
  let viaticosTotal=0;

  // RENDER TARJETAS
  orders.forEach(o=>{

    const t=calculateOrderTotals(o);

    kmTotal+=t.kmTotal;
    montoTotal+=t.monto;
    viaticosTotal+=t.viaticos;

    const card=document.createElement("div");

    card.className="card";
    card.style.cssText="margin:10px;";

    card.innerHTML=`
      <b>Orden:</b> ${o.orderNumber}<br>
      <b>Fecha:</b> ${o.date}<br>
      <b>Base:</b> ${o.baseInicio}<br>
      <b>KM:</b> ${t.kmTotal}<br>
      <b>Viáticos:</b> ${t.viaticos}<br>
      <b>Total:</b> $ ${Math.round(t.monto)}
    `;

    lista.appendChild(card);

  });

  // MOSTRAR TOTALES
  totalesBox.innerHTML=`
    <b>Total jornadas:</b> ${orders.length}<br>
    <b>Total km:</b> ${kmTotal}<br>
    <b>Total viáticos:</b> ${viaticosTotal}<br>
    <b>Total dinero:</b> $ ${Math.round(montoTotal)}
  `;
}

// =====================================================
// LIMPIAR FILTROS
// =====================================================

function limpiarFiltrosResumen(){

  const fOrden=document.getElementById("filtroOrden");
  const fDesde=document.getElementById("filtroDesde");
  const fHasta=document.getElementById("filtroHasta");
  const ordenar=document.getElementById("ordenarPor");

  if(fOrden)fOrden.value="";
  if(fDesde)fDesde.value="";
  if(fHasta)fHasta.value="";
  if(ordenar)ordenar.value="fecha_desc";

  renderResumenGeneral();
}
// ======================================
// MOSTRAR ORDEN ACTIVA EN UI
// ======================================

function renderOrdenActivaUI(){

  const box =
    document.getElementById("ordenActivaInfo");

  if(!box) return;

  const order = getActiveOrder();

  if(!order){

    box.innerHTML = "🔴 Sin jornada activa";
    return;
  }

  box.innerHTML = `
    🟢 Orden activa: <b>${order.orderNumber}</b><br>
    Base: ${order.baseInicio}
  `;
}

// EXPORT GLOBAL
window.renderResumenGeneral=renderResumenGeneral;
window.limpiarFiltrosResumen=limpiarFiltrosResumen;
