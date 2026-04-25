"use strict";

console.log("ui_travels cargado version dentro www");
// ===============================
// JORNADA - UI
// ===============================

function createOrderUI() {
  try {
    const o = createOrder(); // CORE

    document.getElementById("ordenActivaInfo").innerText = "🟢 Jornada activa: " + o.orderNumber;
    alert("Jornada iniciada");
  } catch (e) {
    if (e.message === "YA_EXISTE_JORNADA_ACTIVA") {
      alert("Ya existe una jornada activa.");
    } else {
      throw e;
    }
  }
}
function closeActiveOrderUI() {
  console.log("🔥 ENTRE A closeActiveOrderUI");
  const o = closeActiveOrder(); // CORE

  if (!o) {
    alert("No hay jornada activa");
    return;
  }
  document.getElementById("ordenActivaInfo").innerText = "🔴 Sin jornada activa";
  const ordenFinal = getOrders().find(ord => ord.orderNumber === o.orderNumber);
  console.log("ANTES DE SYNC");
  syncPendientes();
  console.log("DESPUES DE SYNC");
  exportarJornada(ordenFinal);
  alert("Jornada cerrada");
}
// =====================================================
// LISTA DE VIAJES — VERSION FINAL PROFESIONAL COMPLETA
// Compatible 100% con CORE COT DRIVER ENGINE
// Muestra tipo de servicio y acoplado correctamente
// =====================================================

function renderListaViajes() {
  const container = document.getElementById("cardsViajesContainer");
  if (!container) return;
  container.innerHTML = "";
  let orders = getOrders();
  if (!orders || orders.length === 0) {
    container.innerHTML = "\n      <div class=\"empty-state\">\n        Sin jornadas registradas\n      </div>\n    ";
    return;
  }

  // ordenar por fecha descendente
  orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  const ultimasOrdenes = orders.slice(0, 6);
  const activeOrder = getActiveOrder();
  ultimasOrdenes.forEach(order => {
    const totales = calculateOrderTotals(order);
    const card = document.createElement("div");
    card.className = "order-card";
    card.onclick = () => {
      showScreen('detalleOrdenScreen');
      renderDetalleJornadaPorNumero(order.orderNumber);
    };

    // =========================
    // TITULO
    // =========================

    const titulo = document.createElement("div");
    titulo.className = "order-title";
    titulo.innerText = activeOrder && order.orderNumber === activeOrder.orderNumber ? "\uD83D\uDCC5 ".concat(order.date, " \u2014 Jornada activa") : "\uD83D\uDCC5 ".concat(order.date);
    card.appendChild(titulo);

    // =========================
    // RESUMEN
    // =========================

    const resumen = document.createElement("div");
    resumen.className = "order-summary";
    resumen.innerHTML = "\n      Tome y cese: ".concat(totales.kmTomeCese.toFixed(1), " km<br>\n      Guardias: ").concat(totales.kmGuardias.toFixed(1), " km<br>\n      Acoplados: ").concat(totales.kmAcoplados.toFixed(1), " km<br>\n      Vi\xE1ticos: ").concat(totales.viaticos, "<br>\n      Total jornada: ").concat(totales.kmTotal.toFixed(1), " km\n    ");
    card.appendChild(resumen);

    // =========================
    // VIAJES
    // =========================

    const travels = order.travels || [];
    travels.sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));
    travels.forEach(v => {
      var _ref, _v$kmAuto;
      const km = (_ref = (_v$kmAuto = v.kmAuto) !== null && _v$kmAuto !== void 0 ? _v$kmAuto : v.kmEmpresa) !== null && _ref !== void 0 ? _ref : 0;
      const estado = v.status || "finalizado";
      const item = document.createElement("div");
      item.className = "travel-card ".concat(estado);

      // =========================
      // ESTADO TEXTO
      // =========================

      let estadoTexto = "⚫ FINALIZADO";
      if (estado === "programado") estadoTexto = "🟡 PROGRAMADO";
      if (estado === "en_curso") estadoTexto = "🟢 EN CURSO";
      if (estado === "cancelado") estadoTexto = "⛔ CANCELADO";

      // =========================
      // SERVICIO Y ACOPLADO
      // =========================

      const tipoServicio = v.tipoServicio || v.turno || "—";
      const acopladoTexto = v.acopladoKm > 0 || v.acoplado ? "SI" : "NO";

      // =========================
      // TIEMPO TRANSCURRIDO
      // =========================

      let tiempoHTML = "";
      if (estado === "en_curso" && v.inicioReal) {
        const diffMin = Math.floor((Date.now() - v.inicioReal) / 60000);
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        tiempoHTML = "<div class=\"travel-time\">\u23F1 ".concat(h, "h ").concat(m, "m transcurridos</div>");
      }
      // ============================
      // VIAJE FINALIZADO
      // ============================

      if (estado === "finalizado" && v.arrivalTime) {
        let horaReal = v.arrivalTime;
        if (v.llegadaReal) {
          const d = new Date(v.llegadaReal);
          horaReal = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        }
        tiempoHTML = "<div class=\"travel-time\">\uD83C\uDFC1 Llegada: ".concat(horaReal, "</div>");
      }
      // =========================
      // RENDER ITEM
      // =========================

      item.innerHTML = "\n\n        <div class=\"travel-status ".concat(estado, "\">\n          ").concat(estadoTexto, "\n        </div>\n\n        <div>\n          \uD83D\uDE8D ").concat(v.origen, " \u2192 ").concat(v.destino, "\n        </div>\n\n        <div>\n          \uD83D\uDEA6 Servicio: <b>").concat(tipoServicio, "</b>\n        </div>\n\n        <div>\n          \uD83D\uDD17 Acoplado: <b>").concat(acopladoTexto, "</b>\n        </div>\n\n        <div>\n          \uD83D\uDD52 ").concat(v.departureTime, "\n          - ").concat(v.arrivalTime || "--:--", "\n        </div>\n\n        ").concat(tiempoHTML, "\n\n         <div>\n          \uD83D\uDCCF ").concat(km, " km\n        </div>\n\n        <div>\n          \uD83D\uDE8D Coche: ").concat(v.coche || "-", "\n        </div>\n      ");
      card.appendChild(item);
    });
    container.appendChild(card);
  });
}
window.renderListaViajes = renderListaViajes;
// =====================================================
// CARGAR VIAJE DE RETORNO AUTOMÁTICO (CORREGIDO)
// =====================================================

