alert("UI_TRAVELS VERSION NUEVA");
console.log("ui_travels cargado");
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
  exportarJornada(o);
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
  showScreen('detalleJornadaScreen');
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
        v.acoplado ? "SI" : "NO";

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

        tiempoHTML = `
          <div class="travel-time">
            ⏱ ${h}h ${m}m transcurridos
          </div>
        `;
      }

      // =========================
      // RENDER ITEM
      // =========================

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

      `;

      card.appendChild(item);

    });

    container.appendChild(card);

  });

}
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

  event.preventDefault();

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

  renderResumenDia();
renderListaViajes();

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
      v.acoplado ? "SI" : "NO";

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

  // 🔧 FIX: activar viajes programados antes de renderizar
  

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
    return; // nada para mostrar
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

    tiempoHTML = `
      🕒 Salida: ${travel.departureTime}<br>
      ⏱ Transcurrido: ${horas}h ${mins}m
    `;

    let duracionEstimadaMin =
      obtenerDuracionPromedio(
        travel.origen,
        travel.destino
      );

    if(!duracionEstimadaMin){

      const velocidadFallback = 60;

      duracionEstimadaMin =
        Math.floor(
          (travel.kmEmpresa || 0)
          / velocidadFallback * 60
        );
    }

    if(duracionEstimadaMin > 0){

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
      `
      + botonesHTML;
  }

  // ============================
  // RENDER
  // ============================

  card.innerHTML = `

    <b>${esProgramado ? "🟡 Viaje programado" : "🟢 Viaje en curso"}</b><br><br>

    🚍 ${travel.origen} → ${travel.destino}<br>

    ${tiempoHTML}

    ${estadoDuracionHTML}

    <div style="margin-top:10px">
      ${botonesHTML}
    </div>

  `;

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

  const container =
    document.getElementById("cardsViajesContainer");

  const resumenBox =
    document.getElementById("resumenDia");

  if(!container || !resumenBox) return;

  container.innerHTML = "";

  // 🔹 Resumen usando función actual
  const totales =
    calculateOrderTotals(order);

  resumenBox.innerHTML = `
    <div class="order-summary">
      <b>Fecha:</b> ${order.date}<br>
      <b>Base:</b> ${order.baseInicio}<br>
      <b>KM:</b> ${totales.kmTotal.toFixed(1)} km<br>
      <b>Viáticos:</b> ${totales.viaticos}<br>
      <b>Total:</b> $ ${Math.round(totales.monto)}
    </div>
  `;

  // 🔹 Viajes de esa orden
  const travels = order.travels || [];

  travels.sort((a,b)=>
    (a.departureTime||"").localeCompare(b.departureTime||"")
  );

  travels.forEach(v => {

    const km =
      v.kmAuto ?? v.kmEmpresa ?? 0;

    const estado = v.status || "finalizado";

    const item =
      document.createElement("div");

    item.className =
      `travel-card ${estado}`;

    let estadoTexto = "⚫ FINALIZADO";
    if(estado==="programado") estadoTexto="🟡 PROGRAMADO";
    if(estado==="en_curso") estadoTexto="🟢 EN CURSO";

    const tipoServicio =
      v.tipoServicio || v.turno || "—";

    const acopladoTexto =
      v.acoplado ? "SI" : "NO";

    item.innerHTML = `
  <div class="travel-status ${estado}">
    ${estadoTexto}
  </div>

  <div><b>N° Orden:</b> ${order.orderNumber}</div>

  <div>🚍 <b>${v.origen}</b> → <b>${v.destino}</b></div>

  <div>🚦 Servicio: <b>${tipoServicio}</b></div>
  <div>🔗 Acoplado: <b>${acopladoTexto}</b></div>

  <div>🕒 Salida: <b>${v.departureTime}</b></div>
  <div>🕒 Llegada: <b>${v.arrivalTime || "--:--"}</b></div>

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

async function exportarJornada(order){

  const driver = getDriver?.();
const totals = calculateOrderTotals(order);
const tomeCeseAplicado = (totals.kmTomeCese || 0) > 0;

 const data = {
  version_app: "0.9 piloto",
  chofer: driver?.nombre || "Chofer",
  base: driver?.base || "Montevideo",
  fecha: order.date,
  orderNumber: order.orderNumber,
  viajes: order.travels || [],
  guardias: order.guards || [],
  resumen: calculateOrderTotals(order),

  export: {
    generatedAt: new Date().toISOString(),
    version_app: "0.9 piloto"
  }
};

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {type:"application/json"});

  const now = new Date();
const hh = String(now.getHours()).padStart(2,"0");
const mm = String(now.getMinutes()).padStart(2,"0");

const filename = `jornada_${order.date}_${hh}${mm}.json`;

const file = new File(
  [blob],
  filename,
  {type:"application/json"}
);

  // 📤 compartir si el dispositivo lo permite
try {

  if(navigator.canShare && navigator.canShare({files:[file]})){

    await navigator.share({
      title: "Jornada COT Driver",
      text: "Reporte de jornada",
      files: [file]
    });

    return;

  }

}catch(e){
  console.log("Share no disponible, usando descarga");
}

    // fallback descarga
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
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
