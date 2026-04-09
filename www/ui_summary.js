"use strict";

console.log("ui_summary cargado");

// =====================================================
// LIMPIAR FILTROS
// =====================================================

function limpiarFiltrosResumen() {
  const fOrden = document.getElementById("filtroOrden");
  const fDesde = document.getElementById("filtroDesde");
  const fHasta = document.getElementById("filtroHasta");
  const ordenar = document.getElementById("ordenarPor");
  if (fOrden) fOrden.value = "";
  if (fDesde) fDesde.value = "";
  if (fHasta) fHasta.value = "";
  if (ordenar) ordenar.value = "fecha_desc";
  renderResumenGeneral();
}
// ======================================
// MOSTRAR ORDEN ACTIVA EN UI
// ======================================

function renderOrdenActivaUI() {
  const box = document.getElementById("ordenActivaInfo");
  if (!box) return;
  const order = getActiveOrder();
  if (!order) {
    box.innerHTML = "🔴 Sin jornada activa";
    return;
  }
  box.innerHTML = "\n    \uD83D\uDFE2 Orden activa: <b>".concat(order.orderNumber, "</b><br>\n    Base: ").concat(order.baseInicio, "\n  ");
}

// EXPORT GLOBAL
window.renderResumenGeneral = renderResumenGeneral;
window.limpiarFiltrosResumen = limpiarFiltrosResumen;
// =====================================================
// RESUMEN DE LA JORNADA ACTIVA (USA SOLO EL CORE)
// =====================================================

// =====================================================
// RESUMEN DE LA JORNADA ACTIVA (USA SOLO EL CORE)
// =====================================================

