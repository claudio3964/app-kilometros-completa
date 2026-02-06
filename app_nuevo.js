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
// CONECTOR DE KM (IDA / VUELTA) → UI
// =====================================================
function buscarKmRuta(origen, destino){
  const rutaDirecta = `${origen} → ${destino}`;
  const rutaInversa = `${destino} → ${origen}`;

  if (ROUTES_CATALOG[rutaDirecta]) {
    return ROUTES_CATALOG[rutaDirecta];
  }

  if (ROUTES_CATALOG[rutaInversa]) {
    return ROUTES_CATALOG[rutaInversa];
  }

  // Si no existe, devolvemos 0 (pero no debería pasar)
  console.warn("Ruta no encontrada:", rutaDirecta, "ni", rutaInversa);
  return 0;
}

// =====================================================
// NORMALIZAR Y DETECTAR RUTA DIRECTA O INVERSA
// =====================================================
function buscarKmRuta(origen, destino){
  const rutaDirecta = `${origen} → ${destino}`;
  const rutaInversa = `${destino} → ${origen}`;

  if (ROUTES_CATALOG[rutaDirecta]) {
    return ROUTES_CATALOG[rutaDirecta];
  }

  if (ROUTES_CATALOG[rutaInversa]) {
    return ROUTES_CATALOG[rutaInversa];
  }

  return 0;
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

    const origen = partes[0]?.trim();
    const destinoFinal = partes[1]?.trim();

    // 👉 Coincidencia con destino final (ida)
    if (destinoFinal && destinoFinal.includes(buscado)) {
      resultados.push({
        rutaOriginal: ruta,
        destinoFinal: destinoFinal,
        km: ROUTES_CATALOG[ruta]
      });
    }

    // 👉 NUEVO: también sugerir ORIGEN (clave para regresos)
    if (origen && origen.includes(buscado)) {
      resultados.push({
        rutaOriginal: ruta,
        destinoFinal: origen,   // 👈 lo mostramos como posible destino
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

  const origenActual =
    document.getElementById("originTravels")?.value || "Montevideo";

  if (!texto) {
    box.style.display = "none";
    box.innerHTML = "";
    return;gi
  }

  const matches = buscarMultiplesRutas(texto);

  if (matches.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";
  box.innerHTML = "";

  // ======= LISTA DE SUGERENCIAS (CLIC FUNCIONAL) =======
  matches.forEach(m => {
    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #eee";

    div.innerText = `${m.destinoFinal} (${m.km} km)`;

    div.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();

      input.value = m.destinoFinal;

      let kmCalculado = buscarKmRuta(origenActual, m.destinoFinal);

      // 👉 Si no existe ruta inversa, usamos el km del catálogo
      if (!kmCalculado || kmCalculado === 0) {
        kmCalculado = m.km;
      }

      document.getElementById("kmTravels").value = kmCalculado;

      box.style.display = "none";
      box.innerHTML = "";
    };

    box.appendChild(div);
  });

  // ======= COINCIDENCIA ÚNICA (AUTOCOMPLETADO) =======
  const matchUnico = buscarRutaCoincidente(texto);
  if (matchUnico) {
    const partes = matchUnico.ruta.split("→");
    const destinoFinal = partes[1].trim();

    let kmCalculado = buscarKmRuta(origenActual, destinoFinal);

    // 👉 Si no existe ruta inversa, usamos el km del catálogo
    if (!kmCalculado || kmCalculado === 0) {
      kmCalculado = matchUnico.km;
    }

    document.getElementById("kmTravels").value = kmCalculado;

    if (terminoDeEscribir) {
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

  // 👉 NUEVO: CASO PASAJERO (mínimo y limpio)
  if(sel === "PASAJERO"){
    turno = 1;          // viaje normal en km
    esGuardiaEspecial = false; // no es guardia
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

  const origen =
    document.getElementById("originTravels").value.trim();

  const destino =
    document.getElementById("destinationTravels").value.trim();

  const departureTime =
    document.getElementById("departureTimeTravels").value;

  const arrivalTime =
    document.getElementById("arrivalTimeTravels").value;

  const idaYVueltaAuto =
    document.getElementById("idaYVueltaAuto").checked;

  if(!servicioSeleccionado){
    alert("Seleccioná un servicio válido");
    return;
  }

  if(!origen || !destino){
    alert("Completá origen y destino");
    return;
  }

  if(!departureTime || !arrivalTime){
    alert("Ingresá hora de salida y llegada");
    return;
  }

  // === Cálculo de horas de la IDA ===
  const start = new Date(`2000-01-01T${departureTime}`);
  const end   = new Date(`2000-01-01T${arrivalTime}`);

  let hoursWorked = (end - start) / (1000 * 60 * 60);
  if (hoursWorked < 0) hoursWorked += 24;

  if (hoursWorked <= 0) {
    alert("La hora de llegada debe ser posterior a la de salida");
    return;
  }

  // ===== 1) GUARDAMOS LA IDA =====
  const ok = addTravel(
    origen,
    destino,
    servicioSeleccionado.turno,
    departureTime,
    arrivalTime,
    hoursWorked
  );

  if(!ok){
    alert("No se pudo guardar el viaje");
    return;
  }

  // Etiqueta UI
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimoViaje = ultima.travels[ultima.travels.length - 1];
  ultimoViaje.servicioUI = servicioSeleccionado.tipo;
  saveOrders(orders);

  // ===== 2) SI PIDIÓ VUELTA AUTOMÁTICA =====
  if(idaYVueltaAuto){

    // Calculamos hora sugerida de salida (5 min después)
    const salidaVuelta = arrivalTime;

    // Sugerimos misma duración que la ida
    const llegadaSugerida = new Date(
      new Date(`2000-01-01T${arrivalTime}`).getTime() +
      hoursWorked * 60 * 60 * 1000
    )
    .toISOString()
    .substring(11,16);

    // Cargamos formulario para la vuelta
    document.getElementById("originTravels").value = destino;
    document.getElementById("destinationTravels").value = origen;
    document.getElementById("departureTimeTravels").value = salidaVuelta;
    document.getElementById("arrivalTimeTravels").value = llegadaSugerida;

    // Recalculamos km con tu buscador ida/vuelta
    const kmCalculado = buscarKmRuta(destino, origen);
    document.getElementById("kmTravels").value = kmCalculado;

    alert("👉 Ahora registrá la VUELTA automática y guardá.");
    return; // NO volvemos al main
  }

  // ===== SI NO QUIERE VUELTA =====
  renderListaViajes();
  renderResumenDia();
  alert("Viaje guardado en la jornada");
  showScreen("mainScreen");
}


  // Guardamos etiqueta visible para la tabla
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimoViaje = ultima.travels[ultima.travels.length - 1];

  ultimoViaje.servicioUI = servicioSeleccionado.tipo; // TURNO / DIRECTO / PASAJERO / etc.
  saveOrders(orders);

  renderListaViajes();
  renderResumenDia();

  alert(`Viaje ${servicioSeleccionado.tipo} guardado en la jornada`);

  showScreen("mainScreen");
}

// =====================================================
// RESUMEN DEL DÍA
// =====================================================

function renderResumenDia(){
  const s = getTodaySummary(); // CORE

  // Calculamos cuántos viáticos hubo hoy sumando por orden
  const today = new Date().toISOString().split("T")[0];
  const ordersHoy = getOrders().filter(o => o.date === today);

  let totalViaticosHoy = 0;

  ordersHoy.forEach(o => {
    if (o) {
      const totales = calculateOrderTotals(o);
      totalViaticosHoy += totales.viaticos || 0;
    }
  });

  const resumen = `
    <p><b>Kilómetros totales:</b> ${s.kmTotal}</p>
    <p><b>Viajes con acoplado:</b> ${s.acoplados}</p>
    <p><b>Horas de guardia:</b> ${s.guardiasHoras.toFixed(2)}</p>
    <p><b>Viáticos generados hoy:</b> ${totalViaticosHoy}</p>
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
// CONTROL VISUAL DE DESCRIPCIÓN DE GUARDIA
// =====================================================

function manejarDescripcionGuardia(){
  const tipo = document.getElementById("tipoGuardia").value;
  const box = document.getElementById("boxDescripcionGuardia");

  if(tipo === "especial"){
    box.style.display = "block";
  } else {
    box.style.display = "none";
    document.getElementById("descripcionGuardia").value = "";
  }
}

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

  // ======= Manejo de descripción para guardia especial =======
  let descripcion = "";

  if(tipo === "especial"){
    descripcion = document.getElementById("descripcionGuardia").value.trim();

    if(!descripcion){
      alert("Si es guardia especial, debés completar la descripción");
      return;
    }
  }

  // 👉 Mandamos al CORE lo mínimo que espera (sin cambiar core)
  addGuard(tipo, horas);

  // 👉 Enriquecemos la última guardia con más datos útiles
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimaGuardia = ultima.guards[ultima.guards.length - 1];

  ultimaGuardia.descripcion = descripcion;
  ultimaGuardia.dia = dia;
  ultimaGuardia.inicio = inicio;
  ultimaGuardia.fin = fin;

  saveOrders(orders);

  renderResumenDia();
  renderListaGuardias();

  // ======= NUEVO: mensaje con viático en el alert =======
  const totals = calculateOrderTotals(o);
  const mensajeViatico =
    totals.viatico > 0
      ? "\n✅ Viático generado en esta jornada"
      : "\nℹ️ Aún sin viático";

  alert(
    `Guardia ${tipo} de ${horas.toFixed(2)} hs registrada` +
    mensajeViatico
  );

  showScreen("mainScreen");
}
// =====================================================
// LISTA DE VIAJES  (NUEVA VERSIÓN CON VIÁTICOS)
// =====================================================
function renderListaViajes(){
  const tbody =
    document.getElementById("listaViajesContainer");

  tbody.innerHTML = "";

  const orders = getOrders();
  if(!orders || orders.length === 0) return;

  const o = orders[orders.length - 1]; // última jornada activa
  if(!o.travels || o.travels.length === 0) return;

  // 👉 Viáticos calculados POR ORDEN desde el CORE
  const totalesOrden = calculateOrderTotals(o);
  const viaticosDeEstaOrden = totalesOrden.viatico || 0;

  o.travels.forEach((v,i) => {

    let servicioTexto = v.servicioUI;

    if(!servicioTexto){
      if(v.turno === 1) servicioTexto = "TURNO";
      if(v.turno === 2) servicioTexto = "SEMI";
      if(v.turno === 3) servicioTexto = "DIRECTO";
    }

    const esUltimoViaje = (i === o.travels.length - 1);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i+1}</td>

      <td>
        ${v.departureTime || new Date(v.createdAt).toLocaleTimeString()}
        -
        ${v.arrivalTime || ""}
      </td>

      <td>
        ${v.origen || "Montevideo"} → ${v.destino}
      </td>

      <td>${v.kmEmpresa}</td>

      <td>${servicioTexto}</td>

      <td>${v.acoplado ? "SI" : "NO"}</td>

      <td>
        ${
          esUltimoViaje && viaticosDeEstaOrden > 0
          ? `<span style="color:green;font-weight:bold;">
               💰 Viáticos: ${viaticosDeEstaOrden}
             </span>`
          : "—"
        }
      </td>
    `;

    tbody.appendChild(tr);
  });
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

    // 👉 Cálculo de KM por guardia (sin tocar el core)
    const kmGuardia =
      g.hours * (g.type === "especial" ? 40 : 30);

    // Formateo de horario (si existen inicio/fin)
    const horario =
      g.inicio && g.fin
        ? `${g.inicio} – ${g.fin}`
        : new Date(g.createdAt).toLocaleTimeString();

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${g.dia || new Date(g.createdAt).toLocaleDateString()}</td>
      <td>${horario}</td>
      <td>${g.hours.toFixed(2)}</td>
      <td>${kmGuardia.toFixed(0)} km</td>
      <td>${tipoTexto}</td>
      <td>${g.descripcion || "—"}</td>
    `;

    tbody.appendChild(tr);
  });
}










