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

  // 👉 LIMPIEZA TOTAL DEL FORMULARIO (clave)
  document.getElementById("originTravels").value = "Montevideo";
  document.getElementById("destinationTravels").value = "";
  document.getElementById("kmTravels").value = "";
  document.getElementById("numeroServicio").value = "";
  document.getElementById("departureTimeTravels").value = "";
  document.getElementById("arrivalTimeTravels").value = "";
  document.getElementById("idaYVueltaAuto").checked = false;

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
      mostrarHorariosOficiales(origenActual, m.destinoFinal);


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
    mostrarHorariosOficiales(origenActual, destinoFinal);


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
// GUARDAR VIAJE → CORE (VERSIÓN FINAL CORREGIDA)
// =====================================================

function addTravelUI(event){
  event.preventDefault();

  const o = getActiveOrder();
  if(!o){
    alert("No hay jornada activa");
    return;
  }

  // === CAPTURAMOS LA IDA DE FORMA SEGURA ===
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

  // Guardamos etiqueta UI del servicio (una sola vez)
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimoViaje = ultima.travels[ultima.travels.length - 1];
  ultimoViaje.servicioUI = servicioSeleccionado.tipo;
  saveOrders(orders);

  // ===== 2) SI PIDIÓ VUELTA AUTOMÁTICA =====
  if(idaYVueltaAuto){

    // 👉 CLAVE: congelamos la IDA para invertirla sin errores
    const origenIda = origen;
    const destinoIda = destino;

    const salidaVuelta = arrivalTime;

    const llegadaSugerida = new Date(
      new Date(`2000-01-01T${arrivalTime}`).getTime() +
      hoursWorked * 60 * 60 * 1000
    )
    .toISOString()
    .substring(11,16);

    // 👉 Invertimos usando valores seguros de la IDA
    document.getElementById("originTravels").value = destinoIda;
    document.getElementById("destinationTravels").value = origenIda;
    document.getElementById("departureTimeTravels").value = salidaVuelta;
    document.getElementById("arrivalTimeTravels").value = llegadaSugerida;

    // Recalculamos km correctamente
    const kmCalculado = buscarKmRuta(destinoIda, origenIda);
    document.getElementById("kmTravels").value = kmCalculado;

    // Mantenemos servicio y checkbox
    document.getElementById("numeroServicio").value =
      servicioSeleccionado.tipo;
    document.getElementById("idaYVueltaAuto").checked = true;

    alert("👉 Ahora registrá la VUELTA automática y guardá.");
    return; // NO volvemos al main
  }

  // ===== SI NO QUIERE VUELTA =====
  renderListaViajes();
  renderResumenDia();
  alert("Viaje guardado en la jornada");
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
// FLUJO DE ARRANQUE DEFINITIVO
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

  // ===== FLUJO DE ARRANQUE REAL (CON SPLASH) =====
  window.addEventListener("load", () => {
    setTimeout(() => {
      const driver = getDriver();

      console.log("ARRANQUE FINAL - driver:", driver);

      // 1) Limpiamos todas las pantallas
      document.querySelectorAll(".screen")
        .forEach(s => s.classList.remove("active"));

      // 2) Decidimos a dónde ir
      if (!driver) {
        console.log("→ Voy a LOGIN (primer uso)");
        document.getElementById("loginScreen")
          .classList.add("active");
      } else {
        console.log("→ Voy a MAIN (usuario ya existe)");
        document.getElementById("mainScreen")
          .classList.add("active");
      }

      // 3) FADE-OUT del splash (clave)
      const splash = document.getElementById("splashScreen");
      if (splash) {
        splash.classList.add("fade-out");

        setTimeout(() => {
          splash.style.display = "none";
        }, 400);
      }

    }, 600);
  });

}); // ✅ CIERRA DOMContentLoaded


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
// LISTA DE VIAJES  (COMPATIBLE CON TARJETAS)
// =====================================================
function renderListaViajes(){

  // Si ya estamos usando tarjetas, NO tocamos tablas:
  renderTarjetasPorDia();
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
// =====================================================
// 🔌 HOOK PARA FUTURA INTEGRACIÓN (GPS / TERMINAL / BACKEND)
// =====================================================
// Este método podrá ser llamado por:
// - Un módulo de geolocalización
// - Un backend de la empresa
// - Un sistema de terminales o MTOP

function cargarViajeRetornoAutomatico(data){

  console.log("📡 Recibiendo retorno automático:", data);

  // 1) Abrimos pantalla de viaje (si no está abierta)
  showScreen("travelScreen");

  // 2) Cargamos datos enviados por el sistema externo
  document.getElementById("originTravels").value = data.origen;
  document.getElementById("destinationTravels").value = data.destino;
  document.getElementById("departureTimeTravels").value = data.horaSalida;
  document.getElementById("arrivalTimeTravels").value = data.horaLlegadaEstimada;

  // 3) Mapeamos servicio si viene
  if(data.servicio){
    document.getElementById("numeroServicio").value = data.servicio;
    actualizarInfoServicio(); // sincroniza con UI → CORE
  }

  // 4) Recalculamos km con tu lógica actual
  const km = buscarKmRuta(data.origen, data.destino);
  document.getElementById("kmTravels").value = km;

  // 5) Mensaje visual claro para el chofer
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
  form.prepend(aviso);
}
// =====================================================
// HORARIOS OFICIALES (UI - SOLO SUGERENCIAS EDITABLES)
// =====================================================
function mostrarHorariosOficiales(origen, destino){
  const ruta = `${origen} → ${destino}`;
  const horarios = SCHEDULE_COT[ruta];
  const box = document.getElementById("horariosOficiales");

  if(!horarios){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  // --- CABECERA ---
  box.innerHTML = "<b>Horarios COT sugeridos:</b>";

  // --- CONTENEDOR EN UNA SOLA LÍNEA DESLIZABLE ---
  box.style.display = "flex";
  box.style.flexDirection = "row";
  box.style.gap = "8px";
  box.style.overflowX = "auto";      // permite deslizar horizontalmente
  box.style.whiteSpace = "nowrap";   // evita saltos de línea
  box.style.padding = "8px 4px";
  box.style.alignItems = "center";

  // Limpiamos solo botones previos (dejamos el título)
  const oldButtons = box.querySelectorAll("button");
  oldButtons.forEach(b => b.remove());

  // --- BOTONES DE HORARIOS (EN FILA) ---
  horarios.forEach(h => {
    const btn = document.createElement("button");
    btn.type = "button";                // 🔑 evita submit del formulario
    btn.textContent = `${h.salida} → ${h.llegada}`;

    // Estilo compacto y prolijo
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "6px";
    btn.style.border = "1px solid #ccc";
    btn.style.background = "#f5f5f5";
    btn.style.cursor = "pointer";
    btn.style.whiteSpace = "nowrap";    // clave para que no se parta el texto

    btn.onclick = () => {
      document.getElementById("departureTimeTravels").value = h.salida;
      document.getElementById("arrivalTimeTravels").value = h.llegada;
    };

    box.appendChild(btn);
  });
}
function renderTarjetasGuardiasPorDia(){
  const container = document.getElementById("cardsGuardiasContainer");
  container.innerHTML = "";

  const orders = getOrders();
  if(!orders || orders.length === 0) return;

  // Agrupar guardias por fecha
  const porDia = {};

  orders.forEach(o => {
    const d = o.date;
    if(!porDia[d]) porDia[d] = [];
    porDia[d].push(o);
  });

  // Últimos 5 días por defecto
  const fechas = Object.keys(porDia)
    .sort((a,b) => new Date(b) - new Date(a))
    .slice(0,5);

  fechas.forEach(fecha => {

    const listaGuardias = [];

    porDia[fecha].forEach(o => {
      o.guards.forEach(g => {
        listaGuardias.push(
          `${g.inicio || "--:--"} – ${g.fin || "--:--"} | ` +
          `${g.hours.toFixed(2)} h | ${g.type}` +
          (g.desc ? ` (${g.desc})` : "")
        );
      });
    });

    const card = document.createElement("div");
    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
    `;

    card.innerHTML = `
      <b>📅 ${fecha}</b><br><br>
      <b>Guardias:</b><br>
      ${listaGuardias.join("<br>") || "—"}
    `;

    container.appendChild(card);
  });
}
// =====================================================
// TARJETAS DE VIAJES POR DÍA (ESTILO MOBILE)
// =====================================================
function renderTarjetasPorDia(){
  const container = document.getElementById("cardsViajesContainer");
  if(!container){
    console.warn("No existe #cardsViajesContainer");
    return;
  }

  container.innerHTML = "";

  const orders = getOrders();
  if(!orders || orders.length === 0) return;

  // Agrupar por fecha
  const porDia = {};

  orders.forEach(o => {
    const d = o.date;
    if(!porDia[d]) porDia[d] = [];
    porDia[d].push(o);
  });

  // Mostrar últimos 5 días por defecto
  const fechas = Object.keys(porDia)
    .sort((a,b) => new Date(b) - new Date(a))
    .slice(0,5);

  fechas.forEach(fecha => {

    let kmDia = 0;
    let viaticosDia = 0;
    let montoDia = 0;

    const listaViajes = [];

    porDia[fecha].forEach(o => {
      const tot = calculateOrderTotals(o);
      kmDia += tot.kmTotal || 0;
      viaticosDia += tot.viaticos || 0;
      montoDia += tot.monto || 0;

      o.travels.forEach(v => {
        listaViajes.push(
          `${v.origen} → ${v.destino} ` +
          `${v.departureTime}-${v.arrivalTime} ` +
          `${v.acoplado ? "(Acoplado)" : "(Sin acoplado)"}`
        );
      });
    });

    const card = document.createElement("div");
    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
    `;

    card.innerHTML = `
      <b>📅 ${fecha}</b><br>
      <b>KM del día:</b> ${Math.round(kmDia)} km<br>
      <b>Viáticos:</b> ${viaticosDia}<br>
      <b>Monto del día:</b> $${Math.round(montoDia)}<br><br>

      <b>Viajes:</b><br>
      ${listaViajes.join("<br>") || "—"}
    `;

    container.appendChild(card);
  });
}