function renderResumenDia() {
  const box = document.getElementById("summaryDiaBox");
  if (!box) return;
  const order = getActiveOrder();
  if (!order) {
    box.innerHTML = "\n      KM totales: 0<br>\n      KM tome y cese: 0<br>\n      KM guardias: 0<br>\n      KM acoplados: 0<br>\n      Vi\xE1ticos generados: 0<br>\n      Total $: 0\n    ";
    return;
  }

  // USAR EL CORE (FUENTE ÚNICA DE VERDAD)
  const t = calculateOrderTotals(order);
  box.innerHTML = "\n    KM totales: <b>".concat(t.kmTotal || 0, "</b><br> <!-- \uD83D\uDD27 CAMBIO -->\n    KM tome y cese: <b>").concat(t.kmTomeCese || 0, "</b><br>\n    KM guardias: <b>").concat(t.kmGuardias || 0, "</b><br>\n    KM acoplados: <b>").concat(t.kmAcoplados || 0, "</b><br>\n    Vi\xE1ticos generados: <b>").concat(t.viaticos || 0, "</b><br>\n    Total $: <b>").concat(Math.round(t.monto || 0), "</b>\n  ");
}
function renderBotonCerrarJornada() {
  var _order$travels, _order$travels2, _order$guards, _order$travels3, _order$guards2;
  const cont = document.getElementById("bloqueCerrarJornada");
  if (!cont) return;
  const order = getActiveOrder();
  if (!order) {
    cont.innerHTML = "";
    return;
  }
  const hayViajeEnCurso = (_order$travels = order.travels) === null || _order$travels === void 0 ? void 0 : _order$travels.some(t => t.status === "en_curso");
  const hayViajeProgramado = (_order$travels2 = order.travels) === null || _order$travels2 === void 0 ? void 0 : _order$travels2.some(t => t.status === "programado");
  const hayGuardiaActiva = (_order$guards = order.guards) === null || _order$guards === void 0 ? void 0 : _order$guards.some(g => g.status === "activa");
  if (hayViajeEnCurso || hayViajeProgramado || hayGuardiaActiva) {
    cont.innerHTML = "";
    return;
  }
  const tieneActividad = ((_order$travels3 = order.travels) === null || _order$travels3 === void 0 ? void 0 : _order$travels3.length) > 0 || ((_order$guards2 = order.guards) === null || _order$guards2 === void 0 ? void 0 : _order$guards2.length) > 0;
  if (!tieneActividad) {
    cont.innerHTML = "";
    return;
  }
  cont.innerHTML = "\n    <button id=\"btnCerrarJornadaManual\"\n      style=\"\n        background:#c62828;\n        color:white;\n        border:none;\n        border-radius:8px;\n        padding:6px 12px;\n        font-size:13px;\n        font-weight:bold;\n        cursor:pointer;\n      \">\n      Finalizar Jornada\n    </button>\n  ";
  document.getElementById("btnCerrarJornadaManual").addEventListener("click", async function () {
    const confirmar = confirm("¿Confirma que desea finalizar la jornada?");
    if (!confirmar) return;
    const resultado = closeActiveOrder();
    if (resultado) {
      try {
        await exportarJornada(resultado);
      } catch (e) {
        console.warn("Error exportando jornada", e);
      }
      alert("✅ Jornada finalizada y enviada correctamente");
      renderBotonCerrarJornada();
      renderOrdenActivaUI === null || renderOrdenActivaUI === void 0 || renderOrdenActivaUI();
      showScreen("mainScreen");
    }
  });
}
function renderResumenGeneral() {
  const container = document.getElementById("resumenGeneralContainer");
  if (!container) return;
  const orders = getOrders();
  if (!orders || orders.length === 0) {
    container.innerHTML = "\n      <div class=\"card\">\n        No hay jornadas registradas\n      </div>\n    ";
    return;
  }
  container.innerHTML = "";

  // ================================
  // ORDENAR + LIMPIAR DUPLICADOS POR DÍA
  // ================================

  // ordenar primero
  const ordenadas = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));

  // eliminar duplicados por fecha
  const unicosPorDia = [];
  const fechasVistas = new Set();
  ordenadas.forEach(o => {
    if (!fechasVistas.has(o.date)) {
      unicosPorDia.push(o);
      fechasVistas.add(o.date);
    }
  });

  // tomar solo últimos 5 días
  const ultimos5 = unicosPorDia.slice(0, 5);
  ultimos5.forEach(order => {
    const totals = calculateOrderTotals(order);
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "10px";
    card.innerHTML = "\n      <b>\uD83D\uDCC5 ".concat(order.date, "</b><br>\n\n      KM totales: ").concat((totals.kmTotal || 0).toFixed(1), " km<br>\n      KM tome y cese: ").concat((totals.kmTomeCese || 0).toFixed(1), " km<br>\n      Vi\xE1ticos: ").concat(totals.viaticos || 0, "<br><br>\n\n      <button onclick=\"\n        showScreen('detalleJornadaScreen');\n        renderDetalleJornadaPorNumero('").concat(order.orderNumber, "');\n      \">\n        Ver detalle\n      </button>\n\n      <button onclick=\"exportarJornadaPorNumero('").concat(order.orderNumber, "')\">\n        \uD83D\uDCE4 Exportar\n      </button>\n    ");
    container.appendChild(card);
  });

  // Boton limpiar storage (solo desarrollo)
  const btnLimpiar = document.createElement("div");
  btnLimpiar.style.cssText = "margin-top:30px; text-align:center;";
  btnLimpiar.innerHTML = "\n    <button id=\"btnLimpiarStorage\" style=\"\n      background:none;\n      border:1px solid #ccc;\n      border-radius:8px;\n      padding:8px 16px;\n      font-size:12px;\n      color:#999;\n      cursor:pointer;\n    \">\n      \uD83D\uDDD1 Limpiar datos de prueba\n    </button>\n  ";
  container.appendChild(btnLimpiar);
  document.getElementById("btnLimpiarStorage").addEventListener("click", function () {
    const c1 = confirm("¿Borrar todos los datos?");
    if (!c1) return;
    const c2 = confirm("Esta acción no se puede deshacer. ¿Confirmar?");
    if (!c2) return;
    localStorage.clear();
    location.reload();
  });
}
async function generarPDFJornada(order) {
  // 🔴 BLOQUE NUEVO (va arriba de todo)
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn("jsPDF no cargado, se omite PDF");
    return;
  }
  console.log("GENERANDO PDF DE JORNADA", order);

  // 👇 esto queda igual
  const {
    jsPDF
  } = window.jspdf;
  const doc = new jsPDF();
  const totals = calculateOrderTotals(order);
  let y = 20;
  doc.setFontSize(16);
  doc.text("COT Driver - Resumen de Jornada", 20, y);
  y += 12;
  doc.setFontSize(12);
  doc.text("Fecha: ".concat(order.date), 20, y);
  y += 8;
  doc.text("Orden: ".concat(order.orderNumber), 20, y);
  y += 8;
  doc.text("Base: ".concat(order.baseInicio || "Montevideo"), 20, y);
  y += 10;
  doc.text("KM totales: ".concat(totals.kmTotal), 20, y);
  y += 8;
  doc.text("KM guardias: ".concat(totals.kmGuardias), 20, y);
  y += 8;
  doc.text("KM acoplados: ".concat(totals.kmAcoplados), 20, y);
  y += 8;
  doc.text("KM tome y cese: ".concat(totals.kmTomeCese), 20, y);
  y += 8;
  doc.text("Vi\xE1ticos: ".concat(totals.viaticos), 20, y);
  y += 12;
  doc.text("Total estimado: $".concat(Math.round(totals.monto)), 20, y);
  y += 20;
  doc.text("Firma chofer: ____________________", 20, y);
  y += 10;
  doc.text("Firma tránsito: ____________________", 20, y);
  doc.save("jornada_".concat(order.date, ".pdf"));
}
// EXPORTAR
window.renderResumenDia = renderResumenDia;
window.renderBotonCerrarJornada = renderBotonCerrarJornada;
window.generarPDFJornada = generarPDFJornada;
function exportarJornadaPorNumero() {
  alert("Exportación no implementada aún");
}
window.exportarJornadaPorNumero = exportarJornadaPorNumero;
