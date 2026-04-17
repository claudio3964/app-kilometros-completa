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
  box.innerHTML = `🟢 Orden activa: <b>${order.orderNumber}</b><br>Base: ${order.baseInicio}`;
}

// =====================================================
// RESUMEN DE LA JORNADA ACTIVA
// =====================================================
function renderResumenDia() {
  const box = document.getElementById("summaryDiaBox");
  if (!box) return;
  const order = getActiveOrder();
  if (!order) {
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
  const t = calculateOrderTotals(order);
  box.innerHTML = `
    KM totales: <b>${t.kmTotal || 0}</b><br>
    KM tome y cese: <b>${t.kmTomeCese || 0}</b><br>
    KM guardias: <b>${t.kmGuardias || 0}</b><br>
    KM acoplados: <b>${t.kmAcoplados || 0}</b><br>
    Viáticos generados: <b>${t.viaticos || 0}</b><br>
    Total $: <b>${Math.round(t.monto || 0)}</b>
  `;
}

// =====================================================
// BOTÓN CERRAR JORNADA — FIX: await closeActiveOrder
// =====================================================
function renderBotonCerrarJornada() {
  const cont = document.getElementById("bloqueCerrarJornada");
  if (!cont) return;
  const order = getActiveOrder();
  if (!order) { cont.innerHTML = ""; return; }

  const hayViajeEnCurso   = order.travels?.some(t => t.status === "en_curso");
  const hayViajeProgramado = order.travels?.some(t => t.status === "programado");
  const hayGuardiaActiva   = order.guards?.some(g => g.status === "activa");

  if (hayViajeEnCurso || hayViajeProgramado || hayGuardiaActiva) {
    cont.innerHTML = ""; return;
  }

  const tieneActividad = (order.travels?.length > 0) || (order.guards?.length > 0);
  if (!tieneActividad) { cont.innerHTML = ""; return; }

  cont.innerHTML = `
    <button id="btnCerrarJornadaManual" style="
      background:#c62828; color:white; border:none;
      border-radius:8px; padding:6px 12px;
      font-size:13px; font-weight:bold; cursor:pointer;">
      Finalizar Jornada
    </button>
  `;

  document.getElementById("btnCerrarJornadaManual").addEventListener("click", async function () {
    const confirmar = confirm("¿Confirma que desea finalizar la jornada?");
    if (!confirmar) return;

    // ✅ FIX CRÍTICO: await — closeActiveOrder es async
    const resultado = await closeActiveOrder();

    if (resultado) {
      try {
        await exportarJornada(resultado);
      } catch (e) {
        console.warn("Error exportando jornada", e);
      }
      alert("✅ Jornada finalizada y enviada correctamente");
      renderBotonCerrarJornada();
      renderOrdenActivaUI?.();
      showScreen("mainScreen");
    }
  });
}

// =====================================================
// RESUMEN GENERAL
// =====================================================
function renderResumenGeneral() {
  const container = document.getElementById("resumenGeneralContainer");
  if (!container) return;
  const orders = getOrders();
  if (!orders || orders.length === 0) {
    container.innerHTML = `<div class="card">No hay jornadas registradas</div>`;
    return;
  }
  container.innerHTML = "";

  const ordenadas = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
  const unicosPorDia = [];
  const fechasVistas = new Set();
  ordenadas.forEach(o => {
    if (!fechasVistas.has(o.date)) { unicosPorDia.push(o); fechasVistas.add(o.date); }
  });

  const ultimos5 = unicosPorDia.slice(0, 5);
  ultimos5.forEach(order => {
    const totals = calculateOrderTotals(order);
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "10px";
    card.innerHTML = `
      <b>📅 ${order.date}</b><br>
      KM totales: ${(totals.kmTotal || 0).toFixed(1)} km<br>
      KM tome y cese: ${(totals.kmTomeCese || 0).toFixed(1)} km<br>
      Viáticos: ${totals.viaticos || 0}<br><br>
      <button onclick="showScreen('detalleJornadaScreen'); renderDetalleJornadaPorNumero('${order.orderNumber}');">
        Ver detalle
      </button>
      <button onclick="exportarJornadaPorNumero('${order.orderNumber}')">
        📤 Exportar
      </button>
    `;
    container.appendChild(card);
  });

  // Botón limpiar storage
  const btnLimpiar = document.createElement("div");
  btnLimpiar.style.cssText = "margin-top:30px; text-align:center;";
  btnLimpiar.innerHTML = `
    <button id="btnLimpiarStorage" style="
      background:none; border:1px solid #ccc;
      border-radius:8px; padding:8px 16px;
      font-size:12px; color:#999; cursor:pointer;">
      🗑 Limpiar datos de prueba
    </button>
  `;
  container.appendChild(btnLimpiar);
  document.getElementById("btnLimpiarStorage").addEventListener("click", limpiarTodosLosDatos);
}

// =====================================================
// GENERAR PDF JORNADA
// =====================================================
async function generarPDFJornada(order) {
  let { returnBase64 = false } = arguments[1] || {};

  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn("jsPDF no cargado, se omite PDF");
    return null;
  }

  if (!order || !order.orderNumber) {
    console.error("generarPDFJornada: order inválido", order);
    return null;
  }

  console.log("GENERANDO PDF DE JORNADA", order.orderNumber);
  console.log('jspdf:', !!window.jspdf, 'jsPDF:', !!window.jspdf?.jsPDF, 'type:', typeof window.jspdf?.jsPDF);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  console.log('doc pages:', doc.internal?.pages?.length, '| doc type:', typeof doc, '| output type:', typeof doc.output);
  const totals = calculateOrderTotals(order);
  const driver = window.getDriver?.() || {};

  let y = 15;
  const add = (txt, salto = 7) => {
    // evitar que el texto se salga de la página
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text(String(txt), 15, y);
    y += salto;
  };

  doc.setFontSize(14);
  add("COT Driver - Resumen de Jornada", 10);
  doc.setFontSize(11);
  add(`Fecha: ${order.date || '—'}`);
  add(`Orden: ${order.orderNumber || '—'}`);
  add(`Chofer: ${driver.nombre || '—'} (Legajo: ${driver.legajo || '—'})`);
  add(`Base: ${order.baseInicio || 'Montevideo'}`);
  y += 5;

  add("=== TOTALES ===");
  add(`KM Totales: ${(totals.kmTotal || 0).toFixed(1)}`);
  add(`KM Viajes: ${(totals.kmViajes || 0).toFixed(1)}`);
  add(`KM Guardias: ${(totals.kmGuardias || 0).toFixed(1)}`);
  add(`KM Acoplados: ${(totals.kmAcoplados || 0).toFixed(1)}`);
  add(`KM Tome y Cese: ${(totals.kmTomeCese || 0).toFixed(1)}`);
  add(`Viáticos: ${totals.viaticos || 0}`);
  add(`Total $: ${Math.round(totals.monto || 0)}`);
  y += 5;

  // Viajes
  if (order.travels?.length) {
    add("=== VIAJES ===");
    order.travels.filter(v => v.status !== 'cancelado').forEach(v => {
      add(`${v.origen} → ${v.destino} | ${v.departureTime} - ${v.arrivalTime} | ${v.kmEmpresa || 0} km | ${v.tipoServicio || v.turno || '—'}`);
    });
    y += 3;
  }

  // Guardias
  if (order.guards?.length) {
    add("=== GUARDIAS ===");
    order.guards.forEach(g => {
      add(`${g.type} | ${g.inicio} - ${g.fin || '--'} | ${(g.hours || 0).toFixed(2)}h | ${(g.kmGuardia || 0).toFixed(1)} km`);
    });
    y += 3;
  }

  y += 10;
  add("Firma chofer: ____________________", 10);
  add("Firma tránsito: ____________________", 10);

  if (returnBase64) {
    const datauri = doc.output('datauristring');
    console.log('datauristring length:', datauri?.length, '| prefix:', datauri?.substring(0, 40));
    const b64 = datauri?.split(',')[1] || '';
    console.log('b64 length:', b64.length);
    return b64;
  }

  const fecha = order.date || new Date().toISOString().split("T")[0];
  const nombreArchivo = `jornada_${fecha}_${order.orderNumber}.pdf`;

  // ── CAPACITOR (APK Android) ──
  const esNativo = window.Capacitor?.isNativePlatform?.();
  if (esNativo) {
    try {
      const base64 = doc.output('base64');
      const { Filesystem, Share } = window.Capacitor.Plugins;
      // Cache: único directorio garantizado en el FileProvider de Capacitor para compartir
      const Directory = { Cache: 'CACHE' };

      const writeResult = await Filesystem.writeFile({
        path: nombreArchivo,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      });
      console.log('writeFile result:', writeResult);
      // writeFile ya devuelve { uri } — no hace falta getUri (evita hang en Documents)
      const fileUri = writeResult.uri;
      console.log('fileUri:', fileUri);

      await Share.share({
        title: nombreArchivo,
        url: fileUri,
        dialogTitle: 'Guardar o compartir PDF'
      });
      console.log('Share ejecutado');

    } catch (e) {
      console.error('Error PDF nativo:', e?.message || e, e);
      alert('Error al generar PDF: ' + (e?.message || String(e)));
    }
  } else {
    // ── WEB / PC ── comportamiento normal
    doc.save(nombreArchivo);
  }
}

// EXPORT GLOBAL
window.renderResumenGeneral    = renderResumenGeneral;
window.limpiarFiltrosResumen   = limpiarFiltrosResumen;
window.renderResumenDia        = renderResumenDia;
window.renderBotonCerrarJornada = renderBotonCerrarJornada;
window.generarPDFJornada       = generarPDFJornada;

function exportarJornadaPorNumero(orderNumber) {
  const order = getOrders().find(o => o.orderNumber === orderNumber);
  if (!order) { alert("Jornada no encontrada"); return; }
  exportarJornada(order);
}
window.exportarJornadaPorNumero = exportarJornadaPorNumero;
