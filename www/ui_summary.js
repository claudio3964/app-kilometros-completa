"use strict";

console.log("ui_summary cargado");

const SUPABASE_URL_SUM = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY_SUM = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";
const PAGE_SIZE = 5;

// Estado de paginación
let _paginaActual = 1;
let _totalJornadas = 0;

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
  _paginaActual = 1;
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
// BOTÓN CERRAR JORNADA
// =====================================================
function renderBotonCerrarJornada() {
  const cont = document.getElementById("bloqueCerrarJornada");
  if (!cont) return;
  const order = getActiveOrder();
  if (!order) { cont.innerHTML = ""; return; }

  const hayViajeEnCurso    = order.travels?.some(t => t.status === "en_curso");
  const hayViajeProgramado = order.travels?.some(t => t.status === "programado");
  const hayGuardiaActiva   = order.guards?.some(g => g.status === "activa");

  if (hayViajeEnCurso || hayViajeProgramado || hayGuardiaActiva) {
    cont.innerHTML = ""; return;
  }

  const tieneViajes   = order.travels?.length > 0;
  const tieneGuardias = order.guards?.length > 0;

  if (!tieneViajes && !tieneGuardias) { cont.innerHTML = ""; return; }

  // ── Calcular horas transcurridas desde inicio de jornada ──
  const ahora        = Date.now();
  const createdAt    = order.createdAt || ahora;
  const horasJornada = (ahora - createdAt) / 3600000;

  const limiteHoras  = (tieneGuardias && tieneViajes) ? 9
                     : tieneGuardias                  ? 8
                     :                                  9;

  if (horasJornada < limiteHoras) {
    cont.innerHTML = ""; return;
  }

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
// RESUMEN GENERAL — con paginación desde Supabase
// =====================================================
async function renderResumenGeneral() {
  const container = document.getElementById("resumenGeneralContainer");
  if (!container) return;

  // Spinner mientras carga
  container.innerHTML = `<div class="card" style="text-align:center;color:#94a3b8;padding:20px;">Cargando jornadas…</div>`;

  const driver = window.getDriver ? getDriver() : null;
  const legajo = driver?.legajo;

  // ── INTENTAR SUPABASE ─────────────────────────────────────────────────
  if (legajo) {
    try {
      const offset = (_paginaActual - 1) * PAGE_SIZE;

      // Primero: contar total para saber cuántas páginas hay
      const resCount = await fetch(
        `${SUPABASE_URL_SUM}/rest/v1/jornadas?empresa_id=eq.cot&chofer_id=eq.${legajo}&select=id`,
        {
          headers: {
            "apikey": SUPABASE_KEY_SUM,
            "Authorization": `Bearer ${SUPABASE_KEY_SUM}`,
            "Prefer": "count=exact",
            "Range": "0-0"
          }
        }
      );
      const contentRange = resCount.headers.get("content-range") || "";
      _totalJornadas = parseInt(contentRange.split("/")[1] || "0", 10);

      // Luego: traer la página actual
      const res = await fetch(
        `${SUPABASE_URL_SUM}/rest/v1/jornadas?empresa_id=eq.cot&chofer_id=eq.${legajo}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}&select=*`,
        {
          headers: {
            "apikey": SUPABASE_KEY_SUM,
            "Authorization": `Bearer ${SUPABASE_KEY_SUM}`
          }
        }
      );

      if (res.ok) {
        const jornadas = await res.json();
        if (Array.isArray(jornadas)) {
          _renderCardsJornadas(container, jornadas.map(j => j.data || j), "supabase");
          return;
        }
      }
    } catch (e) {
      console.warn("Supabase no disponible, usando localStorage:", e.message);
    }
  }

  // ── FALLBACK: localStorage ────────────────────────────────────────────
  const orders = getOrders();
  if (!orders || orders.length === 0) {
    container.innerHTML = `<div class="card">No hay jornadas registradas</div>`;
    return;
  }
  const ordenadas = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
  _totalJornadas = ordenadas.length;
  const offset = (_paginaActual - 1) * PAGE_SIZE;
  const pagina = ordenadas.slice(offset, offset + PAGE_SIZE);
  _renderCardsJornadas(container, pagina, "local");
}

// =====================================================
// RENDER CARDS + PAGINACIÓN
// =====================================================
function _renderCardsJornadas(container, jornadas, fuente) {
  container.innerHTML = "";

  if (!jornadas || jornadas.length === 0) {
    container.innerHTML = `<div class="card">No hay jornadas en esta página</div>`;
    _renderPaginacion(container);
    return;
  }

  // Badge de fuente (debug — podés sacarlo en producción)
  if (fuente === "local") {
    const badge = document.createElement("div");
    badge.style.cssText = "font-size:11px;color:#f59e0b;text-align:right;margin-bottom:6px;";
    badge.textContent = "⚠️ Sin conexión — datos locales";
    container.appendChild(badge);
  }

  jornadas.forEach(order => {
    const totals = (order.closed && order.totalsSnapshot) ? order.totalsSnapshot : calculateOrderTotals(order);
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "10px";
    card.innerHTML = `
      <b>📅 ${order.date || '—'}</b>
      <span style="font-size:11px;color:#64748b;margin-left:8px;">${order.orderNumber || ''}</span><br>
      KM totales: ${(totals.kmTotal || 0).toFixed(1)} km<br>
      KM tome y cese: ${(totals.kmTomeCese || 0).toFixed(1)} km<br>
      Viáticos: ${totals.viaticos || 0} &nbsp;|&nbsp; Total: <b>$${Math.round(totals.monto || 0)}</b><br><br>
      <button onclick="showScreen('detalleJornadaScreen'); renderDetalleJornadaPorNumero('${order.orderNumber}');">
        Ver detalle
      </button>
      <button onclick="exportarJornadaPorNumero('${order.orderNumber}')">
        📤 Exportar
      </button>
    `;
    container.appendChild(card);
  });

  _renderPaginacion(container);

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
// CONTROLES DE PAGINACIÓN
// =====================================================
function _renderPaginacion(container) {
  const totalPaginas = Math.ceil(_totalJornadas / PAGE_SIZE);
  if (totalPaginas <= 1) return;

  const nav = document.createElement("div");
  nav.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0 8px;";

  const btnAnterior = document.createElement("button");
  btnAnterior.textContent = "← Anterior";
  btnAnterior.disabled = _paginaActual <= 1;
  btnAnterior.style.cssText = `
    padding:8px 14px;border-radius:8px;border:1px solid #334155;
    background:${_paginaActual <= 1 ? '#1e293b' : '#0f172a'};
    color:${_paginaActual <= 1 ? '#475569' : '#e2e8f0'};
    cursor:${_paginaActual <= 1 ? 'default' : 'pointer'};font-size:13px;
  `;
  btnAnterior.addEventListener("click", () => {
    if (_paginaActual > 1) { _paginaActual--; renderResumenGeneral(); }
  });

  const info = document.createElement("span");
  info.style.cssText = "font-size:13px;color:#94a3b8;";
  info.textContent = `Página ${_paginaActual} de ${totalPaginas}`;

  const btnSiguiente = document.createElement("button");
  btnSiguiente.textContent = "Siguiente →";
  btnSiguiente.disabled = _paginaActual >= totalPaginas;
  btnSiguiente.style.cssText = `
    padding:8px 14px;border-radius:8px;border:1px solid #334155;
    background:${_paginaActual >= totalPaginas ? '#1e293b' : '#0f172a'};
    color:${_paginaActual >= totalPaginas ? '#475569' : '#e2e8f0'};
    cursor:${_paginaActual >= totalPaginas ? 'default' : 'pointer'};font-size:13px;
  `;
  btnSiguiente.addEventListener("click", () => {
    if (_paginaActual < totalPaginas) { _paginaActual++; renderResumenGeneral(); }
  });

  nav.appendChild(btnAnterior);
  nav.appendChild(info);
  nav.appendChild(btnSiguiente);
  container.appendChild(nav);
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

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const driver = window.getDriver?.() || {};
  const totals = order.totalsSnapshot || {};
  const travels = (order.travels || []).filter(v => v.status !== 'cancelado');
  const guards  = order.guards || [];

  // ── Calcular KM discriminados ──────────────────────────────────────────
  let kmLinea = 0, kmPasajero = 0;
  travels.forEach(v => {
    const km = v.kmEmpresa || 0;
    if ((v.tipoServicio || v.turno || '').toUpperCase() === 'PASAJERO') {
      kmPasajero += km;
    } else {
      kmLinea += km;
    }
  });

  let kmGuardiaComun = 0, horasGuardiaComun = 0;
  let kmGuardiaEspecial = 0, horasGuardiaEspecial = 0;
  guards.forEach(g => {
    const horas = g.hours || 0;
    if (g.type === 'especial') {
      horasGuardiaEspecial += horas;
      kmGuardiaEspecial += g.kmGuardia != null ? g.kmGuardia : horas * 40;
    } else {
      horasGuardiaComun += horas;
      kmGuardiaComun += g.kmGuardia != null ? g.kmGuardia : horas * 30;
    }
  });

  const kmTotal = totals.kmTotal || 0;
  const kmTomeCese = totals.kmTomeCese || 0;
  const kmAcoplados = totals.kmAcoplados || 0;
  const monto = totals.monto || 0;
  const viaticos = totals.viaticos || 0;

  // ── Logo ──────────────────────────────────────────────────────────────
  const LOGO_B64 = "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";
  try {
    doc.addImage(LOGO_B64, 'JPEG', 155, 8, 40, 40);
  } catch(e) {
    console.warn('Logo no pudo cargarse:', e.message);
  }

  // ── Colores RutaUY ────────────────────────────────────────────────────
  const AZUL   = [26, 43, 109];   // #1a2b6d
  const DORADO = [194, 148, 50];  // #c29432
  const GRIS   = [80, 80, 80];

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RutaUY', 15, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión de Flota', 15, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE JORNADA', 15, 27);

  // ── Franja dorada ─────────────────────────────────────────────────────
  doc.setFillColor(...DORADO);
  doc.rect(0, 28, 210, 1.5, 'F');

  // ── Datos del chofer y orden ──────────────────────────────────────────
  let y = 38;
  doc.setTextColor(...GRIS);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const col1 = 15, col2 = 110;
  doc.text(`Fecha:   ${order.date || '—'}`,            col1, y);
  doc.text(`Chofer:  ${driver.nombre || '—'}`,         col2, y); y += 6;
  doc.text(`Orden:   ${order.orderNumber || '—'}`,     col1, y);
  doc.text(`Legajo:  ${driver.legajo || '—'}`,         col2, y); y += 6;
  doc.text(`Base:    ${order.baseInicio || 'Montevideo'}`, col1, y); y += 4;

  // ── Línea separadora ──────────────────────────────────────────────────
  doc.setDrawColor(...DORADO);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y); y += 6;

  // ── TOTALES ───────────────────────────────────────────────────────────
  doc.setFillColor(...AZUL);
  doc.rect(15, y - 4, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTALES DE JORNADA', 17, y + 1); y += 9;

  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');

  // Tabla de totales en dos columnas
  const filasTotales = [
    [`KM Línea:          ${kmLinea.toFixed(1)} km`,      `KM Pasajero:    ${kmPasajero.toFixed(1)} km`],
    [`KM Guardias:       ${(kmGuardiaComun + kmGuardiaEspecial).toFixed(1)} km`, `KM Acoplados:   ${kmAcoplados.toFixed(1)} km`],
    [`KM Tome y Cese:    ${kmTomeCese.toFixed(1)} km`,   `KM Total:       ${kmTotal.toFixed(1)} km`],
    [`Viáticos:          ${viaticos}`,                    `TOTAL $:        $ ${Math.round(monto).toLocaleString('es-UY')}`],
  ];

  filasTotales.forEach(fila => {
    doc.text(fila[0], col1, y);
    doc.text(fila[1], col2, y);
    y += 6;
  });

  y += 2;
  doc.setDrawColor(...DORADO);
  doc.line(15, y, 195, y); y += 6;

  // ── GUARDIAS ──────────────────────────────────────────────────────────
  if (guards.length > 0) {
    doc.setFillColor(...AZUL);
    doc.rect(15, y - 4, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('GUARDIAS', 17, y + 1); y += 9;

    doc.setTextColor(...GRIS);
    doc.setFont('helvetica', 'normal');

    // Cabecera
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo',    17,  y);
    doc.text('Inicio',  55,  y);
    doc.text('Fin',     85,  y);
    doc.text('Horas',   115, y);
    doc.text('KM',      145, y);
    doc.text('$ x hora',170, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y); y += 4;

    guards.forEach(g => {
      if (y > 270) { doc.addPage(); y = 15; }
      const kmHora = g.type === 'especial' ? 40 : 30;
      const km = g.kmGuardia != null ? g.kmGuardia : (g.hours || 0) * kmHora;
      const tipo = g.type === 'especial' ? 'Especial (40 km/h)' : 'Común (30 km/h)';
      doc.text(tipo,                    17,  y);
      doc.text(g.inicio || '—',         55,  y);
      doc.text(g.fin    || '—',         85,  y);
      doc.text(`${(g.hours || 0).toFixed(2)}h`, 115, y);
      doc.text(`${km.toFixed(1)} km`,   145, y);
      doc.text(`${kmHora} km`,          170, y);
      y += 6;
    });

    // Subtotales guardias
    y += 2;
    doc.setFont('helvetica', 'bold');
    if (horasGuardiaComun > 0)
      doc.text(`Subtotal Común:    ${horasGuardiaComun.toFixed(2)}h | ${kmGuardiaComun.toFixed(1)} km`, 17, y), y += 6;
    if (horasGuardiaEspecial > 0)
      doc.text(`Subtotal Especial: ${horasGuardiaEspecial.toFixed(2)}h | ${kmGuardiaEspecial.toFixed(1)} km`, 17, y), y += 6;
    doc.setFont('helvetica', 'normal');

    y += 2;
    doc.setDrawColor(...DORADO);
    doc.line(15, y, 195, y); y += 6;
  }

  // ── VIAJES ────────────────────────────────────────────────────────────
  if (travels.length > 0) {
    doc.setFillColor(...AZUL);
    doc.rect(15, y - 4, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE VIAJES', 17, y + 1); y += 9;

    doc.setTextColor(...GRIS);

    // Cabecera tabla
    doc.setFont('helvetica', 'bold');
    doc.text('Origen → Destino',  17, y);
    doc.text('Salida', 90,  y);
    doc.text('Llegada', 115, y);
    doc.text('KM',     143, y);
    doc.text('Tipo',   158, y);
    doc.text('Status', 178, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y); y += 4;

    travels.forEach((v, i) => {
      if (y > 270) { doc.addPage(); y = 15; }
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 252);
        doc.rect(15, y - 3, 180, 7, 'F');
      }
      const ruta = `${v.origen || '—'} → ${v.destino || '—'}`;
      const tipo = (v.tipoServicio || v.turno || '—').substring(0, 8);
      const status = v.status === 'finalizado' ? 'OK' : v.status || '—';
      doc.text(ruta.substring(0, 35), 17, y);
      doc.text(v.departureTime || '—', 90,  y);
      doc.text(v.arrivalTime   || '—', 115, y);
      doc.text(`${v.kmEmpresa || 0}`, 143, y);
      doc.text(tipo,                  158, y);
      doc.text(status,                178, y);
      y += 7;
    });

    y += 4;
    doc.setDrawColor(...DORADO);
    doc.line(15, y, 195, y); y += 6;
  }

  // ── Firmas ────────────────────────────────────────────────────────────
  if (y > 250) { doc.addPage(); y = 20; }
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text('Firma chofer:',   20, y);
  doc.line(50, y, 110, y);
  doc.text('Firma tránsito:', 120, y);
  doc.line(155, y, 195, y);

  // ── Pie de página ─────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...AZUL);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('RutaUY — Sistema de Gestión de Flota', 15, 291);
    doc.text(`Página ${i} de ${pageCount}`, 175, 291);
  }

  // ── Output ────────────────────────────────────────────────────────────
  if (returnBase64) {
    const datauri = doc.output('datauristring');
    return datauri?.split(',')[1] || '';
  }

  const fecha = order.date || new Date().toISOString().split("T")[0];
  const nombreArchivo = `jornada_${fecha}_${order.orderNumber}.pdf`;
  const esNativo = window.Capacitor?.isNativePlatform?.();

  if (esNativo) {
    try {
      const base64 = doc.output('base64');
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const Directory = { Cache: 'CACHE' };
      const writeResult = await Filesystem.writeFile({
        path: nombreArchivo,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      });
      await Share.share({
        title: nombreArchivo,
        url: writeResult.uri,
        dialogTitle: 'Guardar o compartir PDF'
      });
    } catch (e) {
      console.error('Error PDF nativo:', e?.message || e);
      alert('Error al generar PDF: ' + (e?.message || String(e)));
    }
  } else {
    doc.save(nombreArchivo);
  }
}

// =====================================================
// EXPORTS
// =====================================================
window.renderResumenGeneral     = renderResumenGeneral;
window.limpiarFiltrosResumen    = limpiarFiltrosResumen;
window.renderResumenDia         = renderResumenDia;
window.renderBotonCerrarJornada = renderBotonCerrarJornada;
window.generarPDFJornada        = generarPDFJornada;

function exportarJornadaPorNumero(orderNumber) {
  const order = getOrders().find(o => o.orderNumber === orderNumber);
  if (!order) { alert("Jornada no encontrada"); return; }
  exportarJornada(order);
}
window.exportarJornadaPorNumero = exportarJornadaPorNumero;
