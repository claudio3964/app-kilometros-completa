console.log("ui_summary cargado");

// =====================================================
// RESUMEN GENERAL
// =====================================================

function renderResumenGeneral(){

  const lista = document.getElementById("summaryGeneralLista");
  const totalesBox = document.getElementById("summaryGeneralTotales");

  if(!lista || !totalesBox) return;

  lista.innerHTML = "";

  // ================================
  // LEER FILTROS
  // ================================
  const desde = document.getElementById("filtroDesde")?.value || "";
  const hasta = document.getElementById("filtroHasta")?.value || "";
  const ordenFiltro = document.getElementById("filtroOrden")?.value.trim().toLowerCase() || "";
  const ordenarPor = document.getElementById("ordenarPor")?.value || "fecha_desc";

  // ================================
  // OBTENER ÓRDENES (SOLO CERRADAS)
  // ================================
  let orders = getOrders().filter(o => o.closed === true);

  // ================================
  // FILTRO POR FECHA
  // ================================
  if(desde){
    orders = orders.filter(o => o.date >= desde);
  }

  if(hasta){
    orders = orders.filter(o => o.date <= hasta);
  }

  // ================================
  // FILTRO POR ORDEN
  // ================================
  if(ordenFiltro){
    orders = orders.filter(o =>
      o.orderNumber &&
      o.orderNumber.toLowerCase().includes(ordenFiltro)
    );
  }

  // ================================
  // ORDENAMIENTO
  // ================================
  if(ordenarPor === "fecha_desc"){
    orders.sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  else if(ordenarPor === "fecha_asc"){
    orders.sort((a,b)=>new Date(a.date)-new Date(b.date));
  }
  else if(ordenarPor === "orden_desc"){
    orders.sort((a,b)=>b.orderNumber.localeCompare(a.orderNumber));
  }
  else if(ordenarPor === "orden_asc"){
    orders.sort((a,b)=>a.orderNumber.localeCompare(b.orderNumber));
  }

  // ================================
  // CALCULAR TOTALES ACUMULADOS
  // ================================
  let kmTotal = 0;
  let montoTotal = 0;
  let viaticosTotal = 0;

  // ================================
  // RENDER TARJETAS
  // ================================
  orders.forEach(o => {

    const t = o.totalsSnapshot;

    // Seguridad adicional
    if(!t) return;

    kmTotal += Number(t.kmTotal || 0);
    montoTotal += Number(t.monto || 0);
    viaticosTotal += Number(t.viaticos || 0);

    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "margin:10px;";

    card.innerHTML = `
      <b>Orden:</b> ${o.orderNumber}<br>
      <b>Fecha:</b> ${o.date}<br>
      <b>Base:</b> ${o.baseInicio}<br>
      <b>KM:</b> ${t.kmTotal}<br>
      <b>Viáticos:</b> ${t.viaticos}<br>
      <b>Total:</b> $ ${Math.round(t.monto)}
    `;

    lista.appendChild(card);
  });

  // ================================
  // MOSTRAR TOTALES GENERALES
  // ================================
  totalesBox.innerHTML = `
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
// =====================================================
// RESUMEN DE LA JORNADA ACTIVA (USA SOLO EL CORE)
// =====================================================

function renderResumenDia(){

  const box = document.getElementById("summaryDiaBox");

  if(!box) return;

  const order = getActiveOrder();

  if(!order){

    box.innerHTML = `
      KM totales: 0<br>
      KM tome y cese: 0<br>
      KM guardias: 0<br>
      KM acoplados: 0<br>
      Viáticos generados: 0<br>
      Total $: 0
    `;

    return;
  }

  // USAR EL CORE (FUENTE ÚNICA DE VERDAD)
  const t = calculateOrderTotals(order);

  box.innerHTML = `
    KM totales: <b>${t.kmViajes}</b><br>
    KM tome y cese: <b>${t.kmTomeCese}</b><br>
    KM guardias: <b>${t.kmGuardias}</b><br>
    KM acoplados: <b>${t.kmAcoplados}</b><br>
    Viáticos generados: <b>${t.viaticos}</b><br>
    Total $: <b>${Math.round(t.monto)}</b>
  `;
}
  //----Boton cerrar viaje---------
function renderBotonCerrarJornada(){

  const cont = document.getElementById("bloqueCerrarJornada");
  if(!cont) return;

  const order = getActiveOrder();

  // ❌ No hay jornada activa
  if(!order){
    cont.innerHTML = "";
    return;
  }

  // 🔎 Validaciones operativas
  const hayViajeEnCurso =
    order.travels?.some(t => t.status === "en_curso");

  const hayViajeProgramado =
    order.travels?.some(t => t.status === "programado");

  const hayGuardiaActiva =
    order.guards?.some(g => g.status === "activa");

  // ❌ Si hay actividad activa o pendiente, no permitir cerrar
  if(hayViajeEnCurso || hayViajeProgramado || hayGuardiaActiva){
    cont.innerHTML = "";
    return;
  }

  // ✅ Jornada limpia → permitir cerrar
  cont.innerHTML = `
    <button id="btnCerrarJornadaManual"
      class="card-btn"
      style="background:#c62828;color:white;">
      Finalizar Jornada
    </button>
  `;

  document
    .getElementById("btnCerrarJornadaManual")
    .addEventListener("click", function(){

      const confirmar = confirm(
        "¿Seguro que desea finalizar la jornada?"
      );

      if(!confirmar) return;

      const resultado = closeActiveOrder();

      if(resultado){
        alert("Jornada finalizada correctamente.");
        showScreen("mainScreen"); // 🔥 sin reload
      }

    });

}

function renderResumenGeneral(){

  const container =
    document.getElementById("resumenGeneralContainer");

  if(!container) return;

  const orders = getOrders();

  if(!orders || orders.length === 0){

    container.innerHTML = `
      <div class="card">
        No hay jornadas registradas
      </div>
    `;

    return;
  }

  container.innerHTML = "";

  const ordenadas =
    orders.sort((a,b)=> new Date(b.date)-new Date(a.date));

  ordenadas.forEach(order => {

    const totals =
      calculateOrderTotals(order);

    const card =
      document.createElement("div");

    card.className = "card";

    card.style.marginBottom = "10px";

    card.innerHTML = `
      <b>📅 ${order.date}</b><br>

      KM totales: ${totals.kmTotal.toFixed(1)} km<br>
      Viáticos: ${totals.viaticos}<br><br>

      <button onclick="
        showScreen('detalleJornadaScreen');
        renderDetalleJornadaPorNumero('${order.orderNumber}');
      ">
        Ver detalle
      </button>

      <button onclick="exportarJornadaPorNumero('${order.orderNumber}')">
        📤 Exportar
      </button>
    `;

    container.appendChild(card);

  });

}

function exportarJornadaPorNumero(orderNumber){

  const order =
    getOrders().find(o => o.orderNumber === orderNumber);

  if(!order){
    alert("Jornada no encontrada");
    return;
  }

  exportarJornada(order);

}

// EXPORTAR
window.renderResumenDia = renderResumenDia;
window.renderBotonCerrarJornada = renderBotonCerrarJornada;