function cargarViajeRetornoAutomatico(data) {
  console.log("📡 Recibiendo retorno automático:", data);

  const origenRetorno = data.destino;
  const destinoRetorno = data.origen;

  // 1) Abrimos pantalla de viaje
  showScreen("travelScreen");

  // 2) Cargamos datos invertidos ← ESTE BLOQUE ES EL QUE CAMBIA
  const selOrigen = document.getElementById("originTravels");
  if (typeof cargarSelectorOrigen === 'function') {
    cargarSelectorOrigen(origenRetorno);
  }
  const opcionExiste = Array.from(selOrigen.options).some(
    o => o.value.toLowerCase() === origenRetorno.toLowerCase()
  );
  if (!opcionExiste) {
    const opt = document.createElement('option');
    opt.value = origenRetorno;
    opt.textContent = origenRetorno;
    selOrigen.appendChild(opt);
  }
  selOrigen.value = origenRetorno;

  document.getElementById("destinationTravels").value = destinoRetorno;
  document.getElementById("departureTimeTravels").value = data.horaSalida || "";
  document.getElementById("arrivalTimeTravels").value = data.horaLlegadaEstimada || "";

  
   // 3) Servicio si existe
  if (data.servicio) {
    const selectServ = document.getElementById("numeroServicio");
    if (selectServ) {
      selectServ.value = data.servicio;
      if (typeof actualizarInfoServicio === 'function') {
        actualizarInfoServicio();
      }
    }
  } else {
    const selectServ = document.getElementById("numeroServicio");
    if (selectServ) {
      selectServ.value = "TURNO";
      if (typeof actualizarInfoServicio === 'function') {
        actualizarInfoServicio();
      }
    }
  }
  // Forzar servicioSeleccionado para bypass de validación
  window.servicioSeleccionado = {
    turno: data.servicio || 'TURNO',
    tipo: data.servicio || 'TURNO'
  };

  // 4) Calculamos KM correctamente con ruta invertida
  const km = buscarKmRuta(origenRetorno, destinoRetorno);
  document.getElementById("kmTravels").value = km;
  console.log("🔁 KM retorno calculado:", km);

  // 5) Aviso visual
  const aviso = document.createElement("div");
  aviso.style.cssText = "\n    padding:10px;\n    margin-bottom:10px;\n    background:#e8f3ff;\n    border-left:5px solid #2f80ed;\n    border-radius:6px;\n  ";
  aviso.innerHTML = "\n    <b>\uD83D\uDD01 Retorno cargado autom\xE1ticamente por sistema</b><br>\n    Revis\xE1 horas y toc\xE1 <b>Guardar Viaje</b>.\n  ";
  const form = document.querySelector("#travelScreen .card");
  const avisoAnterior = form.querySelector(".aviso-retorno");
  if (avisoAnterior) avisoAnterior.remove();
  aviso.classList.add("aviso-retorno");
  form.prepend(aviso);
}
// =====================================================
// GUARDAR VIAJE → CORE (JORNADA AUTOMÁTICA)
// =====================================================
// =====================================================
// GUARDAR VIAJE → CORE (JORNADA AUTOMÁTICA)
// =====================================================
function addTravelUI(event) {
  event.preventDefault();
  let order = getActiveOrder();
  if (!order) {
    order = createOrder();
  }
  const origen = document.getElementById("originTravels").value.trim();

  // ── FIX: usar destino real guardado al seleccionar sugerencia ──
  const destinoInput = document.getElementById("destinationTravels").value.trim();
  const destino = window._destinoReal || destinoInput;

  // ── FIX: usar km guardado al seleccionar sugerencia ──
  const kmSeleccionado = window._kmSeleccionado || null;
  if (!servicioSeleccionado) {
    // Intentar leer del select directamente
    const selectServ = document.getElementById("numeroServicio");
    if (selectServ && selectServ.value) {
      servicioSeleccionado = { tipo: selectServ.value, turno: selectServ.value };
    } else {
      alert("Seleccioná un servicio válido");
      return;
    }
  }
  if (!origen || !destino) {
    alert("Completá origen y destino");
    return;
  }
  const departureTime = document.getElementById("departureTimeTravels").value;
  if (!departureTime) {
    alert("Ingresá hora de salida");
    return;
  }
  const duracionEstimadaHoras = 2;
  const [h, m] = departureTime.split(":").map(Number);
  const salidaDate = new Date();
  salidaDate.setHours(h, m, 0, 0);
  const llegadaDate = new Date(salidaDate.getTime() + duracionEstimadaHoras * 60 * 60 * 1000);
  const arrivalTime = llegadaDate.toTimeString().substring(0, 5);
  const ahora = new Date();
  let ok;

  // Leer número de coche del formulario
  const cocheInput = document.getElementById("numeroCoche");
  const numeroCoche = cocheInput ? cocheInput.value.trim() || null : null;
  cortarGuardiaAntesDeViaje(order, departureTime);
  if (salidaDate > ahora) {
    ok = addTravelProgramado(origen, destino, servicioSeleccionado.turno, departureTime, arrivalTime, duracionEstimadaHoras, servicioSeleccionado.turno, false, numeroCoche);
  } else {
    ok = addTravel(origen, destino, servicioSeleccionado.turno, departureTime, arrivalTime, duracionEstimadaHoras, servicioSeleccionado.turno, false, numeroCoche);
  }
  if (!ok) {
    alert("No se pudo programar el viaje");
    return;
  }

  // ── FIX: si había km seleccionado, corregirlo en el viaje recién guardado ──
  if (kmSeleccionado) {
    const activeOrder = getActiveOrder();
    if (activeOrder && activeOrder.travels) {
      const ultimoViaje = activeOrder.travels[activeOrder.travels.length - 1];
      if (ultimoViaje) {
        ultimoViaje.kmEmpresa = kmSeleccionado;
        ultimoViaje.kmAuto = kmSeleccionado;
        saveOrders(getOrders().map(o => o.orderNumber === activeOrder.orderNumber ? activeOrder : o));
        setActiveOrder(activeOrder);
      }
    }
  }

  // limpiar estado de selección
  window._destinoReal = null;
  window._kmSeleccionado = null;
  window._destinoSeleccionado = false;
  // Iniciar monitoreo GPS terminal
  if (typeof onViajeIniciado === 'function') onViajeIniciado();
  renderResumenDia();
  renderListaViajes();
  showScreen("mainScreen");
  alert("Viaje cargado correctamente\nSalida: " + departureTime);
}
// =====================================================
// DETALLE DE JORNADA ACTIVA
// Muestra resumen + viajes del dia activo
// =====================================================
function renderDetalleJornadaActiva() {
  const container = document.getElementById("cardsViajesContainer");
  if (!container) return;
  const order = getActiveOrder();
  if (!order) {
    container.innerHTML = "<div>Sin jornada activa</div>";
    return;
  }
  container.innerHTML = "";

  // Resumen
  renderResumenDia();

  // Ordenar viajes por hora programada
  const travels = (order.travels || []).sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));

  // Render cada viaje
  travels.forEach(v => {
    var _ref2, _v$kmAuto2;
    const km = (_ref2 = (_v$kmAuto2 = v.kmAuto) !== null && _v$kmAuto2 !== void 0 ? _v$kmAuto2 : v.kmEmpresa) !== null && _ref2 !== void 0 ? _ref2 : 0;
    const estado = v.status || "finalizado";
    const item = document.createElement("div");
    item.className = "travel-card ".concat(estado);

    // 🔧 CAMBIO: abrir detalle del registro
    item.onclick = () => renderDetalleRegistro(v);

    // ESTADO
    let estadoTexto = "⚫ FINALIZADO";
    if (estado === "programado") estadoTexto = "🟡 PROGRAMADO";
    if (estado === "en_curso") estadoTexto = "🟢 EN CURSO";

    // SERVICIO
    const tipoServicio = v.tipoServicio || v.turno || "—";
    const acopladoTexto = v.acopladoKm > 0 || v.acoplado ? "SI" : "NO";

    // HORARIOS
    const horaSalida = v.departureTime || "--:--";
    const horaLlegada = v.arrivalTime || "--:--";

    // DURACION REAL
    const duracionRealHTML = v.durationRealMin ? "<div>\u231B Duraci\xF3n real: ".concat(v.durationRealMin, " min</div>") : "";
    item.innerHTML = "\n      <div class=\"travel-status ".concat(estado, "\">\n        ").concat(estadoTexto, "\n      </div>\n\n      <div>\uD83D\uDE8D ").concat(v.origen, " \u2192 ").concat(v.destino, "</div>\n      <div>\uD83D\uDD52 ").concat(horaSalida, " \u2014 ").concat(horaLlegada, "</div>\n      <div>\uD83D\uDEA6 Servicio: <b>").concat(tipoServicio, "</b></div>\n      <div>\uD83D\uDD17 Acoplado: <b>").concat(acopladoTexto, "</b></div>\n      ").concat(duracionRealHTML, "\n      <div>\uD83D\uDCCF ").concat(km, " km</div>\n    ");
    item.onclick = () => {
      renderDetalleRegistro(v);
    };
    container.appendChild(item);
  });
}

