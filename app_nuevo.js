console.log("APP_NUEVO CARGADO (SERVICIOS LEGIBLES EN TABLA)");

// =====================================================
// ESTADO DE UI (solo visual)
// =====================================================

let servicioSeleccionado = null;

// =====================================================
// NAVEGACIÓN
// =====================================================

function showScreen(id){
  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// =====================================================
// NORMALIZACIÓN (DEBE IR ARRIBA)
// =====================================================

function normalizarTexto(txt) {
  if (!txt) return "";

  return txt
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================================
// JORNADA
// =====================================================

function createOrderUI(){
  const o = createOrder();   // CORE

  document.getElementById("ordenActivaInfo").innerText =
    "🟢 Jornada activa: " + o.orderNumber;

  alert("Jornada iniciada");
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
// NUEVO VIAJE (ABRIR PANTALLA)
// =====================================================

function abrirViajeSimple(){
  const o = getActiveOrder(); // CORE

  if(!o){
    alert("Primero iniciá la jornada");
    return;
  }

  showScreen("travelScreen");

  document.getElementById("orderNumberTravels").value =
    o.orderNumber;

  document.getElementById("originTravels").value = "Montevideo";
  document.getElementById("destinationTravels").value = "";
  document.getElementById("kmTravels").value = "";
  document.getElementById("numeroServicio").value = "";

  servicioSeleccionado = null;
}

// =====================================================
// BUSCADOR DE RUTAS MEJORADO
// =====================================================

function buscarRutaCoincidente(textoUsuario) {
  const buscado = normalizarTexto(textoUsuario);

  let candidataExacta = null;
  let candidataConX = null;
  let candidataParcial = null;

  for (const ruta in ROUTES_CATALOG) {
    const rutaNorm = normalizarTexto(ruta);
    const partes = rutaNorm.split("→");
    const destinoFinal = partes[1] ? partes[1].trim() : rutaNorm;

    // === PRIORIDAD 1: DESTINO FINAL LIMPIO (sin "x") ===
    if (destinoFinal.includes(buscado) && !destinoFinal.includes(" x ")) {
      candidataExacta = {
        ruta,
        km: ROUTES_CATALOG[ruta]
      };
      break; // esta es la mejor posible
    }

    // === PRIORIDAD 2: DESTINO FINAL CON "x" ===
    if (destinoFinal.includes(buscado) && destinoFinal.includes(" x ")) {
      candidataConX = {
        ruta,
        km: ROUTES_CATALOG[ruta]
      };
    }

    // === PRIORIDAD 3: COINCIDENCIA EN TODA LA RUTA ===
    if (rutaNorm.includes(buscado)) {
      candidataParcial = {
        ruta,
        km: ROUTES_CATALOG[ruta]
      };
    }
  }

  return candidataExacta || candidataConX || candidataParcial;
}
// =====================================================
// BUSCAR MÚLTIPLES RUTAS PARA SUGERENCIAS
// =====================================================

function buscarMultiplesRutas(textoUsuario) {
  const buscado = normalizarTexto(textoUsuario);
  let resultados = [];

  for (const ruta in ROUTES_CATALOG) {
    const rutaNorm = normalizarTexto(ruta);
    const partes = rutaNorm.split("→");
    const destinoFinal = partes[1] ? partes[1].trim() : rutaNorm;

    if (destinoFinal.includes(buscado) || rutaNorm.includes(buscado)) {
      resultados.push({
        rutaOriginal: ruta,
        destinoFinal: destinoFinal,
        km: ROUTES_CATALOG[ruta]
      });
    }
  }

  return resultados;
}



function autoKmPorDestino(terminoDeEscribir = false) {
  const input = document.getElementById("destinationTravels");
  const texto = input.value;
  const box = document.getElementById("sugerenciasRutas");

  if (!texto) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const matches = buscarMultiplesRutas(texto);

  if (matches.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";
  box.innerHTML = "";

  matches.forEach(m => {
    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #eee";

    div.innerText = `${m.destinoFinal} (${m.km} km)`;

    div.onclick = () => {
      input.value = m.destinoFinal;
      document.getElementById("kmTravels").value = m.km;
      box.style.display = "none";
      box.innerHTML = "";
    };

    box.appendChild(div);
  });

  const matchUnico = buscarRutaCoincidente(texto);
  if (matchUnico) {
    document.getElementById("kmTravels").value = matchUnico.km;

    if (terminoDeEscribir) {
      const partes = matchUnico.ruta.split("→");
      const destinoFinal = partes[1].trim();
      input.value = destinoFinal;
      box.style.display = "none";
    }
  }
}




// =====================================================
// SERVICIO (UI → CORE)
// =====================================================

function actualizarInfoServicio(){
  const sel = document.getElementById("numeroServicio").value;

  if(!sel){
    servicioSeleccionado = null;
    return;
  }

  let turno = 1;
  let esGuardiaEspecial = false;

  if(sel === "SEMI") turno = 2;
  if(sel === "DIRECTO") turno = 3;

  if(sel === "EXPRESO"){
    turno = 1;
  }

  if(sel === "CONTRATADO"){
    turno = 1; 
    esGuardiaEspecial = true;
  }

  servicioSeleccionado = {
    tipo: sel,
    turno,
    esGuardiaEspecial
  };
}

// =====================================================
// GUARDAR VIAJE → CORE
// =====================================================

function addTravelUI(event){
  event.preventDefault();

  const o = getActiveOrder();
  if(!o){
    alert("No hay jornada activa");
    return;
  }

  if(!servicioSeleccionado){
    alert("Seleccioná un servicio válido");
    return;
  }

  const destino =
    document.getElementById("destinationTravels").value.trim();

  if(!destino){
    alert("Escribí el destino");
    return;
  }

  const ok = addTravel(destino, servicioSeleccionado.turno);

  if(!ok){
    alert("No se pudo guardar el viaje en el core");
    return;
  }

  if(servicioSeleccionado.esGuardiaEspecial){
    addGuard("especial", 1);
  }

  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimoViaje = ultima.travels[ultima.travels.length - 1];

  ultimoViaje.servicioUI = servicioSeleccionado.tipo;
  saveOrders(orders);

  renderListaViajes();
  renderResumenDia();

  alert("Viaje guardado en la jornada real");

  showScreen("mainScreen");
}

// =====================================================
// LISTA DE VIAJES
// =====================================================

function renderListaViajes(){
  const tbody =
    document.getElementById("listaViajesContainer");

  tbody.innerHTML = "";

  const orders = getOrders();
  if(!orders || orders.length === 0) return;

  const o = orders[orders.length - 1];
  if(!o.travels || o.travels.length === 0) return;

  o.travels.forEach((v,i) => {

    let servicioTexto = v.servicioUI;

    if(!servicioTexto){
      if(v.turno === 1) servicioTexto = "TURNO";
      if(v.turno === 2) servicioTexto = "SEMI";
      if(v.turno === 3) servicioTexto = "DIRECTO";
    }

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(v.createdAt).toLocaleTimeString()}</td>
      <td>${v.destino}</td>
      <td>${v.kmEmpresa}</td>
      <td>${servicioTexto}</td>
      <td>${v.acoplado ? "SI" : "NO"}</td>
      <td>—</td>
    `;

    tbody.appendChild(tr);
  });
}

// =====================================================
// RESUMEN DEL DÍA
// =====================================================

function renderResumenDia(){
  const s = getTodaySummary(); // CORE

  const resumen = `
    <p><b>Kilómetros totales:</b> ${s.kmTotal}</p>
    <p><b>Viajes con acoplado:</b> ${s.acoplados}</p>
    <p><b>Horas de guardia:</b> ${s.guardiasHoras}</p>
    <p><b>Monto del día:</b> $${Math.round(s.monto)}</p>
  `;

  const box = document.getElementById("resumenDia");
  if(box) box.innerHTML = resumen;
}

// =====================================================
// CARGA INICIAL
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

  const o = getActiveOrder();

  if(o){
    document.getElementById("ordenActivaInfo").innerText =
      "🟢 Jornada activa: " + o.orderNumber;
  }

  // ✅ PONEMOS HOY POR DEFECTO EN GUARDIAS
  const diaInput = document.getElementById("diaGuardia");
if(diaInput){
  diaInput.value = new Date().toISOString().split("T")[0];
}


  renderListaViajes();
  renderResumenDia();
});


// =====================================================
// GUARDIAS (UI → CORE)
// =====================================================

function addGuardUI(event){
  event.preventDefault();

  const o = getActiveOrder();
  if(!o){
    alert("Primero iniciá la jornada");
    return;
  }

  const dia = document.getElementById("diaGuardia").value;
  const inicio = document.getElementById("horaInicioGuardia").value;
  const fin = document.getElementById("horaFinGuardia").value;
  const tipo = document.getElementById("tipoGuardia").value;

  if(!dia){
    alert("Seleccioná el día");
    return;
  }

  if(!inicio || !fin){
    alert("Ingresá hora inicio y fin");
    return;
  }

  if(!tipo){
    alert("Elegí tipo de guardia");
    return;
  }

  // 👉 ÚNICO cálculo que hace la UI: convertir inicio/fin → horas
  const [hI, mI] = inicio.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);

  let horas = (hF + mF/60) - (hI + mI/60);

  if(horas <= 0){
    alert("La hora fin debe ser mayor que la de inicio");
    return;
  }

  // 👉 Mandamos al CORE exactamente lo que espera
  addGuard(tipo, horas);

  renderResumenDia();
  renderListaGuardias();

  alert(`Guardia ${tipo} de ${horas.toFixed(2)} hs registrada`);

  showScreen("mainScreen");
}


// =====================================================
// LISTA DE GUARDIAS
// =====================================================

function renderListaGuardias(){
  const tbody =
    document.getElementById("listaGuardiasContainer");

  tbody.innerHTML = "";

  const orders = getOrders(); // CORE
  if(!orders || orders.length === 0) return;

  const o = orders[orders.length - 1]; // última jornada
  if(!o.guards || o.guards.length === 0) return;

  o.guards.forEach((g,i) => {

    const tipoTexto =
      g.type === "especial" ? "Especial" : "Común";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(g.createdAt).toLocaleTimeString()}</td>
      <td>${tipoTexto}</td>
      <td>${g.hours.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}










