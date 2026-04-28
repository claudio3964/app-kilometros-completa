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
  const totals = calculateOrderTotals(order);
  const driver = window.getDriver?.() || {};

  let y = 15;
  const add = (txt, salto = 7) => {
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

  if (order.travels?.length) {
    add("=== VIAJES ===");
    order.travels.filter(v => v.status !== 'cancelado').forEach(v => {
      add(`${v.origen} → ${v.destino} | ${v.departureTime} - ${v.arrivalTime} | ${v.kmEmpresa || 0} km | ${v.tipoServicio || v.turno || '—'}`);
    });
    y += 3;
  }

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
    const b64 = datauri?.split(',')[1] || '';
    return b64;
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
      const fileUri = writeResult.uri;
      await Share.share({
        title: nombreArchivo,
        url: fileUri,
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