// =====================================================
// ABRIR PANTALLA NUEVO VIAJE
// =====================================================
function abrirViajeSimple() {
  const travelEnCurso = getTravelEnCurso();
  if (travelEnCurso) {
    alert("Hay un viaje en curso.\n\n" + travelEnCurso.origen + " → " + travelEnCurso.destino + "\nSalida: " + travelEnCurso.departureTime + "\n\nEl nuevo viaje se cargará como PROGRAMADO.");
  }
  const driver = getDriver();
  const base = driver?.base || "Montevideo";

  // Cargar opciones del select de origen
  const sel = document.getElementById("originTravels");
  if (sel) {
    if (typeof cargarSelectorOrigen === 'function') {
      cargarSelectorOrigen(base);
    } else {
      // Fallback — cargar opciones manualmente
      const BASES = ['Montevideo','Punta del Este','Piriápolis','Punta Colorada','Punta Negra','Rocha','Colonia','Chuy','La Pedrera','La Paloma','Aguas Dulces','Otro'];
      sel.innerHTML = BASES.map(b => `<option value="${b}" ${b === base ? 'selected' : ''}>${b}</option>`).join('');
    }
  }

  showScreen("travelScreen");
}
// =====================================================
// ACTUALIZAR INFO SERVICIO (UI)
// =====================================================

