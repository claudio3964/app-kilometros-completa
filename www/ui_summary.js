console.log("ui_summary cargado");


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
    KM totales: <b>${t.kmTotal || 0}</b><br> <!-- 🔧 CAMBIO -->
    KM tome y cese: <b>${t.kmTomeCese || 0}</b><br>
    KM guardias: <b>${t.kmGuardias || 0}</b><br>
    KM acoplados: <b>${t.kmAcoplados || 0}</b><br>
    Viáticos generados: <b>${t.viaticos || 0}</b><br>
    Total $: <b>${Math.round(t.monto || 0)}</b>
  `;
}
function renderBotonCerrarJornada(){

  const cont = document.getElementById("bloqueCerrarJornada");
  if(!cont) return;

  const order = getActiveOrder();

  if(!order){
    cont.innerHTML = "";
    return;
  }

  const hayViajeEnCurso =
    order.travels?.some(t => t.status === "en_curso");

  const hayViajeProgramado =
    order.travels?.some(t => t.status === "programado");

  const hayGuardiaActiva =
    order.guards?.some(g => g.status === "activa");

  if(hayViajeEnCurso || hayViajeProgramado || hayGuardiaActiva){
    cont.innerHTML = "";
    return;
  }

  const tieneActividad =
    (order.travels?.length > 0) ||
    (order.guards?.length > 0);

  if(!tieneActividad){
    cont.innerHTML = "";
    return;
  }

 

  cont.innerHTML = `
    <button id="btnCerrarJornadaManual"
      style="
        background:#c62828;
        color:white;
        border:none;
        border-radius:8px;
        padding:6px 12px;
        font-size:13px;
        font-weight:bold;
        cursor:pointer;
      ">
      Finalizar Jornada
    </button>
  `;

  document
  .getElementById("btnCerrarJornadaManual")
  .addEventListener("click", async function(){

    const confirmar = confirm(
      "¿Confirma que desea finalizar la jornada?"
    );

    if(!confirmar) return;

    const resultado = closeActiveOrder();

    if(resultado){
      try {
        await exportarJornada(resultado);
      } catch(e) {
        console.warn("Error exportando jornada", e);
      }
 alert("✅ Jornada finalizada y enviada correctamente");
      renderBotonCerrarJornada();
      renderOrdenActivaUI?.();
      showScreen("mainScreen");
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

  // ================================
// ORDENAR + LIMPIAR DUPLICADOS POR DÍA
// ================================

// ordenar primero
const ordenadas = [...orders].sort(
  (a,b)=> new Date(b.date)-new Date(a.date)
);

// eliminar duplicados por fecha
const unicosPorDia = [];
const fechasVistas = new Set();

ordenadas.forEach(o => {
  if(!fechasVistas.has(o.date)){
    unicosPorDia.push(o);
    fechasVistas.add(o.date);
  }
});

// tomar solo últimos 5 días
const ultimos5 = unicosPorDia.slice(0,5);

  ultimos5.forEach(order => {

    const totals =
      calculateOrderTotals(order);

    const card =
      document.createElement("div");

    card.className = "card";

    card.style.marginBottom = "10px";

    card.innerHTML = `
      <b>📅 ${order.date}</b><br>

      KM totales: ${(totals.kmTotal || 0).toFixed(1)} km<br>
      KM tome y cese: ${(totals.kmTomeCese || 0).toFixed(1)} km<br>
      Viáticos: ${totals.viaticos || 0}<br><br>

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

  // Boton limpiar storage (solo desarrollo)
  const btnLimpiar = document.createElement("div");
  btnLimpiar.style.cssText = "margin-top:30px; text-align:center;";
  btnLimpiar.innerHTML = `
    <button id="btnLimpiarStorage" style="
      background:none;
      border:1px solid #ccc;
      border-radius:8px;
      padding:8px 16px;
      font-size:12px;
      color:#999;
      cursor:pointer;
    ">
      🗑 Limpiar datos de prueba
    </button>
  `;
  container.appendChild(btnLimpiar);

  document.getElementById("btnLimpiarStorage")
    .addEventListener("click", function(){
      const c1 = confirm("¿Borrar todos los datos?");
      if(!c1) return;
      const c2 = confirm("Esta acción no se puede deshacer. ¿Confirmar?");
      if(!c2) return;
      localStorage.clear();
      location.reload();
    });

}
async function generarPDFJornada(order){

  // 🔴 BLOQUE NUEVO (va arriba de todo)
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn("jsPDF no cargado, se omite PDF");
    return;
  }

  console.log("GENERANDO PDF DE JORNADA", order);

  // 👇 esto queda igual
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const totals = calculateOrderTotals(order);

  let y = 20;

  doc.setFontSize(16);
  doc.text("COT Driver - Resumen de Jornada", 20, y);

  y += 12;

  doc.setFontSize(12);

  doc.text(`Fecha: ${order.date}`, 20, y);
  y += 8;

  doc.text(`Orden: ${order.orderNumber}`, 20, y);
  y += 8;

  doc.text(`Base: ${order.baseInicio || "Montevideo"}`, 20, y);

  y += 10;

  doc.text(`KM totales: ${totals.kmTotal}`, 20, y);
  y += 8;

  doc.text(`KM guardias: ${totals.kmGuardias}`, 20, y);
  y += 8;

  doc.text(`KM acoplados: ${totals.kmAcoplados}`, 20, y);
  y += 8;

  doc.text(`KM tome y cese: ${totals.kmTomeCese}`, 20, y);
  y += 8;

  doc.text(`Viáticos: ${totals.viaticos}`, 20, y);

  y += 12;

  doc.text(`Total estimado: $${Math.round(totals.monto)}`, 20, y);

  y += 20;

  doc.text("Firma chofer: ____________________", 20, y);
  y += 10;

  doc.text("Firma tránsito: ____________________", 20, y);

  doc.save(`jornada_${order.date}.pdf`);

}
// EXPORTAR
window.renderResumenDia = renderResumenDia;
window.renderBotonCerrarJornada = renderBotonCerrarJornada;
window.generarPDFJornada = generarPDFJornada;

function exportarJornadaPorNumero(){
  alert("Exportación no implementada aún");
}
window.exportarJornadaPorNumero = exportarJornadaPorNumero;