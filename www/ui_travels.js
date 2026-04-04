

console.log("ui_travels cargado version dentro www");
// ===============================
// JORNADA - UI
// ===============================

function createOrderUI(){
  try {

    const o = createOrder(); // CORE

    document.getElementById("ordenActivaInfo").innerText =
      "🟢 Jornada activa: " + o.orderNumber;

    alert("Jornada iniciada");

  } catch (e) {

    if (e.message === "YA_EXISTE_JORNADA_ACTIVA") {
      alert("Ya existe una jornada activa.");
    } else {
      throw e;
    }

  }
}

function closeActiveOrderUI(){

  const o = closeActiveOrder(); // CORE

  if(!o){
    alert("No hay jornada activa");
    return;
  }

  document.getElementById("ordenActivaInfo").innerText =
    "🔴 Sin jornada activa";
  const ordenFinal = getOrders().find(
  ord => ord.orderNumber === o.orderNumber
);

exportarJornada(ordenFinal);
  alert("Jornada cerrada");
}
// =====================================================
// LISTA DE VIAJES — VERSION FINAL PROFESIONAL COMPLETA
// Compatible 100% con CORE COT DRIVER ENGINE
// Muestra tipo de servicio y acoplado correctamente
// =====================================================

function renderListaViajes(){

  const container =
    document.getElementById("cardsViajesContainer");

  if(!container) return;

  container.innerHTML = "";

  let orders = getOrders();

  if(!orders || orders.length === 0){

    container.innerHTML = `
      <div class="empty-state">
        Sin jornadas registradas
      </div>
    `;

    return;
  }

  // ordenar por fecha descendente
  orders.sort(
    (a,b)=> new Date(b.date) - new Date(a.date)
  );

  const ultimasOrdenes =
    orders.slice(0,6);

  const activeOrder =
    getActiveOrder();

  ultimasOrdenes.forEach(order => {

    const totales =
      calculateOrderTotals(order);

    const card =
      document.createElement("div");

    card.className = "order-card";

    card.onclick = () => {
  showScreen('detalleOrdenScreen');
  renderDetalleJornadaPorNumero(order.orderNumber);
};

    // =========================
    // TITULO
    // =========================

    const titulo =
  
      document.createElement("div");

    titulo.className = "order-title";

    titulo.innerText =
      activeOrder &&
      order.orderNumber === activeOrder.orderNumber
        ? `📅 ${order.date} — Jornada activa`
        : `📅 ${order.date}`;

    card.appendChild(titulo);

    // =========================
    // RESUMEN
    // =========================

    const resumen =
      document.createElement("div");

    resumen.className = "order-summary";

    resumen.innerHTML = `
      Tome y cese: ${totales.kmTomeCese.toFixed(1)} km<br>
      Guardias: ${totales.kmGuardias.toFixed(1)} km<br>
      Acoplados: ${totales.kmAcoplados.toFixed(1)} km<br>
      Viáticos: ${totales.viaticos}<br>
      Total jornada: ${totales.kmTotal.toFixed(1)} km
    `;

    card.appendChild(resumen);

    // =========================
    // VIAJES
    // =========================

    const travels =
      order.travels || [];

    travels.sort(
      (a,b)=>
        (a.departureTime || "")
        .localeCompare(b.departureTime || "")
    );

    travels.forEach(v => {

      const km =
        v.kmAuto ??
        v.kmEmpresa ??
        0;

      const estado =
        v.status || "finalizado";

      const item =
        document.createElement("div");

      item.className =
        `travel-card ${estado}`;

      // =========================
      // ESTADO TEXTO
      // =========================

      let estadoTexto =
        "⚫ FINALIZADO";

      if(estado === "programado")
        estadoTexto = "🟡 PROGRAMADO";

      if(estado === "en_curso")
        estadoTexto = "🟢 EN CURSO";

      // =========================
      // SERVICIO Y ACOPLADO
      // =========================

      const tipoServicio =
        v.tipoServicio ||
        v.turno ||
        "—";

      const acopladoTexto =
        (v.acopladoKm > 0 || v.acoplado) ? "SI" : "NO";

      // =========================
      // TIEMPO TRANSCURRIDO
      // =========================

      let tiempoHTML = "";

      if(
        estado === "en_curso"
        &&
        v.inicioReal
      ){

        const diffMin =
          Math.floor(
            (Date.now() - v.inicioReal)
            / 60000
          );

        const h =
          Math.floor(diffMin / 60);

        const m =
          diffMin % 60;

        tiempoHTML = `<div class="travel-time">⏱ ${h}h ${m}m transcurridos</div>`;
      }
// ============================
// VIAJE FINALIZADO
// ============================

if(
 estado === "finalizado"
 &&
 v.arrivalTime
){

let horaReal = v.arrivalTime;

if(v.llegadaReal){
  const d = new Date(v.llegadaReal);
  horaReal =
    String(d.getHours()).padStart(2,"0") + ":" +
    String(d.getMinutes()).padStart(2,"0");
}
 tiempoHTML = `<div class="travel-time">🏁 Llegada: ${horaReal}</div>`;

}
      // =========================
      // RENDER ITEM
      // =========================
console.log(v);

      item.innerHTML = `

        <div class="travel-status ${estado}">
          ${estadoTexto}
        </div>

        <div>
          🚍 ${v.origen} → ${v.destino}
        </div>

        <div>
          🚦 Servicio: <b>${tipoServicio}</b>
        </div>

        <div>
          🔗 Acoplado: <b>${acopladoTexto}</b>
        </div>

        <div>
          🕒 ${v.departureTime}
          - ${v.arrivalTime || "--:--"}
        </div>

        ${tiempoHTML}

         <div>
          📏 ${km} km
        </div>

        <div>
          🚍 Coche: ${v.coche || "-"}
        </div>
      `;

      card.appendChild(item);

    });

    container.appendChild(card);

  });

}
window.renderListaViajes = renderListaViajes;
// =====================================================
// CARGAR VIAJE DE RETORNO AUTOMÁTICO (CORREGIDO)
// =====================================================