let servicioSeleccionado = null;
function actualizarInfoServicio() {
  const select = document.getElementById("numeroServicio");
  const valor = select.value;
  if (!valor) {
    servicioSeleccionado = null;
    return;
  }

  // Estructura estándar del servicio
  servicioSeleccionado = {
    tipo: valor,
    turno: valor
  };
  console.log("Servicio seleccionado:", servicioSeleccionado);
}
// =====================================================
// TARJETAS DE VIAJES POR DÍA (VERSIÓN FINAL CORREGIDA)
// =====================================================
function renderTarjetasPorDia() {
  const container = document.getElementById("cardsViajesContainer");
  if (!container) return;
  container.innerHTML = "";
  const orders = getOrders();
  if (!orders || orders.length === 0) return;
  const viajesPorDia = {};
  orders.forEach(order => {
    const fecha = order.date;
    if (!viajesPorDia[fecha]) {
      viajesPorDia[fecha] = [];
    }
    order.travels.forEach(travel => {
      viajesPorDia[fecha].push(travel);
    });
  });
  const fechas = Object.keys(viajesPorDia).sort((a, b) => new Date(b) - new Date(a));
  fechas.forEach(fecha => {
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #ddd; padding:12px; margin-bottom:10px; border-radius:10px;";
    card.innerHTML = "<b>\uD83D\uDCC5 ".concat(fecha, "</b><br><br>");
    viajesPorDia[fecha].forEach(t => {
      var _ref3, _t$kmAuto;
      const km = Number((_ref3 = (_t$kmAuto = t.kmAuto) !== null && _t$kmAuto !== void 0 ? _t$kmAuto : t.kmEmpresa) !== null && _ref3 !== void 0 ? _ref3 : 0);
      card.innerHTML += "\n        \uD83D\uDE8C ".concat(t.origen, " \u2192 ").concat(t.destino, "<br>\n        \uD83D\uDD52 ").concat(t.departureTime, " - ").concat(t.arrivalTime, "<br>\n        \uD83D\uDCCF ").concat(km, " km<br><br>\n      ");
    });
    container.appendChild(card);
  });
}
// =====================================================
// VIAJE EN CURSO UI (VERSIÓN COMPLETA PROFESIONAL)
// =====================================================

function mostrarViajeEnCursoUI() {
  const container = document.getElementById("viajeEnCursoContainer");
  if (!container) return;

  // SIEMPRE limpiar
  container.innerHTML = "";
  const order = getActiveOrder();
  if (!order || !order.travels || order.travels.length === 0) {
    return;
  }

  // Buscar en curso o programado
  const travelEnCurso = order.travels.find(t => t.status === "en_curso");
  const travelProgramado = order.travels.find(t => t.status === "programado");
  if (!travelEnCurso && !travelProgramado) {
    return;
  }
  const travel = travelEnCurso || travelProgramado;
  const esProgramado = travel.status === "programado";
  const card = document.createElement("div");
  card.style.cssText = "\n    background:".concat(esProgramado ? "#fff3cd" : "#e8f5e9", ";\n    border:1px solid ").concat(esProgramado ? "#ffc107" : "#4caf50", ";\n    border-radius:12px;\n    padding:12px;\n    margin-bottom:12px;\n  ");

  // ============================
  // TIEMPO
  // ============================

  let tiempoHTML = "";
  let estadoDuracionHTML = "";
  if (!esProgramado) {
    const diffMs = ahoraSistema() - travel.inicioReal;
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    const horas = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    // 🔹 duración estimada
    let duracionEstimadaMin = obtenerDuracionPromedio(travel.origen, travel.destino);
    if (!duracionEstimadaMin) {
      let velocidad = 60;

      // 🔥 usar velocidad real si existe
      const stats = getTravelStats();
      const key = travel.origen + "→" + travel.destino;
      if (stats[key] && stats[key].velocidadPromedio > 0) {
        velocidad = stats[key].velocidadPromedio;
      }
      duracionEstimadaMin = Math.floor((travel.kmEmpresa || 0) / velocidad * 60);
    }

    // 🔹 calcular llegada estimada
    let horaLlegada = "";
    if (duracionEstimadaMin > 0) {
      const llegadaEstimadaMs = travel.inicioReal + duracionEstimadaMin * 60000;
      const fechaLlegada = new Date(llegadaEstimadaMs);
      horaLlegada = fechaLlegada.getHours().toString().padStart(2, '0') + ":" + fechaLlegada.getMinutes().toString().padStart(2, '0');
      const excedidoMin = diffMin - duracionEstimadaMin;
      if (excedidoMin > 0) {
        estadoDuracionHTML = "\n          <div style=\"\n            margin-top:8px;\n            padding:6px;\n            background:#fff3cd;\n            border-radius:6px;\n            font-size:13px;\n          \">\n            \uD83D\uDFE1 Excedido: ".concat(excedidoMin, " min\n          </div>\n        ");
      } else {
        estadoDuracionHTML = "\n          <div style=\"\n            margin-top:8px;\n            padding:6px;\n            background:#e8f5e9;\n            border-radius:6px;\n            font-size:13px;\n          \">\n            \uD83D\uDFE2 Dentro del tiempo estimado\n          </div>\n        ";
      }
    }

    // 🔹 UI tiempo
    tiempoHTML = "\n      \uD83D\uDD52 Salida: ".concat(travel.departureTime, "<br>\n      \u23F1 Transcurrido: ").concat(horas, "h ").concat(mins, "m<br>\n      \uD83D\uDD52 Llegada estimada: ").concat(horaLlegada, "\n    ");
  } else {
    tiempoHTML = "\n      \uD83D\uDD52 Inicio programado: ".concat(travel.departureTime, "\n    ");
  }

  // ============================
  // BOTONES
  // ============================

  let botonesHTML = "\n    <button\n      class=\"viaje-btn viaje-btn-cancelar\"\n      onclick=\"cancelarViajeUI()\">\n      Cancelar viaje\n    </button>\n  ";
  if (!esProgramado) {
    botonesHTML = "\n      <button\n        class=\"viaje-btn viaje-btn-finalizar\"\n        onclick=\"finalizarViajeUI()\">\n        Finalizar viaje\n      </button>\n      " + botonesHTML;
  }

  // ============================
  // RENDER
  // ============================

  card.innerHTML = "";
  card.innerHTML += "<b>" + (esProgramado ? "Viaje programado" : "Viaje en curso") + "</b><br><br>";
  card.innerHTML += "Origen: " + travel.origen + " → " + travel.destino + "<br>";
  card.innerHTML += tiempoHTML;
  card.innerHTML += estadoDuracionHTML;
  card.innerHTML += '<div style="margin-top:10px">' + botonesHTML + '</div>';
  container.appendChild(card);
}

