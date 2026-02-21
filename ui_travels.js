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

  alert("Jornada cerrada");
}
// =====================================================
// LISTA DE VIAJES — VERSION FINAL CORRECTA
// Compatible 100% con CORE COT DRIVER ENGINE
// =====================================================

function renderListaViajes(){

  const container =
    document.getElementById("cardsViajesContainer");

  if(!container) return;

  container.innerHTML = "";

  let orders = getOrders();

  if(!orders || orders.length === 0){

    container.innerHTML = `
      <div style="padding:20px;color:#666">
        Sin jornadas registradas
      </div>
    `;

    return;
  }

  // ordenar por fecha descendente
  orders.sort((a,b)=> new Date(b.date) - new Date(a.date));

  // mostrar jornada actual + 5 anteriores
  const ultimasOrdenes = orders.slice(0,6);

  const activeOrder = getActiveOrder();

  ultimasOrdenes.forEach(order => {

    // obtener totales oficiales desde el CORE
    const totales = calculateOrderTotals(order);

    const card =
      document.createElement("div");

    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      margin-bottom:12px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
    `;
card.style.cursor = "pointer";

  card.onclick = () => {
    abrirDetalleOrden(order.orderNumber);
  };
    // =========================
    // TITULO JORNADA
    // =========================

    const titulo =
      document.createElement("div");

    titulo.style.cssText = `
      font-weight:bold;
      margin-bottom:8px;
      font-size:16px;
    `;

    // marcar jornada activa
    if(activeOrder &&
       order.orderNumber === activeOrder.orderNumber){

      titulo.innerText =
        `📅 ${order.date} — Jornada activa`;

    }else{

      titulo.innerText =
        `📅 ${order.date}`;

    }

    card.appendChild(titulo);

    // =========================
    // RESUMEN JORNADA
    // =========================

    const resumen =
      document.createElement("div");

    resumen.style.cssText = `
      font-size:13px;
      margin-bottom:10px;
      padding:8px;
      background:#f1f3f5;
      border-radius:8px;
    `;

    resumen.innerHTML = `
      Tome y cese: ${totales.kmTomeCese} km<br>
      Acoplados: ${totales.kmAcoplados} km<br>
      Viáticos: ${totales.viaticos}<br>
      Total jornada: ${totales.kmTotal.toFixed(1)} km
    `;

    card.appendChild(resumen);

    // =========================
    // LISTA DE VIAJES
    // =========================

    const travels = order.travels || [];

    travels.sort(
      (a,b)=>
        a.departureTime.localeCompare(b.departureTime)
    );

    travels.forEach(v => {

      const km =
        v.kmAuto ??
        v.kmEmpresa ??
        0;

      const item =
        document.createElement("div");

      item.style.cssText = `
        padding:8px;
        margin-bottom:6px;
        border-radius:8px;
        background:#f8f9fa;
      `;

      item.innerHTML = `
        🚍 ${v.origen} → ${v.destino}<br>
        🕒 ${v.departureTime} - ${v.arrivalTime}<br>
        📏 ${km} km
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
function addTravelUI(event){
  event.preventDefault();

  let order = getActiveOrder();

  // 🔥 AUTO CREAR JORNADA SI NO EXISTE
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

  // 🔥 HORA REAL DEL SISTEMA
  const ahora = new Date();

  const departureTime =
    ahora.toTimeString().substring(0,5);

  // duración estimada inicial simple (podemos mejorar luego)
  const duracionEstimadaHoras = 2;

  const llegadaEstimadaDate =
    new Date(ahora.getTime() + duracionEstimadaHoras*60*60*1000);

  const arrivalTime =
    llegadaEstimadaDate.toTimeString().substring(0,5);

  const hoursWorked = duracionEstimadaHoras;

  // GUARDAR VIAJE EN CORE
  const ok = addTravel(
    origen,
    destino,
    servicioSeleccionado.turno,
    departureTime,
    arrivalTime,
    hoursWorked
  );

  if(!ok){
    alert("No se pudo iniciar el viaje");
    return;
  }

  // marcar como en curso
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimoViaje = ultima.travels[ultima.travels.length - 1];

  ultimoViaje.estado = "en_curso";
  ultimoViaje.inicioReal = ahora.getTime();
  ultimoViaje.llegadaEstimada = llegadaEstimadaDate.getTime();
  ultimoViaje.servicioUI = servicioSeleccionado.tipo;

  saveOrders(orders);
  setActiveOrder(ultima);

  renderResumenDia();
  renderListaViajes();

  alert(
    "Viaje iniciado\n" +
    "Salida registrada automáticamente: " + departureTime
  );

  showScreen("mainScreen");
  mostrarViajeEnCursoUI();
}
// =====================================================
// RESUMEN DEL DIA (FUNCION FALTANTE)
// =====================================================

function renderResumenDia(){
  const container=document.getElementById("resumenDia");
  if(!container)return;

  const order=getActiveOrder();
  if(!order){
    container.innerHTML="Sin jornada activa";
    return;
  }

  const totals=calculateOrderTotals(order);

  container.innerHTML=`
    <div class="card">
      <b>Resumen jornada activa</b><br>
      KM totales: <b>${totals.kmTotal.toFixed(1)}</b><br>
      KM tome y cese: <b>${totals.kmTomeCese.toFixed(1)}</b><br>
      KM guardias: <b>${totals.kmGuardias.toFixed(1)}</b><br>
      KM acoplados: <b>${totals.kmAcoplados.toFixed(1)}</b><br>
      Viáticos generados: <b>${totals.viaticos}</b><br>
      Total $: <b>${totals.monto.toFixed(0)}</b>
    </div>
  `;
}
// =====================================================
// ABRIR PANTALLA NUEVO VIAJE
// =====================================================
function abrirViajeSimple(){

  const travelEnCurso = getTravelEnCurso();

  if(travelEnCurso){

    alert(
      "Ya hay un viaje en curso\n\n" +
      travelEnCurso.origen + " → " + travelEnCurso.destino +
      "\nSalida: " + travelEnCurso.departureTime +
      "\n\nFinalizalo antes de iniciar uno nuevo."
    );

    return;
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

  const travel = getTravelEnCurso();

  // limpiar
  container.innerHTML = "";

  if(!travel) return;

  const card = document.createElement("div");

  card.style.cssText = `
    background:#e8f5e9;
    border:1px solid #4caf50;
    border-radius:12px;
    padding:12px;
    margin-bottom:12px;
  `;

  // ================================
  // DURACIÓN TRANSCURRIDA
  // ================================

  const ahora = new Date();

  const salida = new Date();
  const [h,m] = travel.departureTime.split(":");
  salida.setHours(h,m,0,0);

  const diffMs = ahora - salida;
  const diffMin = Math.floor(diffMs / 60000);

  const horas = Math.floor(diffMin / 60);
  const mins  = diffMin % 60;




  // ================================
// DURACIÓN ESTIMADA INTELIGENTE
// ================================

// usar promedio real aprendido
let duracionEstimadaMin =
  obtenerDuracionPromedio(travel.origen, travel.destino);

// fallback si no hay datos aún
if(!duracionEstimadaMin){

  const velocidadPromedioFallback = 60;

  duracionEstimadaMin =
    Math.floor((travel.kmEmpresa || 0) / velocidadPromedioFallback * 60);
}

const excedidoMin = diffMin - duracionEstimadaMin;

 let estadoDuracionHTML = "";

  if(duracionEstimadaMin > 0){

    const estHoras = Math.floor(duracionEstimadaMin / 60);
    const estMin   = duracionEstimadaMin % 60;

    if(excedidoMin > 0){

      estadoDuracionHTML = `
        <div style="
          margin-top:8px;
          padding:6px;
          background:#fff3cd;
          border-radius:6px;
          font-size:13px;
        ">
          🟡 Duración estimada: ${estHoras}h ${estMin}m<br>
          ⏱ Excedido: ${excedidoMin} min
        </div>
      `;

      // 🔔 ALERTA AUTOMÁTICA SOLO UNA VEZ
      if(!travel.alertaExcesoMostrada){

        setTimeout(()=>{

          alert(
            "Este viaje superó el tiempo estimado.\n" +
            "Revise si desea finalizarlo."
          );

        }, 500);

        travel.alertaExcesoMostrada = true;

        const orders = getOrders();
        saveOrders(orders);

      }

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


  // ================================
  // UI CARD
  // ================================

  card.innerHTML = `
    <b>🟢 Viaje en curso</b><br><br>

    🚍 ${travel.origen} → ${travel.destino}<br>
    🕒 Salida: ${travel.departureTime}<br>
    ⏱ Transcurrido: ${horas}h ${mins}m

    ${estadoDuracionHTML}

    <br>
    <button onclick="finalizarViajeUI()">
      Finalizar viaje
    </button>
  `;

  container.appendChild(card);


  // ================================
  // AUTO ACTUALIZAR CADA 60 SEGUNDOS
  // ================================

  if(window.__viajeTimer){
    clearInterval(window.__viajeTimer);
  }

  window.__viajeTimer = setInterval(()=>{

    const travelActivo = getTravelEnCurso();

    if(!travelActivo){

      clearInterval(window.__viajeTimer);
      window.__viajeTimer = null;
      return;

    }

    mostrarViajeEnCursoUI();

  }, 60000);

}

// =====================================================
// FINALIZAR VIAJE DESDE UI (CON CÁLCULO REAL)
// =====================================================

function finalizarViajeUI(){

  const travel = getTravelEnCurso();

  if(!travel){
    alert("No hay viaje activo");
    return;
  }

  const ahora = new Date();

  const arrivalTime =
    ahora.toTimeString().substring(0,5);

  // ================================
  // CALCULAR DURACIÓN REAL
  // ================================

  const [hS, mS] = travel.departureTime.split(":").map(Number);
  const salida = new Date();
  salida.setHours(hS, mS, 0, 0);

  const diffMs = ahora - salida;

  const duracionMin =
    Math.max(1, Math.floor(diffMs / 60000));

  // ================================
  // CALCULAR VELOCIDAD PROMEDIO REAL
  // ================================

  const duracionHoras = duracionMin / 60;

  let velocidadPromedio = 0;

  if(travel.kmEmpresa && duracionHoras > 0){

    velocidadPromedio =
      Number(
        (travel.kmEmpresa / duracionHoras).toFixed(1)
      );

  }

  // ================================
  // GUARDAR EN EL OBJETO VIAJE
  // ================================

  travel.arrivalTime = arrivalTime;
  travel.duracionMin = duracionMin;
  travel.velocidadPromedio = velocidadPromedio;

  // actualizar en storage
  const orders = getOrders();

  saveOrders(orders);

  finalizarViajeActual(arrivalTime);
registrarEstadisticaViaje({
  ...travel,
  arrivalTime
});
  alert(
    "Viaje finalizado\n" +
    "Duración: " + duracionMin + " min\n" +
    "Velocidad promedio: " + velocidadPromedio + " km/h"
  );

  mostrarViajeEnCursoUI();

  renderResumenDia?.();
}

// =====================================================
// ABRIR DETALLE DE ORDEN
// =====================================================
function abrirDetalleOrden(orderNumber){

  const orders = getOrders();

  const order =
    orders.find(o => o.orderNumber === orderNumber);

  if(!order) return;

  renderDetalleOrden(order);

  showScreen("detalleOrdenScreen");
}


// =====================================================
// RENDER DETALLE DE ORDEN
// =====================================================
function renderDetalleOrden(order){

  const container =
    document.getElementById("detalleOrdenContainer");

  if(!container) return;

  const totales =
    calculateOrderTotals(order);

  // =========================
  // CABECERA Y RESUMEN
  // =========================

  container.innerHTML = `
  
    <div style="margin-bottom:15px">

      <h3 style="margin-bottom:5px">
        📅 Jornada ${order.date}
      </h3>

      <div style="font-size:14px;color:#555">
        <b>Orden:</b> ${order.orderNumber}<br>
        <b>Base:</b> ${order.baseInicio}
      </div>

    </div>

    <div style="
      background:#f1f3f5;
      padding:12px;
      border-radius:8px;
      margin-bottom:15px;
      border:1px solid #ddd;
    ">

      <b>Resumen de jornada</b><br><br>

      KM viajes: ${totales.kmViajes.toFixed(1)} km<br>
      KM guardias: ${totales.kmGuardias.toFixed(1)} km<br>
      KM tome y cese: ${totales.kmTomeCese.toFixed(1)} km<br>
      KM acoplados: ${totales.kmAcoplados.toFixed(1)} km<br>
      Viáticos: ${totales.viaticos}<br>

      <hr>

      <b>Total KM:</b> ${totales.kmTotal.toFixed(1)} km<br>
      <b>Total $:</b> ${totales.monto.toFixed(0)}

    </div>

    <h4 style="margin-bottom:10px">Viajes realizados</h4>

  `;

  // =========================
  // LISTA DE VIAJES
  // =========================

  if(!order.travels || order.travels.length === 0){

    const empty =
      document.createElement("div");

    empty.style.cssText = `
      color:#666;
      padding:10px;
    `;

    empty.innerText =
      "No hay viajes en esta jornada";

    container.appendChild(empty);

    return;
  }

  order.travels.forEach(v => {

    const km =
      v.kmAuto ??
      v.kmEmpresa ??
      0;

    const div =
      document.createElement("div");

    div.style.cssText = `
      padding:10px;
      margin-bottom:8px;
      background:white;
      border-radius:8px;
      border:1px solid #ddd;
      box-shadow:0 1px 3px rgba(0,0,0,.05);
    `;

    div.innerHTML = `
      <div style="font-weight:500">
        🚍 ${v.origen} → ${v.destino}
      </div>

      <div style="font-size:13px;color:#555">
        🕒 ${v.departureTime} - ${v.arrivalTime}
      </div>

      <div style="font-size:13px;color:#555">
        📏 ${km} km
      </div>
    `;

    container.appendChild(div);

  });

}


// export global
window.abrirViajeSimple = abrirViajeSimple;
window.renderResumenDia = renderResumenDia;
window.addTravelUI = addTravelUI;
window.cargarViajeRetornoAutomatico = cargarViajeRetornoAutomatico;
window.createOrderUI = createOrderUI;
window.closeActiveOrderUI = closeActiveOrderUI;
window.renderListaViajes = renderListaViajes;
window.actualizarInfoServicio = actualizarInfoServicio;
window.renderTarjetasPorDia = renderTarjetasPorDia;