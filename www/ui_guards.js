"use strict";

console.log("ui_guards cargado vscode www");
// =====================================================
// FUNCION NORMALIZAR HORAS
// =====================================================
function normalizarHora(hora) {
  try {
    if (!hora) return null;

    // Caso correcto: "HH:mm"
    if (/^\d{2}:\d{2}$/.test(hora)) {
      return hora;
    }

    // Caso tipo "H:mm" → "0H:mm"
    if (/^\d{1}:\d{2}$/.test(hora)) {
      const [h, m] = hora.split(':');
      return "".concat(h.padStart(2, '0'), ":").concat(m);
    }
    console.warn('Formato de hora inválido:', hora);
    return null;
  } catch (error) {
    console.error('Error en normalizarHora:', error);
    return null;
  }
}
window.normalizarHora = normalizarHora;
// =====================================================
// GUARDIAS (UI → CORE) JORNADA AUTOMÁTICA
// =====================================================
function addGuardUI(event) {
  if (event) event.preventDefault();
  const dia = document.getElementById("diaGuardia").value;
  const inicio = normalizarHora(document.getElementById("horaInicioGuardia").value);
  const tipo = document.getElementById("tipoGuardia").value;
  const descripcion = tipo === "especial" ? document.getElementById("descripcionGuardia").value.trim() : "";
  if (!dia) {
    alert("Seleccioná el día");
    return;
  }
  let guardia;
  try {
    guardia = addGuard(tipo, inicio, dia, descripcion);
  } catch (e) {
  if (e.message.startsWith("GUARDIA_TIPO_INVALIDO")) {
    alert("Elegí tipo de guardia válido (común o especial)");
  } else if (e.message.startsWith("GUARDIA_INICIO_INVALIDO")) {
    alert("Ingresá hora de inicio en formato HH:mm");
  } else if (e.message.startsWith("GUARDIA_DESCRIPCION_REQUERIDA")) {
    alert("Si es guardia especial, debés completar la descripción");
  } else if (e.message.startsWith("YA_EXISTE_JORNADA_ACTIVA")) {
    alert("No se pudo crear la jornada automática");
  } else if (e.message.startsWith("GUARDIA_HORA_INVALIDA")) {
    const hora = e.message.split('(')[1]?.replace(')', '') || '';
    alert(`⚠️ La guardia no puede iniciar antes del fin del último viaje${hora ? ' (' + hora + ')' : ''}`);
  } else {
    alert("Error al registrar guardia: " + e.message);
    console.error(e);
  }
  return;
}
  const order = getActiveOrder();
  if (!validarConsistenciaOrder(order, {
    strict: true
  })) {
    order.guards.pop();
    saveOrders(getOrders().map(o => o.orderNumber === order.orderNumber ? order : o));
    setActiveOrder(order);
    alert("⚠️ Inconsistencia detectada en la jornada");
    return;
  }
  renderResumenDia();
  renderListaGuardias();
  alert("Guardia ".concat(guardia.type, " registrada. Inicio: ").concat(guardia.inicio));
  if (typeof onGuardiaIniciada === 'function') onGuardiaIniciada();
  showScreen("mainScreen");
}

// 🔥 EXPORT GLOBAL (IMPORTANTE PARA WEBVIEW)
window.addGuardUI = addGuardUI;

// =====================================================
// TARJETAS DE GUARDIAS POR DÍA — VERSIÓN CORREGIDA
// Muestra: inicio, fin (o EN CURSO), horas, km, tipo
// =====================================================