// =====================================================
// FINALIZAR VIAJE DESDE UI (CON CÁLCULO REAL)
// FIX PROFESIONAL — SOPORTA CRUCE DE MEDIANOCHE
// =====================================================

function finalizarViajeUI() {
  var _renderResumenDia, _renderBotonCerrarJor;
  const travel = getTravelEnCurso();
  if (!travel) {
    alert("No hay viaje activo");
    return;
  }

  // Guardar datos antes de finalizar
  const genRetorno = document.getElementById('idaYVueltaAuto')?.checked || false;
  const datosViaje = {
    origen:              travel.origen,
    destino:             travel.destino,
    coche:               travel.coche || '',
    servicio:            travel.tipoServicio || travel.turno || '',
    horaSalida:          '',
    horaLlegadaEstimada: ''
  };

  // Finalizar viaje
  const finalizado = finalizarViajeActual();
  if (!finalizado) {
    alert("Error al finalizar viaje");
    return;
  }
// Detener monitoreo GPS terminal
  if (typeof onViajeFinalizado === 'function') onViajeFinalizado();
  
  mostrarViajeEnCursoUI();

  (_renderResumenDia = renderResumenDia) === null || _renderResumenDia === void 0 || _renderResumenDia();
  (_renderBotonCerrarJor = renderBotonCerrarJornada) === null || _renderBotonCerrarJor === void 0 || _renderBotonCerrarJor();

  // Si tenía marcado retorno automático
  if (genRetorno && datosViaje.destino) {
    cargarViajeRetornoAutomatico(datosViaje);
  }

  alert("Viaje finalizado correctamente");
}

// =====================================================
// CANCELAR VIAJE DESDE UI (CON CÁLCULO REAL)
// =====================================================
function cancelarViajeUI() {
  const order = getActiveOrder();
  if (!order || !order.travels) {
    alert("No hay viaje activo");
    return;
  }
  const travel = order.travels.find(t => t.status === "en_curso" || t.status === "programado");
  if (!travel) {
    alert("No hay viaje para cancelar");
    return;
  }
  cancelarViajePorId(travel.id);
  alert("Viaje cancelado correctamente");
  mostrarViajeEnCursoUI();
  renderListaViajes();
  renderResumenDia();
}
function renderDetalleJornadaPorNumero(orderNumber) {
  console.log("Entrando a renderDetalleJornadaPorNumero:", orderNumber);
  const order = getOrders().find(o => o.orderNumber === orderNumber);
  if (!order) return;
  const container = document.getElementById("detalleOrdenContainer");
  if (!container) return;
  container.innerHTML = "";

  // Resumen de la orden
  const totales = calculateOrderTotals(order);
  const resumenEl = document.createElement("div");
  resumenEl.className = "order-summary";
  resumenEl.innerHTML = "\n    <b>Fecha:</b> ".concat(order.date, "<br>\n    <b>Base:</b> ").concat(order.baseInicio, "<br>\n    <b>KM:</b> ").concat(totales.kmTotal.toFixed(1), " km<br>\n    <b>Vi\xE1ticos:</b> ").concat(totales.viaticos, "<br>\n    <b>Total:</b> $ ").concat(Math.round(totales.monto), "\n  ");
  container.appendChild(resumenEl);

  // Viajes de la orden
  const travels = (order.travels || []).slice().sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));
  travels.forEach(v => {
    var _ref4, _v$kmAuto3;
    const km = (_ref4 = (_v$kmAuto3 = v.kmAuto) !== null && _v$kmAuto3 !== void 0 ? _v$kmAuto3 : v.kmEmpresa) !== null && _ref4 !== void 0 ? _ref4 : 0;
    const estado = v.status || "finalizado";
    let estadoTexto = "⚫ FINALIZADO";
    if (estado === "programado") estadoTexto = "🟡 PROGRAMADO";
    if (estado === "en_curso") estadoTexto = "🟢 EN CURSO";
    const tipoServicio = v.tipoServicio || v.turno || "—";
    const acopladoTexto = v.acopladoKm > 0 || v.acoplado ? "SI" : "NO";
    const item = document.createElement("div");
    item.className = "travel-card ".concat(estado);
    item.innerHTML = "\n      <div class=\"travel-status ".concat(estado, "\">").concat(estadoTexto, "</div>\n      <div>\uD83D\uDE8D <b>").concat(v.origen, "</b> \u2192 <b>").concat(v.destino, "</b></div>\n      <div>\uD83D\uDEA6 Servicio: <b>").concat(tipoServicio, "</b></div>\n      <div>\uD83D\uDD17 Acoplado: <b>").concat(acopladoTexto, "</b></div>\n      <div>\uD83D\uDD52 Salida: <b>").concat(v.departureTime, "</b></div>\n      <div>\uD83D\uDD52 Llegada: <b>").concat(v.llegadaReal ? new Date(v.llegadaReal).toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }) : v.arrivalTime || "--:--", "</b></div>\n      <div>\uD83D\uDCCF KM generados: <b>").concat(km, "</b></div>\n    ");
    container.appendChild(item);
  });
}
function activarViajesProgramados() {
  console.log("🧭 UI solicita verificación de viajes programados");
  verificarViajesProgramados();
}

// =====================================================
// EXPORTAR JORNADA (JSON PARA PRUEBAS)
// =====================================================
// ===============================
// HELPERS
// ===============================

