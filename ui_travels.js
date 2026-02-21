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
// LISTA DE VIAJES  (COMPATIBLE CON TARJETAS)
// =====================================================
function renderListaViajes(){

  const container =
    document.getElementById("cardsViajesContainer");

  if(!container) return;

  container.innerHTML = "";

  const orders = getOrders();

  if(!orders || orders.length === 0){
    container.innerHTML = "Sin viajes registrados";
    return;
  }

  const porDia = {};

  orders.forEach(o => {

    if(!porDia[o.date]) porDia[o.date] = [];

    porDia[o.date].push(o);

  });

  const fechas = Object.keys(porDia)
    .sort((a,b)=> new Date(b)-new Date(a));

  fechas.forEach(fecha => {

    const card = document.createElement("div");

    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      margin-bottom:10px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
    `;

    let contenido = `<b>📅 ${fecha}</b><br><br>`;

    porDia[fecha].forEach(o => {

      o.travels.forEach(v => {

        const km =
          v.kmAuto ??
          v.kmEmpresa ??
          0;

        contenido += `
          🚍 ${v.origen} → ${v.destino}<br>
          🕒 ${v.departureTime} - ${v.arrivalTime}<br>
          📏 ${km} km<br><br>
        `;

      });

    });

    card.innerHTML = contenido;

    container.appendChild(card);

  });

}

window.renderResumenDia = renderResumenDia;

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

  let o = getActiveOrder();

  // 🔥 AUTO CREAR JORNADA
  if(!o){
    o = createOrder();
    console.log("Jornada creada automáticamente:", o.orderNumber);
  }

  document.getElementById("orderNumberTravels").innerText =
    "Orden: " + o.orderNumber;

  document.getElementById("destinationTravels").value = "";
  document.getElementById("kmTravels").value = "";
  document.getElementById("departureTimeTravels").value = "";
  document.getElementById("arrivalTimeTravels").value = "";

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
// VIAJE EN CURSO UI
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

  // calcular duración transcurrida
  const ahora = new Date();

  const salida = new Date();
  const [h,m] = travel.departureTime.split(":");
  salida.setHours(h,m,0,0);

  const diffMs = ahora - salida;
  const diffMin = Math.floor(diffMs / 60000);

  const horas = Math.floor(diffMin / 60);
  const mins  = diffMin % 60;

  card.innerHTML = `
    <b>🟢 Viaje en curso</b><br><br>

    🚍 ${travel.origen} → ${travel.destino}<br>
    🕒 Salida: ${travel.departureTime}<br>
    ⏱ Transcurrido: ${horas}h ${mins}m<br><br>

    <button onclick="finalizarViajeUI()">
      Finalizar viaje
    </button>
  `;

  container.appendChild(card);
// 🔄 auto actualizar cada 60 segundos
if(window.__viajeTimer) clearTimeout(window.__viajeTimer);

window.__viajeTimer = setTimeout(() => {
  mostrarViajeEnCursoUI();
}, 60000);
}


// =====================================================
// FINALIZAR VIAJE DESDE UI
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

  finalizarViajeActual(arrivalTime);

  alert("Viaje finalizado\nHora llegada: " + arrivalTime);

  mostrarViajeEnCursoUI();
  renderResumenDia?.();
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