function renderTarjetasGuardiasPorDia() {
  const container = document.getElementById("cardsGuardiasContainer");
  if (!container) return;
  container.innerHTML = "";

  // Buscar guardias en jornada activa Y en historial
  const porDia = {};

  // Función para agregar guardias de una orden
  function agregarGuardiasDeOrden(order) {
    if (!order || !order.guards) return;
    order.guards.forEach(g => {
      const fecha = g.dia || order.date;
      if (!fecha) return;
      if (!porDia[fecha]) porDia[fecha] = [];
      porDia[fecha].push(g);
    });
  }

  // Primero la jornada activa
  const activeOrder = getActiveOrder();
  agregarGuardiasDeOrden(activeOrder);

  // Luego el historial (últimas 7 jornadas cerradas)
  const orders = getOrders ? getOrders() : [];
  orders.filter(o => o.closed && o.guards && o.guards.length > 0).slice(-7).forEach(o => agregarGuardiasDeOrden(o));
  const fechas = Object.keys(porDia).filter(f => f && f !== "undefined").sort((a, b) => new Date(b) - new Date(a)).slice(0, 5);
  fechas.forEach(fecha => {
    const card = document.createElement("div");
    card.style.cssText = "\n      border:1px solid #ddd;\n      border-radius:12px;\n      padding:12px;\n      background:white;\n      box-shadow:0 2px 6px rgba(0,0,0,.1);\n      margin-bottom:10px;\n    ";
    let guardiasHTML = "";
    porDia[fecha].forEach(g => {
      const kmHora = g.type === "especial" ? 40 : 30;

      // ── GUARDIA EN CURSO ──
      if (g.status === "en_curso") {
        const ahora = new Date();
        const [hI, mI] = g.inicio.split(":").map(Number);
        const inicio = new Date();
        inicio.setHours(hI, mI, 0, 0);
        const transcurridoMin = Math.max(0, Math.floor((ahora - inicio) / 60000));
        const hTrans = Math.floor(transcurridoMin / 60);
        const mTrans = transcurridoMin % 60;
        const kmAcum = (transcurridoMin / 60 * kmHora).toFixed(1);
        guardiasHTML += "\n          <div style=\"\n            background:#fff3e0;\n            border:1px solid #ffb300;\n            border-radius:8px;\n            padding:10px;\n            margin:6px 0;\n            font-size:14px;\n            line-height:1.8;\n          \">\n            \uD83D\uDFE1 <b>EN CURSO</b><br>\n            \uD83D\uDD50 Inicio: <b>".concat(g.inicio, "</b><br>\n            \u23F1 Transcurrido: <b>").concat(hTrans, "h ").concat(mTrans, "m</b><br>\n            \uD83D\uDCCF KM acumulados: <b>").concat(kmAcum, " km</b><br>\n            \uD83D\uDD16 Tipo: <b>").concat(g.type, "</b>\n            <br><br>\n            <button onclick=\"finalizarGuardiaUI('").concat(g.createdAt, "')\"\n              style=\"\n                background:#c62828;\n                color:white;\n                border:none;\n                border-radius:6px;\n                padding:8px 16px;\n                font-size:14px;\n                cursor:pointer;\n              \">\n              Finalizar Guardia\n            </button>\n          </div>\n        ");

        // ── GUARDIA FINALIZADA ──
      } else {
        // Recalcular horas y km desde inicio/fin para garantizar consistencia
        let horas = g.hours || 0;
        let km = g.kmGuardia;
        if (g.inicio && g.fin) {
          const [hI, mI] = g.inicio.split(":").map(Number);
          const [hF, mF] = g.fin.split(":").map(Number);
          let calculado = hF + mF / 60 - (hI + mI / 60);
          if (calculado < 0) calculado += 24; // cruce medianoche
          if (calculado > 0) {
            horas = calculado;
            km = horas * kmHora;
          }
        }

        // Indicar si fue cortada automáticamente por viaje
        const cortadaAuto = g.cortadaAuto ? "<span style=\"font-size:12px; color:#888;\"> \u2702\uFE0F cortada por viaje</span>" : "";
        const viatico = g.viatico ? "<span style=\"color:green;\"> \u2705 Vi\xE1tico</span>" : "";
        const horasStr = Number.isFinite(horas) ? horas.toFixed(2) : "0.00";
        const kmStr = Number.isFinite(km) ? km.toFixed(1) : "0.0";
        guardiasHTML += "\n          <div style=\"\n            background:#f9f9f9;\n            border:1px solid #ddd;\n            border-radius:8px;\n            padding:10px;\n            margin:6px 0;\n            font-size:14px;\n            line-height:1.8;\n          \">\n            \u2705 <b>FINALIZADA</b>".concat(cortadaAuto, "<br>\n            \uD83D\uDD50 Inicio: <b>").concat(g.inicio || "--:--", "</b><br>\n            \uD83D\uDD51 Fin: <b>").concat(g.fin || "--:--", "</b><br>\n            \u23F1 Duraci\xF3n: <b>").concat(horasStr, " h</b><br>\n            \uD83D\uDCCF KM generados: <b>").concat(kmStr, " km</b><br>\n            \uD83D\uDD16 Tipo: <b>").concat(g.type, "</b>").concat(viatico, "\n            ").concat(g.descripcion ? "<br>\uD83D\uDCDD ".concat(g.descripcion) : "", "\n          </div>\n        ");
      }
    });
    const [yyyy, mm, dd] = fecha.split("-");
    const fechaDisplay = "".concat(dd, "/").concat(mm, "/").concat(yyyy);
    card.innerHTML = "\n      <p style=\"font-weight:bold; margin:0 0 8px 0;\">\uD83D\uDCC5 ".concat(fechaDisplay, "</p>\n      <p style=\"font-weight:bold; margin:0 0 4px 0;\">Guardias:</p>\n      ").concat(guardiasHTML || "<p style='color:#888;'>Sin guardias registradas</p>", "\n    ");
    container.appendChild(card);
  });
}

// =====================================================
// FUNCIÓN PRINCIPAL LLAMADA POR LA APP
// =====================================================

function renderListaGuardias() {
  renderTarjetasGuardiasPorDia();
}

// =====================================================
// CONTROL VISUAL DE DESCRIPCIÓN DE GUARDIA
// =====================================================

function manejarDescripcionGuardia() {
  const tipo = document.getElementById("tipoGuardia").value;
  const box = document.getElementById("boxDescripcionGuardia");
  if (tipo === "especial") {
    box.style.display = "block";
  } else {
    box.style.display = "none";
    document.getElementById("descripcionGuardia").value = "";
  }
}

// =====================================================
// FINALIZAR GUARDIA MANUAL (botón en card)
// =====================================================

function finalizarGuardiaUI(createdAt) {
  var _renderBotonCerrarJor;
  let g;
  try {
    g = finalizarGuardia(createdAt);
  } catch (e) {
    if (e.message === "GUARDIA_NO_ENCONTRADA") {
      alert("Guardia no encontrada");
    } else {
      alert("Error al finalizar guardia: " + e.message);
      console.error(e);
    }
    return;
  }
  renderResumenDia();
  renderListaGuardias();
  (_renderBotonCerrarJor = renderBotonCerrarJornada) === null || _renderBotonCerrarJor === void 0 || _renderBotonCerrarJor();
  alert("Guardia finalizada: ".concat(g.inicio, " \u2013 ").concat(g.fin, " | ").concat(g.hours.toFixed(2), "h | ").concat(g.kmGuardia.toFixed(1), " km"));
}
window.finalizarGuardiaUI = finalizarGuardiaUI;

// =====================================================
// EXPORTS
// =====================================================

window.addGuardUI = addGuardUI;
window.renderListaGuardias = renderListaGuardias;
window.renderTarjetasGuardiasPorDia = renderTarjetasGuardiasPorDia;
window.manejarDescripcionGuardia = manejarDescripcionGuardia;