function redondear(n) {
  return Math.round((n || 0) * 10) / 10;
}
function calcularKmPorTipo(viajes) {
  const resultado = {
    directo: 0,
    semi_directo: 0,
    expreso: 0,
    turno: 0,
    vacio: 0
  };
  viajes.forEach(v => {
    var _ref5, _v$kmEmpresa;
    if (v.status === "cancelado") return;
    const km = (_ref5 = (_v$kmEmpresa = v.kmEmpresa) !== null && _v$kmEmpresa !== void 0 ? _v$kmEmpresa : v.kmAuto) !== null && _ref5 !== void 0 ? _ref5 : 0;
    const tipo = (v.tipoServicio || "").toLowerCase();
    if (tipo.includes("directo") && !tipo.includes("semi")) {
      resultado.directo += km;
    } else if (tipo.includes("semi")) {
      resultado.semi_directo += km;
    } else if (tipo.includes("expreso")) {
      resultado.expreso += km;
    } else if (tipo.includes("turno")) {
      resultado.turno += km;
    } else if (tipo.includes("vacio")) {
      resultado.vacio += km;
    }
  });
  return resultado;
}
function calcularKmPorCategoria(viajes) {
  let kmPasajero = 0;
  let kmVacio = 0;
  viajes.forEach(v => {
    var _ref6, _v$kmEmpresa2;
    if (v.status === "cancelado") return;
    const km = (_ref6 = (_v$kmEmpresa2 = v.kmEmpresa) !== null && _v$kmEmpresa2 !== void 0 ? _v$kmEmpresa2 : v.kmAuto) !== null && _ref6 !== void 0 ? _ref6 : 0;
    if ((v.tipoServicio || "").toLowerCase().includes("vacio")) {
      kmVacio += km;
    } else {
      kmPasajero += km;
    }
  });
  return {
    pasajero: kmPasajero,
    vacio: kmVacio
  };
}
function calcularGuardiasDetalle(guardias) {
  let comun = 0;
  let especial = 0;
  let horasComun = 0;
  let horasEspecial = 0;
  guardias.forEach(g => {
    const horas = g.hours || 0;
    if (g.type === "especial") {
      especial += horas * 40;
      horasEspecial += horas;
    } else {
      comun += horas * 30;
      horasComun += horas;
    }
  });
  return {
    km: {
      comun,
      especial
    },
    horas: {
      comun: horasComun,
      especial: horasEspecial
    }
  };
}
function calcularAcoplados(viajes) {
  let km = 0;
  let cantidad = 0;
  viajes.forEach(v => {
    if (v.acopladoKm) {
      km += v.acopladoKm;
      cantidad++;
    }
  });
  return {
    km,
    cantidad
  };
}
// ===============================
// EXPORTAR JORNADA
// ===============================

async function exportarJornada(order) {
  var _getDriver, _window$Capacitor, _window$Capacitor$isN;
  const driver = ((_getDriver = getDriver) === null || _getDriver === void 0 ? void 0 : _getDriver()) || {};
  const totals = calculateOrderTotals(order);
  const kmPorTipo = calcularKmPorTipo(order.travels || []);
  const kmPorCategoria = calcularKmPorCategoria(order.travels || []);
  const guardiasDetalle = calcularGuardiasDetalle(order.guards || []);
  const acopladosDetalle = calcularAcoplados(order.travels || []);
  const data = {
    version_app: "0.9 piloto",
    syncStatus: order.syncStatus || "local",
    exportadoAt: new Date().toISOString(),
    chofer: {
      legajo: driver.legajo || "—",
      nombre: driver.nombre || "—",
      base: driver.base || "Montevideo",
      tipo: driver.tipo || "—"
    },
    jornada: {
      orderNumber: order.orderNumber,
      fecha: order.date,
      estado: order.status || "activa",
      creadaAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
      cerradaAt: order.closedAt ? new Date(order.closedAt).toISOString() : null
    },
    viajes: (order.travels || []).map(v => ({
      id: v.id,
      estado: v.status,
      origen: v.origen,
      destino: v.destino,
      tipoServicio: v.tipoServicio || v.turno,
      salida: v.departureTime,
      llegada: v.arrivalTime || "--:--",
      kmEmpresa: v.kmEmpresa || 0,
      acoplado: v.acopladoKm > 0 || v.acoplado,
      acopladoKm: v.acopladoKm || 0,
      tomeCese: v.tomeCese || false,
      coche: v.coche || null,
      duracionMinutos: v.duracionMinutos || null,
      syncStatus: v.syncStatus || "local"
    })),
    guardias: (order.guards || []).map(g => ({
      tipo: g.type,
      inicio: g.inicio,
      fin: g.fin,
      horas: g.hours || 0,
      kmGenerados: (g.hours || 0) * (g.type === "especial" ? GUARDIA_ESPECIAL_KM_HORA : GUARDIA_COMUN_KM_HORA)
    })),
    resumen: {
      kmTotal: redondear(totals.kmTotal),
      kmViajes: redondear(totals.kmViajes),
      kmGuardias: redondear(totals.kmGuardias),
      kmAcoplados: redondear(totals.kmAcoplados),
      kmTomeCese: redondear(totals.kmTomeCese),
      kmPorTipo: kmPorTipo,
      kmPorCategoria: kmPorCategoria,
      guardias: guardiasDetalle,
      acoplados: acopladosDetalle,
      viaticos: totals.viaticos,
      montoKm: Math.round(totals.kmTotal * LAUDO_KM),
      montoViaticos: totals.viaticos * MONTO_VIATICO,
      montoTotal: Math.round(totals.monto)
    }
  };
  const json = JSON.stringify(data, null, 2);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const fecha = order.date || new Date().toISOString().split("T")[0];
  const basename = "jornada_".concat(fecha, "_").concat(order.orderNumber, "_").concat(hh).concat(mm);
  const isNative = (_window$Capacitor = window.Capacitor) === null || _window$Capacitor === void 0 || (_window$Capacitor$isN = _window$Capacitor.isNativePlatform) === null || _window$Capacitor$isN === void 0 ? void 0 : _window$Capacitor$isN.call(_window$Capacitor);
  console.log('[exportar] isNative:', isNative);
  if (isNative) {
    try {
      const Filesystem = window.Capacitor.Plugins.Filesystem;
      const Share = window.Capacitor.Plugins.Share;
      console.log('[exportar] Filesystem:', !!Filesystem, '| Share:', !!Share);
      const Directory = { Cache: 'CACHE' };

      // PDF → base64
      const pdfBase64 = await generarPDFJornada(order, {
        returnBase64: true
      });
      console.log('[exportar] pdfBase64 length:', pdfBase64?.length || 0);
      if (pdfBase64) {
        const pdfResult = await Filesystem.writeFile({
          path: basename + ".pdf",
          data: pdfBase64,
          directory: Directory.Cache,
          recursive: true
        });
        console.log('[exportar] pdfResult.uri:', pdfResult?.uri);
        console.log('[exportar] llamando Share.share...');
        await Share.share({
          title: "Jornada ".concat(order.date),
          text: "Resumen jornada ".concat(order.orderNumber),
          files: [pdfResult.uri],
          dialogTitle: "Compartir jornada"
        });
        console.log('[exportar] Share.share completó');
      } else {
        console.warn('[exportar] pdfBase64 es falsy, se saltea PDF');
      }

      // JSON
      const jsonB64 = btoa(unescape(encodeURIComponent(json)));
      const jsonResult = await Filesystem.writeFile({
        path: basename + ".json",
        data: jsonB64,
        directory: Directory.Cache,
        recursive: true
      });
      console.log('[exportar] JSON guardado:', jsonResult?.uri);
    } catch (e) {
      console.error('[exportar] ERROR:', e?.message, e);
      alert("Error al exportar: " + (e?.message || String(e)));
    }
  } else {
    // Fallback navegador: descarga JSON
    // const blob = new Blob([json], { type: "application/json" });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement("a");
    // a.href = url;
    // a.download = basename + ".json";
    // a.click();
    // URL.revokeObjectURL(url);

    // PDF via doc.save
    try {
      if (typeof generarPDFJornada === "function") {
        generarPDFJornada(order);
      }
    } catch (e) {
      console.warn("Error generando PDF", e);
    }
  }
}
// export global
window.abrirViajeSimple = abrirViajeSimple;
window.renderResumenDia = renderResumenDia;
window.addTravelUI = addTravelUI;
window.cargarViajeRetornoAutomatico = cargarViajeRetornoAutomatico;
window.createOrderUI = createOrderUI;
window.closeActiveOrderUI = closeActiveOrderUI;
window.actualizarInfoServicio = actualizarInfoServicio;
window.renderTarjetasPorDia = renderTarjetasPorDia;
window.mostrarViajeEnCursoUI = mostrarViajeEnCursoUI;
window.cancelarViajeUI = cancelarViajeUI;
window.activarViajesProgramados = activarViajesProgramados;
window.finalizarViajeUI = finalizarViajeUI;
window.renderDetalleJornadaPorNumero = renderDetalleJornadaPorNumero;