function cargarViajeRetornoAutomatico(data){

  console.log("📡 Recibiendo retorno automático:", data);

  // 🔁 INVERTIMOS origen y destino para retorno
  const origenRetorno = data.destino;
  const destinoRetorno = data.origen;

  // 1) Abrimos pantalla de viaje
  showScreen("travelScreen");

  // 2) Cargamos datos invertidos
  document.getElementById("originTravels").value = origenRetorno;
  document.getElementById("destinationTravels").value = destinoRetorno;

  document.getElementById("departureTimeTravels").value =
    data.horaSalida || "";

  document.getElementById("arrivalTimeTravels").value =
    data.horaLlegadaEstimada || "";

  // 3) Servicio si existe
  if(data.servicio){
    document.getElementById("numeroServicio").value = data.servicio;
    actualizarInfoServicio();
  }

  // 4) Calculamos KM correctamente con ruta invertida
  const km = buscarKmRuta(origenRetorno, destinoRetorno);

  document.getElementById("kmTravels").value = km;

  console.log("🔁 KM retorno calculado:", km);

  // 5) Aviso visual
  const aviso = document.createElement("div");
  aviso.style.cssText = `
    padding:10px;
    margin-bottom:10px;
    background:#e8f3ff;
    border-left:5px solid #2f80ed;
    border-radius:6px;
  `;

  aviso.innerHTML = `
    <b>🔁 Retorno cargado automáticamente por sistema</b><br>
    Revisá horas y tocá <b>Guardar Viaje</b>.
  `;

  const form = document.querySelector("#travelScreen form");

  // Evita duplicar aviso
  const avisoAnterior = form.querySelector(".aviso-retorno");
  if(avisoAnterior) avisoAnterior.remove();

  aviso.classList.add("aviso-retorno");

  form.prepend(aviso);
}
// =====================================================
// GUARDAR VIAJE → CORE (JORNADA AUTOMÁTICA)
// =====================================================
// =====================================================
// GUARDAR VIAJE → CORE (JORNADA AUTOMÁTICA)
// =====================================================
function addTravelUI(event){

  if(event) event.preventDefault();

  let order = getActiveOrder();

  if(!order){
    order = createOrder();
  }

  const origen =
    document.getElementById("originTravels").value.trim();

  const destino =
    document.getElementById("destinationTravels").value.trim();

  if(!servicioSeleccionado){
    alert("Seleccioná un servicio válido");
    return;
  }

  if(!origen || !destino){
    alert("Completá origen y destino");
    return;
  }

  const departureTime =
    document.getElementById("departureTimeTravels").value;

  if(!departureTime){
    alert("Ingresá hora de salida");
    return;
  }

  const duracionEstimadaHoras = 2;

  const [h,m] =
    departureTime.split(":").map(Number);

  const salidaDate = new Date();
  salidaDate.setHours(h,m,0,0);

  const llegadaDate =
    new Date(
      salidaDate.getTime() +
      duracionEstimadaHoras * 60 * 60 * 1000
    );

  const arrivalTime =
    llegadaDate.toTimeString().substring(0,5);

  // =====================================================
  // DECIDIR SI ES VIAJE PROGRAMADO O INMEDIATO
  // =====================================================

  const ahora = new Date();

  let ok;

  if(salidaDate > ahora){

    // VIAJE PROGRAMADO
    ok = addTravelProgramado(
      origen,
      destino,
      servicioSeleccionado.turno,
      departureTime,
      arrivalTime,
      duracionEstimadaHoras
    );

  }else{

    // VIAJE INMEDIATO
    ok = addTravel(
      origen,
      destino,
      servicioSeleccionado.turno,
      departureTime,
      arrivalTime,
      duracionEstimadaHoras
    );

  }

  if(!ok){
    alert("No se pudo programar el viaje");
    return;
  }
  // 🔍 VALIDACIÓN DE CONSISTENCIA
if (!validarConsistenciaOrder(order, { strict: true })) {
  alert("⚠️ Inconsistencia detectada. Revisar datos.");
  return;
}


  renderResumenDia();
  renderListaViajes();
  renderListaGuardias?.();

  showScreen("mainScreen");

  alert(
    "Viaje cargado correctamente\n" +
    "Salida: " + departureTime
  );

}
// =====================================================
// DETALLE DE JORNADA ACTIVA
// Muestra resumen + viajes del dia activo
// =====================================================
function renderDetalleJornadaActiva(){

  const container =
    document.getElementById("cardsViajesContainer");
  if(!container) return;

  const order = getActiveOrder();
  if(!order){
    container.innerHTML = "<div>Sin jornada activa</div>";
    return;
  }

  container.innerHTML = "";

  // Resumen
  renderResumenDia();

  // Ordenar viajes por hora programada
  const travels = (order.travels || []).sort((a,b)=>
    (a.departureTime||"").localeCompare(b.departureTime||"")
  );

  // Render cada viaje
  travels.forEach(v => {

    const km =
      v.kmAuto ?? v.kmEmpresa ?? 0;

    const estado = v.status || "finalizado";
    const item = document.createElement("div");
    item.className = `travel-card ${estado}`;

    // 🔧 CAMBIO: abrir detalle del registro
    item.onclick = () => renderDetalleRegistro(v);

    // ESTADO
    let estadoTexto =
      "⚫ FINALIZADO";
    if(estado==="programado")
      estadoTexto="🟡 PROGRAMADO";
    if(estado==="en_curso")
      estadoTexto="🟢 EN CURSO";

    // SERVICIO
    const tipoServicio =
      v.tipoServicio || v.turno || "—";
    const acopladoTexto =
      (v.acopladoKm > 0 || v.acoplado) ? "SI" : "NO";

    // HORARIOS
    const horaSalida = v.departureTime || "--:--";
    const horaLlegada= v.arrivalTime || "--:--";

    // DURACION REAL
    const duracionRealHTML = v.durationRealMin
      ? `<div>⌛ Duración real: ${v.durationRealMin} min</div>`
      : "";

    item.innerHTML = `
      <div class="travel-status ${estado}">
        ${estadoTexto}
      </div>

      <div>🚍 ${v.origen} → ${v.destino}</div>
      <div>🕒 ${horaSalida} — ${horaLlegada}</div>
      <div>🚦 Servicio: <b>${tipoServicio}</b></div>
      <div>🔗 Acoplado: <b>${acopladoTexto}</b></div>
      ${duracionRealHTML}
      <div>📏 ${km} km</div>
    `;
    item.onclick = () => {
  renderDetalleRegistro(v);
};

    container.appendChild(item);
  });
}