// =====================================================
// HISTORIAL
// =====================================================

function abrirHistorial() {
  const orders = getOrders();

  // Extraer meses únicos de las órdenes, ordenados descendente
  const meses = [...new Set(orders.map(o => (o.date || "").substring(0, 7)))].filter(Boolean).sort((a, b) => b.localeCompare(a));
  const selectMes = document.getElementById("filtroMes");
  selectMes.innerHTML = "";
  const mesActual = new Date().toISOString().substring(0, 7);
  meses.forEach(m => {
    const [yyyy, mm] = m.split("-");
    const fecha = new Date(Number(yyyy), Number(mm) - 1, 1);
    const label = fecha.toLocaleString("es-UY", {
      month: "long",
      year: "numeric"
    });
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = label;
    if (m === mesActual) opt.selected = true;
    selectMes.appendChild(opt);
  });
  actualizarFiltroDia();
  showScreen("historialScreen");
  renderHistorial();
}
function actualizarFiltroDia() {
  const selectMes = document.getElementById("filtroMes");
  const selectDia = document.getElementById("filtroDia");
  const mes = selectMes.value;
  const orders = getOrders();
  const dias = [...new Set(orders.filter(o => (o.date || "").startsWith(mes)).map(o => o.date))].filter(Boolean).sort((a, b) => b.localeCompare(a));

  // mantener selección actual si sigue siendo válida
  const diaActual = selectDia.value;
  selectDia.innerHTML = "<option value=\"\">Todos los d\xEDas</option>";
  dias.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    if (d === diaActual) opt.selected = true;
    selectDia.appendChild(opt);
  });
}
function renderHistorial() {
  actualizarFiltroDia();
  const mes = document.getElementById("filtroMes").value;
  const dia = document.getElementById("filtroDia").value;
  const container = document.getElementById("historialContainer");
  if (!container) return;
  container.innerHTML = "";
  const orders = getOrders().filter(o => {
    if (!o.date) return false;
    if (dia) return o.date === dia;
    return o.date.startsWith(mes);
  });
  if (orders.length === 0) {
    container.innerHTML = "<div style=\"text-align:center; color:#888; padding:24px;\">Sin jornadas para este per\xEDodo</div>";
    return;
  }
  orders.sort((a, b) => b.date.localeCompare(a.date));

  // ── Resumen del período ──
  let kmTotal = 0,
    montoTotal = 0,
    viaticosTotal = 0;
  orders.forEach(o => {
    const t = calculateOrderTotals(o);
    kmTotal += t.kmTotal;
    montoTotal += t.monto;
    viaticosTotal += t.viaticos;
  });
  const resumen = document.createElement("div");
  resumen.style.cssText = "\n    background:#1a1a2e; color:white; border-radius:12px;\n    padding:14px 16px; margin-bottom:16px; font-size:14px; line-height:1.8;\n  ";
  resumen.innerHTML = "\n    <div style=\"font-weight:bold; font-size:15px; margin-bottom:6px;\">\n      \uD83D\uDCCA ".concat(dia ? "Resumen del día " + dia : "Resumen del período", "\n    </div>\n    \uD83D\uDEE3 KM: <b>").concat(kmTotal.toFixed(1), " km</b><br>\n    \uD83D\uDCB0 Monto: <b>$ ").concat(Math.round(montoTotal), "</b><br>\n    \uD83C\uDF7D Vi\xE1ticos: <b>").concat(viaticosTotal, "</b><br>\n    \uD83D\uDCC5 Jornadas: <b>").concat(orders.length, "</b>\n  ");
  container.appendChild(resumen);

  // ── Tarjetas por jornada ──
  orders.forEach(order => {
    const resumenDestinos = {};
    (order.travels || []).filter(t => t.status !== "cancelado").forEach(t => {
      const destino = t.destino || "Sin destino";
      if (!resumenDestinos[destino]) {
        resumenDestinos[destino] = 0;
      }
      resumenDestinos[destino]++;
    });
    const textoDestinos = Object.entries(resumenDestinos).map(_ref7 => {
      let [dest, cant] = _ref7;
      return "".concat(cant, " ").concat(dest);
    }).join(" · ");
    const totales = calculateOrderTotals(order);

    // ✅ CORRECTO: dentro del scope de order
    const tieneTomeCese = (order.travels || []).some(t => t.status !== "cancelado" && t.tomeCese);
    const cantidadViajes = (order.travels || []).filter(t => t.status !== "cancelado").length;
    const cantidadGuardias = (order.guards || []).length;

    // ✅ resumen tipos
    const resumenTipos = {};
    (order.travels || []).filter(t => t.status !== "cancelado").forEach(t => {
      const tipo = (t.tipoServicio || "comun").toLowerCase();
      if (!resumenTipos[tipo]) resumenTipos[tipo] = 0;
      resumenTipos[tipo]++;
    });
    const textoTipos = Object.entries(resumenTipos).map(_ref8 => {
      let [tipo, cant] = _ref8;
      const nombre = tipo.charAt(0).toUpperCase() + tipo.slice(1);
      return "".concat(cant, " ").concat(nombre);
    }).join(" · ");
    const card = document.createElement("div");
    card.style.cssText = "\n      border:1px solid #ddd; border-radius:10px;\n      padding:12px; margin-bottom:10px; cursor:pointer;\n    ";
    const travels = (order.travels || []).filter(t => t.status !== "cancelado").sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));
    let viajesHTML = travels.map(v => {
      var _ref9, _v$kmAuto4;
      return "<div style=\"font-size:13px; color:#444; margin-top:4px;\">\n        \uD83D\uDE8D ".concat(v.origen, " \u2192 ").concat(v.destino, "\n        &nbsp;\xB7&nbsp; ").concat(v.departureTime || "--", " - ").concat(v.arrivalTime || "--", "\n        &nbsp;\xB7&nbsp; ").concat((_ref9 = (_v$kmAuto4 = v.kmAuto) !== null && _v$kmAuto4 !== void 0 ? _v$kmAuto4 : v.kmEmpresa) !== null && _ref9 !== void 0 ? _ref9 : 0, " km\n        ").concat(v.coche ? "&nbsp;\xB7&nbsp; \uD83D\uDE8C Coche: ".concat(v.coche) : "", "\n      </div>");
    }).join("");

    // Detalle de guardias
    let guardiasHTML = "";
    (order.guards || []).forEach(g => {
      const kmHora = g.type === "especial" ? 40 : 30;
      let horas = g.hours || 0;
      let km = g.kmGuardia || 0;
      if (g.inicio && g.fin) {
        const [hI, mI] = g.inicio.split(":").map(Number);
        const [hF, mF] = g.fin.split(":").map(Number);
        let calc = hF + mF / 60 - (hI + mI / 60);
        if (calc < 0) calc += 24;
        if (calc > 0) {
          horas = calc;
          km = horas * kmHora;
        }
      }
      const cortada = g.cortadaAuto ? " ✂️" : "";
      const viatico = g.viatico ? " ✅ Viático" : "";
      const tipo = g.type === "especial" ? "Especial (40km/h)" : "Común (30km/h)";
      guardiasHTML += "\n        <div style=\"font-size:12px;color:#555;margin-top:4px;padding:4px 8px;background:#f5f5f5;border-radius:6px;\">\n          \uD83D\uDD50 ".concat(g.inicio || "--", " \u2192 ").concat(g.fin || "--", "\n          &nbsp;\xB7&nbsp; ").concat(horas.toFixed(2), "h\n          &nbsp;\xB7&nbsp; ").concat(km.toFixed(1), " km\n          &nbsp;\xB7&nbsp; ").concat(tipo).concat(cortada).concat(viatico, "\n          ").concat(g.descripcion ? "<br>\uD83D\uDCDD ".concat(g.descripcion) : "", "\n        </div>");
    });
    card.innerHTML = "\n      <div style=\"font-weight:bold; margin-bottom:6px;\">\uD83D\uDCC5 ".concat(order.date, "</div>\n\n      <div style=\"font-size:13px; line-height:1.7;\">\n        \uD83D\uDEE3 KM: <b>").concat(totales.kmTotal.toFixed(1), "</b>\n        &nbsp;\xB7&nbsp; \uD83C\uDF7D Vi\xE1ticos: <b>").concat(totales.viaticos, "</b>\n        &nbsp;\xB7&nbsp; \uD83D\uDFE2 Tome y Cese: <b>").concat(tieneTomeCese ? "Sí" : "No", "</b><br>\n\n        \uD83D\uDCE6 Viajes: <b>").concat(cantidadViajes, "</b>\n        &nbsp;\xB7&nbsp; \u23F1 Guardias: <b>").concat(cantidadGuardias, "</b><br>\n\n        \uD83E\uDDED Servicios: <b>").concat(textoTipos || "—", "</b>\n        \uD83D\uDCCD Destinos: <b>").concat(textoDestinos || "—", "</b><br>\n      </div>\n\n      ").concat(viajesHTML, "\n      ").concat(guardiasHTML, "\n    ");
    card.onclick = () => {
      showScreen("detalleOrdenScreen");
      renderDetalleJornadaPorNumero(order.orderNumber);
    };
    container.appendChild(card);
  });
}
window.abrirHistorial = abrirHistorial;
window.renderHistorial = renderHistorial;