// =====================================================
// ABRIR PANTALLA NUEVO VIAJE
// =====================================================
function abrirViajeSimple(){

  const travelEnCurso = getTravelEnCurso();

  if(travelEnCurso){

    alert(
      "Hay un viaje en curso.\n\n" +
      travelEnCurso.origen + " → " +
      travelEnCurso.destino +
      "\nSalida: " +
      travelEnCurso.departureTime +
      "\n\nEl nuevo viaje se cargará como PROGRAMADO."
    );

  }

  showScreen("travelScreen");
}
// =====================================================
// ACTUALIZAR INFO SERVICIO (UI)
// =====================================================

let servicioSeleccionado = null;

function actualizarInfoServicio(){

  const select = document.getElementById("numeroServicio");
  const valor = select.value;

  if(!valor){
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
function renderTarjetasPorDia(){

  const container = document.getElementById("cardsViajesContainer");

  if(!container) return;

  container.innerHTML = "";

  const orders = getOrders();

  if(!orders || orders.length === 0) return;

  const viajesPorDia = {};

  orders.forEach(order => {

    const fecha = order.date;

    if(!viajesPorDia[fecha]){
      viajesPorDia[fecha] = [];
    }

    order.travels.forEach(travel => {
      viajesPorDia[fecha].push(travel);
    });

  });

  const fechas = Object.keys(viajesPorDia)
    .sort((a,b)=> new Date(b)-new Date(a));

  fechas.forEach(fecha => {

    const card = document.createElement("div");

    card.style.cssText =
      "border:1px solid #ddd; padding:12px; margin-bottom:10px; border-radius:10px;";

    card.innerHTML = `<b>📅 ${fecha}</b><br><br>`;

    viajesPorDia[fecha].forEach(t => {

      const km = Number(
        t.kmAuto ??
        t.kmEmpresa ??
        0
      );

      card.innerHTML += `
        🚌 ${t.origen} → ${t.destino}<br>
        🕒 ${t.departureTime} - ${t.arrivalTime}<br>
        📏 ${km} km<br><br>
      `;

    });

    container.appendChild(card);

  });

}
// =====================================================
// VIAJE EN CURSO UI (VERSIÓN COMPLETA PROFESIONAL)
// =====================================================

function mostrarViajeEnCursoUI(){

  const container =
    document.getElementById("viajeEnCursoContainer");

  if(!container) return;

  // SIEMPRE limpiar
  container.innerHTML = "";

  const order = getActiveOrder();

  if(!order || !order.travels || order.travels.length === 0){
    return;
  }

  // Buscar en curso o programado
  const travelEnCurso =
    order.travels.find(t => t.status === "en_curso");

  const travelProgramado =
    order.travels.find(t => t.status === "programado");

  if(!travelEnCurso && !travelProgramado){
    return;
  }

  const travel = travelEnCurso || travelProgramado;

  const esProgramado =
    travel.status === "programado";

  const card = document.createElement("div");

  card.style.cssText = `
    background:${esProgramado ? "#fff3cd" : "#e8f5e9"};
    border:1px solid ${esProgramado ? "#ffc107" : "#4caf50"};
    border-radius:12px;
    padding:12px;
    margin-bottom:12px;
  `;

  // ============================
  // TIEMPO
  // ============================

  let tiempoHTML = "";
  let estadoDuracionHTML = "";

  if(!esProgramado){

    const diffMs =
      ahoraSistema() - travel.inicioReal;

    const diffMin =
      Math.max(0, Math.floor(diffMs / 60000));

    const horas =
      Math.floor(diffMin / 60);
    const mins =
      diffMin % 60;

    // 🔹 duración estimada
    let duracionEstimadaMin =
      obtenerDuracionPromedio(
        travel.origen,
        travel.destino
      );

    if(!duracionEstimadaMin){

      let velocidad = 60;

// 🔥 usar velocidad real si existe
const stats = getTravelStats();
const key = travel.origen + "→" + travel.destino;

if(stats[key] && stats[key].velocidadPromedio > 0){
  velocidad = stats[key].velocidadPromedio;
}

duracionEstimadaMin =
  Math.floor(
    (travel.kmEmpresa || 0)
    / velocidad * 60
  );
    }

    // 🔹 calcular llegada estimada
    let horaLlegada = "";

    if(duracionEstimadaMin > 0){

      const llegadaEstimadaMs =
        travel.inicioReal + (duracionEstimadaMin * 60000);

      const fechaLlegada =
        new Date(llegadaEstimadaMs);

      horaLlegada =
        fechaLlegada.getHours().toString().padStart(2,'0') + ":" +
        fechaLlegada.getMinutes().toString().padStart(2,'0');

      const excedidoMin =
        diffMin - duracionEstimadaMin;

      if(excedidoMin > 0){

        estadoDuracionHTML = `
          <div style="
            margin-top:8px;
            padding:6px;
            background:#fff3cd;
            border-radius:6px;
            font-size:13px;
          ">
            🟡 Excedido: ${excedidoMin} min
          </div>
        `;

      }else{

        estadoDuracionHTML = `
          <div style="
            margin-top:8px;
            padding:6px;
            background:#e8f5e9;
            border-radius:6px;
            font-size:13px;
          ">
            🟢 Dentro del tiempo estimado
          </div>
        `;
      }
    }

    // 🔹 UI tiempo
    tiempoHTML = `
      🕒 Salida: ${travel.departureTime}<br>
      ⏱ Transcurrido: ${horas}h ${mins}m<br>
      🕒 Llegada estimada: ${horaLlegada}
    `;

  }else{

    tiempoHTML = `
      🕒 Inicio programado: ${travel.departureTime}
    `;
  }

  // ============================
  // BOTONES
  // ============================

  let botonesHTML = `
    <button
      class="viaje-btn viaje-btn-cancelar"
      onclick="cancelarViajeUI()">
      Cancelar viaje
    </button>
  `;

  if(!esProgramado){

    botonesHTML =
      `
      <button
        class="viaje-btn viaje-btn-finalizar"
        onclick="finalizarViajeUI()">
        Finalizar viaje
      </button>
      ` + botonesHTML;
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

function finalizarViajeUI(){

  const travel = getTravelEnCurso();

  if(!travel){
    alert("No hay viaje activo");
    return;
  }

  // Delegar todo el cierre al CORE
  const finalizado = finalizarViajeActual();

  if(!finalizado){
    alert("Error al finalizar viaje");
    return;
  }

  alert("Viaje finalizado correctamente");

  mostrarViajeEnCursoUI();
  renderResumenDia?.();
  renderBotonCerrarJornada?.();
}

// =========================
// AUTO REFRESH LISTA VIAJES
// =========================

if(!window.__travelListTimer){

  window.__travelListTimer =
    setInterval(() => {

      const pantalla =
        document.getElementById("listaViajesScreen");

      if(pantalla &&
         pantalla.classList.contains("active")){
verificarViajesProgramados();
        renderListaViajes();

      }

    }, 30000); // cada 30 segundos

}
  // =====================================================
// CANCELAR VIAJE DESDE UI (CON CÁLCULO REAL)
// =====================================================
 function cancelarViajeUI(){

  const order = getActiveOrder();

  if(!order || !order.travels){
    alert("No hay viaje activo");
    return;
  }

  const travel =
    order.travels.find(
      t =>
        t.status === "en_curso" ||
        t.status === "programado"
    );

  if(!travel){
    alert("No hay viaje para cancelar");
    return;
  }

  cancelarViajePorId(travel.id);

  alert("Viaje cancelado correctamente");

  mostrarViajeEnCursoUI();

  renderListaViajes();

  renderResumenDia();

}
function renderDetalleJornadaPorNumero(orderNumber){
console.log("Entrando a renderDetalleJornadaPorNumero:", orderNumber);
  const order =
    getOrders().find(o => o.orderNumber === orderNumber);

  if(!order) return;

  const container = document.getElementById("detalleOrdenContainer");

  if(!container) return;

  container.innerHTML = "";

  // Resumen de la orden
  const totales = calculateOrderTotals(order);

  const resumenEl = document.createElement("div");
  resumenEl.className = "order-summary";
  resumenEl.innerHTML = `
    <b>Fecha:</b> ${order.date}<br>
    <b>Base:</b> ${order.baseInicio}<br>
    <b>KM:</b> ${totales.kmTotal.toFixed(1)} km<br>
    <b>Viáticos:</b> ${totales.viaticos}<br>
    <b>Total:</b> $ ${Math.round(totales.monto)}
  `;
  container.appendChild(resumenEl);

  // Viajes de la orden
  const travels = (order.travels || []).slice().sort(
    (a,b) => (a.departureTime||"").localeCompare(b.departureTime||"")
  );

  travels.forEach(v => {

    const km      = v.kmAuto ?? v.kmEmpresa ?? 0;
    const estado  = v.status || "finalizado";

    let estadoTexto = "⚫ FINALIZADO";
    if(estado === "programado") estadoTexto = "🟡 PROGRAMADO";
    if(estado === "en_curso")   estadoTexto = "🟢 EN CURSO";

    const tipoServicio  = v.tipoServicio || v.turno || "—";
    const acopladoTexto = (v.acopladoKm > 0 || v.acoplado) ? "SI" : "NO";

    const item = document.createElement("div");
    item.className = `travel-card ${estado}`;
    item.innerHTML = `
      <div class="travel-status ${estado}">${estadoTexto}</div>
      <div>🚍 <b>${v.origen}</b> → <b>${v.destino}</b></div>
      <div>🚦 Servicio: <b>${tipoServicio}</b></div>
      <div>🔗 Acoplado: <b>${acopladoTexto}</b></div>
      <div>🕒 Salida: <b>${v.departureTime}</b></div>
      <div>🕒 Llegada: <b>${v.llegadaReal ? new Date(v.llegadaReal).toLocaleTimeString("es-UY", {hour:"2-digit", minute:"2-digit"}) : (v.arrivalTime || "--:--")}</b></div>
      <div>📏 KM generados: <b>${km}</b></div>
    `;

    container.appendChild(item);
  });
}

function activarViajesProgramados(){

  console.log("🧭 UI solicita verificación de viajes programados");

  verificarViajesProgramados();

}

// =====================================================
// EXPORTAR JORNADA (JSON PARA PRUEBAS)
// =====================================================
// ===============================
// HELPERS
// ===============================

function redondear(n){
  return Math.round((n || 0) * 10) / 10;
}

function calcularKmPorTipo(viajes){

  const resultado = {
    directo: 0,
    semi_directo: 0,
    expreso: 0,
    turno: 0,
    vacio: 0
  };

  viajes.forEach(v => {

    if(v.status === "cancelado") return;

    const km = v.kmEmpresa ?? v.kmAuto ?? 0;
    const tipo = (v.tipoServicio || "").toLowerCase();

    if(tipo.includes("directo") && !tipo.includes("semi")){
      resultado.directo += km;
    }
    else if(tipo.includes("semi")){
      resultado.semi_directo += km;
    }
    else if(tipo.includes("expreso")){
      resultado.expreso += km;
    }
    else if(tipo.includes("turno")){
      resultado.turno += km;
    }
    else if(tipo.includes("vacio")){
      resultado.vacio += km;
    }

  });

  return resultado;
}

function calcularKmPorCategoria(viajes){

  let kmPasajero = 0;
  let kmVacio = 0;

  viajes.forEach(v => {

    if(v.status === "cancelado") return;

    const km = v.kmEmpresa ?? v.kmAuto ?? 0;

    if((v.tipoServicio || "").toLowerCase().includes("vacio")){
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

function calcularGuardiasDetalle(guardias){

  let comun = 0;
  let especial = 0;

  let horasComun = 0;
  let horasEspecial = 0;

  guardias.forEach(g => {

    const horas = g.hours || 0;

    if(g.type === "especial"){
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

function calcularAcoplados(viajes){

  let km = 0;
  let cantidad = 0;

  viajes.forEach(v => {

    if(v.acopladoKm){
      km += v.acopladoKm;
      cantidad++;
    }

  });

  return { km, cantidad };
}
async function generarPDFJornada(order){

  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn("jsPDF no cargado");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const totals = calculateOrderTotals(order);

  // helpers reutilizados
  const kmPorTipo = calcularKmPorTipo(order.travels || []);
  const kmPorCategoria = calcularKmPorCategoria(order.travels || []);
  const guardiasDetalle = calcularGuardiasDetalle(order.guards || []);
  const acopladosDetalle = calcularAcoplados(order.travels || []);

  let y = 15;

  const add = (txt, salto = 7) => {
    doc.text(txt, 15, y);
    y += salto;
  };

  doc.setFontSize(14);
  add("COT Driver - Resumen de Jornada", 10);

  doc.setFontSize(11);

  add(`Fecha: ${order.date}`);
  add(`Orden: ${order.orderNumber}`);
  add(`Base: ${order.baseInicio || "Montevideo"}`);

  y += 5;

  // =========================
  // TOTALES
  // =========================
  add("=== TOTALES ===");
  add(`KM Totales: ${redondear(totals.kmTotal)}`);
  add(`KM Viajes: ${redondear(totals.kmViajes)}`);
  add(`KM Guardias: ${redondear(totals.kmGuardias)}`);
  add(`KM Acoplados: ${redondear(totals.kmAcoplados)}`);
  add(`Viáticos: ${totals.viaticos}`);
  add(`Total $: ${Math.round(totals.monto)}`);

  y += 5;

  // =========================
  // KM POR TIPO
  // =========================
  add("=== KM POR TIPO ===");
  add(`Directo: ${redondear(kmPorTipo.directo)}`);
  add(`Semi Directo: ${redondear(kmPorTipo.semi_directo)}`);
  add(`Expreso: ${redondear(kmPorTipo.expreso)}`);
  add(`Turno: ${redondear(kmPorTipo.turno)}`);
  add(`Vacío: ${redondear(kmPorTipo.vacio)}`);

  y += 5;

  // =========================
  // CATEGORÍA
  // =========================
  add("=== KM POR CATEGORÍA ===");
  add(`Pasajero: ${redondear(kmPorCategoria.pasajero)}`);
  add(`Vacío: ${redondear(kmPorCategoria.vacio)}`);

  y += 5;

  // =========================
  // GUARDIAS
  // =========================
  add("=== GUARDIAS ===");
  add(`Común: ${redondear(guardiasDetalle.km.comun)} km (${redondear(guardiasDetalle.horas.comun)} h)`);
  add(`Especial: ${redondear(guardiasDetalle.km.especial)} km (${redondear(guardiasDetalle.horas.especial)} h)`);

  y += 5;

  // =========================
  // ACOPLADOS
  // =========================
  add("=== ACOPLADOS ===");
  add(`Cantidad: ${acopladosDetalle.cantidad}`);
  add(`KM: ${redondear(acopladosDetalle.km)}`);

  y += 10;

  // =========================
  // FIRMAS
  // =========================
  add("Firma chofer: ____________________", 10);
  add("Firma tránsito: ____________________", 10);

  doc.save(`jornada_${order.date}.pdf`);
}
// ===============================
// EXPORTAR JORNADA
// ===============================

async function exportarJornada(order){

  const driver = getDriver?.() || {};
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
      base: driver.base || "Montevideo"
    },

    jornada: {
      orderNumber: order.orderNumber,
      fecha: order.date,
      estado: order.status || "activa",
      creadaAt: order.createdAt
        ? new Date(order.createdAt).toISOString()
        : null,
      cerradaAt: order.closedAt
        ? new Date(order.closedAt).toISOString()
        : null
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
      duracionMinutos: v.duracionMinutos || null,
      syncStatus: v.syncStatus || "local"
    })),

    guardias: (order.guards || []).map(g => ({
      tipo: g.type,
      inicio: g.inicio,
      fin: g.fin,
      horas: g.hours || 0,
      kmGenerados: (g.hours || 0) * (g.type === "especial" ? 40 : 30)
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

      montoKm: Math.round(totals.kmTotal * 7.637),
      montoViaticos: totals.viaticos * 455,
      montoTotal: Math.round(totals.monto)

    }
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type:"application/json"});

  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const filename = `jornada_${order.date}_${order.orderNumber}_${hh}${mm}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // 🔥 PDF
  try {
    if (typeof generarPDFJornada === "function") {
      generarPDFJornada(order);
    }
  } catch (e) {
    console.warn("Error generando PDF", e);
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

function abrirHistorial(){

  const orders = getOrders();

  // Extraer meses únicos de las órdenes, ordenados descendente
  const meses = [...new Set(
    orders.map(o => (o.date || "").substring(0, 7))
  )].filter(Boolean).sort((a, b) => b.localeCompare(a));

  const selectMes = document.getElementById("filtroMes");
  selectMes.innerHTML = "";

  const mesActual = new Date().toISOString().substring(0, 7);

  meses.forEach(m => {
    const [yyyy, mm] = m.split("-");
    const fecha = new Date(Number(yyyy), Number(mm) - 1, 1);
    const label = fecha.toLocaleString("es-UY", { month: "long", year: "numeric" });
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = label;
    if(m === mesActual) opt.selected = true;
    selectMes.appendChild(opt);
  });

  actualizarFiltroDia();

  showScreen("historialScreen");
  renderHistorial();
}

function actualizarFiltroDia(){

  const selectMes = document.getElementById("filtroMes");
  const selectDia = document.getElementById("filtroDia");
  const mes = selectMes.value;

  const orders = getOrders();

  const dias = [...new Set(
    orders
      .filter(o => (o.date || "").startsWith(mes))
      .map(o => o.date)
  )].filter(Boolean).sort((a, b) => b.localeCompare(a));

  // mantener selección actual si sigue siendo válida
  const diaActual = selectDia.value;

  selectDia.innerHTML = `<option value="">Todos los días</option>`;

  dias.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    if(d === diaActual) opt.selected = true;
    selectDia.appendChild(opt);
  });
}

function renderHistorial(){

  actualizarFiltroDia();

  const mes = document.getElementById("filtroMes").value;
  const dia = document.getElementById("filtroDia").value;
  const container = document.getElementById("historialContainer");

  if(!container) return;
  container.innerHTML = "";

  const orders = getOrders().filter(o => {
    if(!o.date) return false;
    if(dia) return o.date === dia;
    return o.date.startsWith(mes);
  });

  if(orders.length === 0){
    container.innerHTML = `<div style="text-align:center; color:#888; padding:24px;">Sin jornadas para este período</div>`;
    return;
  }

  orders.sort((a, b) => b.date.localeCompare(a.date));

  // ── Resumen del período ──
  let kmTotal = 0, montoTotal = 0, viaticosTotal = 0;

  orders.forEach(o => {
    const t = calculateOrderTotals(o);
    kmTotal    += t.kmTotal;
    montoTotal += t.monto;
    viaticosTotal += t.viaticos;
  });

  const resumen = document.createElement("div");
  resumen.style.cssText = `
    background:#1a1a2e; color:white; border-radius:12px;
    padding:14px 16px; margin-bottom:16px; font-size:14px; line-height:1.8;
  `;

  resumen.innerHTML = `
    <div style="font-weight:bold; font-size:15px; margin-bottom:6px;">
      📊 ${dia ? "Resumen del día " + dia : "Resumen del período"}
    </div>
    🛣 KM: <b>${kmTotal.toFixed(1)} km</b><br>
    💰 Monto: <b>$ ${Math.round(montoTotal)}</b><br>
    🍽 Viáticos: <b>${viaticosTotal}</b><br>
    📅 Jornadas: <b>${orders.length}</b>
  `;

  container.appendChild(resumen);

  // ── Tarjetas por jornada ──
  orders.forEach(order => {
const resumenDestinos = {};

(order.travels || [])
  .filter(t => t.status !== "cancelado")
  .forEach(t => {

    const destino = (t.destino || "Sin destino");

    if(!resumenDestinos[destino]){
      resumenDestinos[destino] = 0;
    }

    resumenDestinos[destino]++;
  });

const textoDestinos = Object.entries(resumenDestinos)
  .map(([dest, cant]) => `${cant} ${dest}`)
  .join(" · ");

    const totales = calculateOrderTotals(order);

    // ✅ CORRECTO: dentro del scope de order
    const tieneTomeCese = (order.travels || []).some(t => t.tomeCese);
    const cantidadViajes = (order.travels || [])
      .filter(t => t.status !== "cancelado").length;

    const cantidadGuardias = (order.guards || []).length;

    // ✅ resumen tipos
    const resumenTipos = {};
    (order.travels || [])
      .filter(t => t.status !== "cancelado")
      .forEach(t => {
        const tipo = (t.tipoServicio || "comun").toLowerCase();
        if(!resumenTipos[tipo]) resumenTipos[tipo] = 0;
        resumenTipos[tipo]++;
      });

    const textoTipos = Object.entries(resumenTipos)
      .map(([tipo, cant]) => {
        const nombre = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        return `${cant} ${nombre}`;
      })
      .join(" · ");

    const card = document.createElement("div");
    card.style.cssText = `
      border:1px solid #ddd; border-radius:10px;
      padding:12px; margin-bottom:10px; cursor:pointer;
    `;

    const travels = (order.travels || [])
      .filter(t => t.status !== "cancelado")
      .sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));

    let viajesHTML = travels.map(v =>
      `<div style="font-size:13px; color:#444; margin-top:4px;">
        🚍 ${v.origen} → ${v.destino}
        &nbsp;·&nbsp; ${v.departureTime || "--"} - ${v.arrivalTime || "--"}
        &nbsp;·&nbsp; ${v.kmAuto ?? v.kmEmpresa ?? 0} km
      </div>`
    ).join("");

    card.innerHTML = `
      <div style="font-weight:bold; margin-bottom:6px;">📅 ${order.date}</div>

      <div style="font-size:13px; line-height:1.7;">
        🛣 KM: <b>${totales.kmTotal.toFixed(1)}</b>
        &nbsp;·&nbsp; 🍽 Viáticos: <b>${totales.viaticos}</b>
        &nbsp;·&nbsp; 🟢 Tome y Cese: <b>${tieneTomeCese ? "Sí" : "No"}</b><br>

        📦 Viajes: <b>${cantidadViajes}</b>
        &nbsp;·&nbsp; ⏱ Guardias: <b>${cantidadGuardias}</b><br>

        🧭 Servicios: <b>${textoTipos || "—"}</b>
        📍 Destinos: <b>${textoDestinos || "—"}</b><br>
      </div>

      ${viajesHTML}
    `;

    card.onclick = () => {
      showScreen("detalleOrdenScreen");
      renderDetalleJornadaPorNumero(order.orderNumber);
    };

    container.appendChild(card);
  });
}

window.abrirHistorial = abrirHistorial;
window.renderHistorial = renderHistorial;
