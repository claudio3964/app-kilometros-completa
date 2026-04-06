
console.log("CORE v2 - CONSISTENCIA + VALIDACIONES( ESTE ES EL CORE COMPLETO )");
"use strict";
// =====================================================
// 🔍 VALIDACIÓN DE CONSISTENCIA (NO BLOQUEANTE)
// =====================================================
function validarConsistenciaOrder(order, opciones = {}) {

  const { strict = false } = opciones;

  const errores = [];

  if (!order) {
    errores.push('Order inexistente');
    return manejarResultado();
  }

  const viajes = order.travels || [];
  const guardias = order.guards || [];

  const viajesEnCurso = viajes.filter(v => v.status === 'en_curso');
  const guardiasEnCurso = guardias.filter(g => g.status === 'en_curso');

  // 🚫 múltiples viajes
  if (viajesEnCurso.length > 1) {
    errores.push(`Hay ${viajesEnCurso.length} viajes en curso`);
  }

  // 🚫 múltiples guardias
  if (guardiasEnCurso.length > 1) {
    errores.push(`Hay ${guardiasEnCurso.length} guardias en curso`);
  }

  // 🚫 viaje + guardia
  if (viajesEnCurso.length && guardiasEnCurso.length) {
    errores.push("Viaje y guardia simultáneos");
  }

  // 🚫 guardias incompletas
  guardias.forEach(g => {
    if (g.status === "finalizada") {
      if (!g.fin || g.hours == null || g.kmGuardia == null) {
        errores.push(`Guardia incompleta: ${g.id || "sin id"}`);
      }
    }
  });

  // 🚫 viajes incompletos
  viajes.forEach(v => {
    if (v.status === "finalizado") {
      if (!v.arrivalTime || v.kmEmpresa == null) {
        errores.push(`Viaje inválido: ${v.id}`);
      }
    }
  });

  return manejarResultado();

  function manejarResultado() {
    if (errores.length === 0) return true;

    console.warn("⚠️ Validación:", errores);

    if (strict) {
      console.error("⛔ ERROR CRÍTICO");
      return false;
    }

    return false;
  }
}

window.validarConsistenciaOrder = validarConsistenciaOrder;
// =====================================================
// RELOJ CENTRAL
// =====================================================
function ahoraSistema(){
  return Date.now() + (window.TIME_OFFSET || 0);
}
/* ================================
   COT DRIVER CORE ENGINE v1.2
   (viáticos por jornada real,
    usando horas de viajes + guardias)
================================ */

// ===== CONFIG =====
const LAUDO_KM = 7.6370;
const GUARDIA_COMUN_KM_HORA = 30;
const GUARDIA_ESPECIAL_KM_HORA = 40;
const TOME_CESE_KM = 42.5;
const ACOPLADO_EXTRA_KM = 30;

const TIPOS_SERVICIO = {
  TURNO:       { tomeCese: true,  acoplado: false, km: true },
  SEMIDIRECTO: { tomeCese: true,  acoplado: false, km: true },
  DIRECTO:     { tomeCese: true,  acoplado: true,  km: true },
  DIRECTISIMO: { tomeCese: true,  acoplado: true,  km: true },
  EXPRESO:     { tomeCese: true,  acoplado: false, km: true },
  CONTRATADO:  { tomeCese: true,  acoplado: false, km: true },
  PASAJERO:    { tomeCese: false, acoplado: false, km: true }
};
window.TIPOS_SERVICIO = TIPOS_SERVICIO;

// ===== REGLA DE ACOPLADOS =====
function calcularAcopladoKm(tipoServicio, destino){
  const tipo = (tipoServicio || "").toUpperCase().trim();
  const config = TIPOS_SERVICIO[tipo];
  if(!config || !config.acoplado) return 0;
  const d = (destino || "").toLowerCase().trim();
  if(d === "chuy") return 0;
  if(d.includes("la pedrera")) return 37.5;
  return ACOPLADO_EXTRA_KM;
}
window.calcularAcopladoKm = calcularAcopladoKm;

const MONTO_VIATICO = 455;

// ===== RUTAS EMPRESA =====
const ROUTES_CATALOG = {

  // -------- PUNTA DEL ESTE --------
  "Montevideo → Punta del Este": 140,
  "Montevideo → Punta del Este x Piriápolis": 145,
  "Montevideo → Punta del Este x Pan de Azúcar y San Carlos": 155,
  "Montevideo → Punta del Este x Ruta 8 y 9": 165,

  // -------- COSTA ESTE --------
  "Montevideo → Laguna Garzón": 183,
  "Montevideo → Punta Negra": 112,
  "Montevideo → Piriápolis": 97,
  "Montevideo → La Pedrera": 250,
  "Montevideo → La Paloma": 280,

  // -------- LARGA DISTANCIA --------
  "Montevideo → Chuy": 345,
  "Montevideo → Colonia": 178,

  // -------- TRAMOS CORTOS --------
  "Punta del Este → Piriápolis": 48,
  "Punta del Este → La Pedrera": 150,
  "Punta del Este → Chuy": 235,
  "Piriápolis → Cuchilla Alta": 30,
  "Punta del Este → San Carlos (alcance)": 30
};

// ===== STORAGE =====
const Storage = {
  get(k, f=null){ return JSON.parse(localStorage.getItem(k)) ?? f; },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  remove(k){ localStorage.removeItem(k); }
};

// ===== DRIVER =====
function getDriver(){ return Storage.get("driverProfile"); }

// ===== ORDERS =====
function getOrders(){ return Storage.get("orders",[]); }
function saveOrders(l){ Storage.set("orders",l); }

// ===== ORDER NUMBER =====
function generateOrderNumber(){

  const driver = getDriver() || { legajo: "0000" };

  const legajo = driver.legajo;

  const hoy = new Date();

  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2,"0");
  const dd = String(hoy.getDate()).padStart(2,"0");

  const fecha = `${yyyy}${mm}${dd}`;

  return `${legajo}-${fecha}`;
}


// ===== ACTIVE ORDER =====
function getActiveOrder(){

  const active = Storage.get("activeOrder");
  if(!active) return null;

  const orders = getOrders();

  const real = orders.find(
    o => o.orderNumber === active.orderNumber && !o.closed
  );

  if(!real){

    // limpiar activeOrder corrupto
    clearActiveOrder();

    return null;
  }

  return real;
}
function setActiveOrder(o){ Storage.set("activeOrder",o); }
function clearActiveOrder(){ Storage.remove("activeOrder"); }

// ===== CREATE ORDER =====
function createOrder(){
  if (getActiveOrder()) {
  throw new Error("YA_EXISTE_JORNADA_ACTIVA");
}


  const driver = getDriver() || {legajo:"0000", base:"Montevideo"};

  const o = {
    orderNumber: generateOrderNumber(),   // 👈 orden limpia
    legajo: driver.legajo,                // 👈 guardamos legajo aparte
    baseInicio: driver.base || "Montevideo",
    date: new Date().toISOString().split("T")[0],
    travels: [],
    guards: [],
    closed: false,
    tomeCeseGenerado: false,
    createdAt: ahoraSistema(),
    syncStatus: "local"
  };

  const all = getOrders();
  all.push(o);
  saveOrders(all);
  setActiveOrder(o);
  return o;
}


// =====================================================
// CERRAR JORNADA (VERSIÓN PROFESIONAL CON SNAPSHOT)
// =====================================================

function closeActiveOrder(){

  const order = getActiveOrder();

  if(!order) return null;

  // evitar doble cierre
  if(order.status === "finalizada"){
    return order;
  }

  // calcular totales finales desde CORE
  const totals = calculateOrderTotals(order);

  // congelar snapshot contable
  order.totalsSnapshot = {

    kmViajes: totals.kmViajes,
    kmGuardias: totals.kmGuardias,
    kmTomeCese: totals.kmTomeCese,
    kmAcoplados: totals.kmAcoplados,
    kmTotal: totals.kmTotal,

    viaticos: totals.viaticos,

    monto: totals.monto,

    cerradoAt: ahoraSistema()

  };

  // marcar estado final
  order.syncStatus = "pending";
  order.status = "finalizada";

  order.closed = true;

  order.closedAt = ahoraSistema();

  // guardar en storage
  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  // limpiar activeOrder
  clearActiveOrder();

  console.log("Jornada finalizada:", order.orderNumber);

  return order;

}
// =====================================================
// cortar guardias antes de viajes
// =====================================================
function cortarGuardiaAntesDeViaje(order, departureTime){

  if(!order.guards || order.guards.length === 0)
    return;

  const ultima = order.guards[order.guards.length - 1];

  if(!ultima.inicio || ultima.fin)
    return;

  const [h,m] = departureTime.split(":").map(Number);

  const corte = new Date();
  corte.setHours(h,m,0,0);
  corte.setMinutes(corte.getMinutes() - 15);

  ultima.fin = corte.toTimeString().substring(0,5);

  // Recalcular horas y km
  const inicioNorm = normalizarHora(ultima.inicio);
  const [hI, mI] = inicioNorm.split(":").map(Number);
  const [hF, mF] = ultima.fin.split(":").map(Number);
  const horas = (hF + mF/60) - (hI + mI/60);

  ultima.hours = horas > 0 ? horas : 0;
  ultima.kmGuardia = ultima.hours * (ultima.type === "especial" ? 40 : 30);
  ultima.viatico = ultima.hours >= 9;
  ultima.status = "finalizada";
  ultima.cortadaAuto = true;

  // Guardar en storage
  const orders = getOrders();
  saveOrders(orders.map(o =>
    o.orderNumber === order.orderNumber ? order : o
  ));
  setActiveOrder(order);

  console.log("Guardia cortada:", ultima.inicio, "→", ultima.fin, "|", ultima.hours.toFixed(2), "h");
}
// =====================================================
// HELPER: TOME Y CESE — asigna una sola vez por jornada
// =====================================================
function _asignarTomeCeseSiCorresponde(order, travel){
  if(order.tomeCeseGenerado) return;
  const config = TIPOS_SERVICIO[(travel.tipoServicio || "").toUpperCase().trim()];
  if(!config || !config.tomeCese) return;
  travel.tomeCese = true;
  order.tomeCeseGenerado = true;
  console.log("Tome y Cese asignado:", travel.id, travel.tipoServicio);
}

// =====================================================
// VIAJES (CORE OFICIAL CON KM AUTO + TIPO + ACOPLADO)
// =====================================================
function addTravel(
  origen,
  destino,
  turno,
  departureTime,
  arrivalTime,
  hoursWorked,
  tipo = turno,        // ← FIX
  acoplado = false,    // ← FIX
  coche = null
){

  if(existeViajeEnCurso()){

    console.warn("No se puede programar viaje: hay uno en curso");

    return false;
  }

  const order = getActiveOrder();
  if(!order) return false;
cortarGuardiaAntesDeViaje(order, departureTime);
  const ahora = ahoraSistema();
const [h, m] = departureTime.split(":").map(Number);

const inicioDesdeHorario = new Date();
inicioDesdeHorario.setHours(h, m, 0, 0);

const inicioTimestamp = inicioDesdeHorario.getTime();
  const kmEmpresa =
    buscarKmRuta(origen, destino) || 0;

  const travel = {

  id: "TRV-" + ahora,

  origen,
  destino,

  turno,
  tipoServicio: tipo,   // ← FIX correcto

  departureTime,
  arrivalTime,

  kmEmpresa,
  kmAuto: kmEmpresa,

  hoursWorked,

  createdAt: ahora,

  status: "en_curso",
  inicioReal: inicioTimestamp,
departureTimestamp: inicioTimestamp,

  llegadaEstimada:
    ahora + (hoursWorked * 60 * 60 * 1000),

  acoplado: acoplado,   // ← FIX correcto
  acopladoKm: calcularAcopladoKm(tipo, destino),

  coche: coche ?? null,

  tomeCese: false,
  syncStatus: "local"
};

  if(!order.travels)
    order.travels = [];

  _asignarTomeCeseSiCorresponde(order, travel);

  order.travels.push(travel);

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  setActiveOrder(order);

  console.log("Viaje iniciado:", travel);

  return true;
}
// =====================================================
// VIAJE PROGRAMADO (EXTENSIÓN SEGURA DEL CORE)
// =====================================================

function addTravelProgramado(
  origen,
  destino,
  turno,
  departureTime,
  arrivalTime,
  hoursWorked,
  tipo = turno,
  acoplado = false,
  coche = null
){

  const order = getActiveOrder();
  if(!order) return false;

  const ahora = ahoraSistema();

  const kmEmpresa =
    buscarKmRuta(origen, destino) || 0;

  const hoy = new Date();

  const [h, m] =
    departureTime.split(":").map(Number);

  const inicioProgramado =
    new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      h,
      m,
      0,
      0
    ).getTime();

 const travel = {

  id: "TRV-" + ahora,

  origen,
  destino,

  turno,
  tipoServicio: tipo,

  departureTime,
  arrivalTime,

  kmEmpresa,
  kmAuto: kmEmpresa,

  hoursWorked,

  createdAt: ahora,

  status: "programado",      // ← FIX CRITICO
  inicioProgramado,
  inicioReal: null,          // ← FIX CRITICO

  llegadaEstimada:
    inicioProgramado +
    (hoursWorked * 60 * 60 * 1000),

  acoplado: acoplado,
  acopladoKm: calcularAcopladoKm(tipo, destino),

  coche: coche ?? null,

  tomeCese: false,
  syncStatus: "local"
};

  if(!order.travels)
    order.travels = [];

  _asignarTomeCeseSiCorresponde(order, travel);

  order.travels.push(travel);

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  setActiveOrder(order);

  return true;
}
// =====================================================
// MOTOR DE VIAJES PROGRAMADOS
// =====================================================

function verificarViajesProgramados(){

  const order = getActiveOrder();
  if(!order || !order.travels) return;

  const ahora = ahoraSistema();

  let cambio = false;

order.travels.forEach((travel, index) => {
    if(
      travel.status === "programado"
      &&
      travel.inicioProgramado
      &&
      travel.inicioProgramado <= ahora
    ){

      travel.status = "en_curso";
travel.inicioReal = ahora;

// ✂️ CORTE AUTOMÁTICO DE GUARDIA
if(order.guards){

  const guardiaActiva = order.guards.find(
    g => g.status === "en_curso"
  );

  if(guardiaActiva){

    console.log("✂️ Guardia activa detectada:", guardiaActiva);

    const fechaViaje = new Date(travel.inicioReal);

    fechaViaje.setMinutes(fechaViaje.getMinutes() - 15);

    const hh = String(fechaViaje.getHours()).padStart(2, "0");
    const mm = String(fechaViaje.getMinutes()).padStart(2, "0");

    const horaCorte = `${hh}:${mm}`;

    const toMin = (hhmm) => {
  const [h,m] = hhmm.split(":").map(Number);
  return h*60 + m;
};

if(toMin(horaCorte) > toMin(guardiaActiva.inicio)){

      const [hI, mI] = guardiaActiva.inicio.split(":").map(Number);
      const [hF, mF] = horaCorte.split(":").map(Number);

      let horas = (hF + mF/60) - (hI + mI/60);
      if(horas < 0) horas += 24;

      guardiaActiva.fin = horaCorte;
      guardiaActiva.hours = horas;
      guardiaActiva.status = "finalizada";
      guardiaActiva.cortadaAuto = true;

      guardiaActiva.kmGuardia =
        horas * (guardiaActiva.type === "especial" ? 40 : 30);

      guardiaActiva.viatico = horas >= 9;

      console.log("✅ Guardia cortada automáticamente:", guardiaActiva);

    }
  }
}

      // =====================================================
      // TOME Y CESE — primer viaje elegible de la jornada
      // =====================================================
      _asignarTomeCeseSiCorresponde(order, travel);

      cambio = true;

      console.log(
        "Viaje iniciado automáticamente:",
        travel.id
      );
    }

  });

  if(cambio){

    saveOrders(
      getOrders().map(o =>
        o.orderNumber === order.orderNumber
          ? order
          : o
      )
    );

    setActiveOrder(order);

  }

}

function calcularHorasJornada(o){

  if(!o) return 0;

  let totalMinutos = 0;

  // ================================
  // VIAJES FINALIZADOS
  // ================================
  if(o.travels){
    o.travels.forEach(t => {
      if(t.status === "finalizado" && t.duracionMinutos){
        totalMinutos += t.duracionMinutos;
      }
    });
  }

  // ================================
  // GUARDIAS
  // ================================
  if(o.guards){
    o.guards.forEach(g => {

      if(g.inicio && g.fin){

        const [h1,m1] = normalizarHora(g.inicio).split(":").map(Number);
        const [h2,m2] = normalizarHora(g.fin).split(":").map(Number);

        let inicioMin = h1*60 + m1;
        let finMin    = h2*60 + m2;

        // soporte cruce medianoche
        if(finMin < inicioMin){
          finMin += 24*60;
        }

        totalMinutos += (finMin - inicioMin);
      }

    });
  }

  return totalMinutos / 60;
}
// =====================================================
// 🆕 VIÁTICOS POR JORNADA (regla empresarial)
// =====================================================
function determinarViatico(o){

  if(!o) return 0;

  const horasJornada = calcularHorasJornada(o);
  if(horasJornada <= 0) return 0;
  const fechaBase = new Date(o.date + "T00:00:00").getTime();

  const eventosInicio = [];
  const eventosFin = [];

  // ================================
  // VIAJES FINALIZADOS
  // ================================
  const viajes = (o.travels || []).filter(t =>
    t.status === "finalizado" &&
    t.inicioReal &&
    t.llegadaReal
  );

  viajes.forEach(v => {
    eventosInicio.push({
      tipo: "viaje",
      timestamp: v.inicioReal,
      tomeCese: v.tomeCese === true
    });

    eventosFin.push(v.llegadaReal);
  });

  // ================================
  // GUARDIAS (finalizadas y en_curso)
  // ================================
  (o.guards || []).forEach(g => {

    if(!g.inicio) return;

    const [hI,mI] = normalizarHora(g.inicio).split(":").map(Number);

    let inicioMs = fechaBase + ((hI * 60 + mI) * 60 * 1000);

    let finMs;

    if(g.fin){
      const [hF,mF] = normalizarHora(g.fin).split(":").map(Number);
      finMs = fechaBase + ((hF * 60 + mF) * 60 * 1000);
    } else {
      // guardia en_curso: usar hora actual como fin provisional
      finMs = ahoraSistema();
    }

    // soporte cruce medianoche
    if(finMs < inicioMs){
      finMs += 24 * 60 * 60 * 1000;
    }

    eventosInicio.push({
      tipo: "guardia",
      timestamp: inicioMs,
      tomeCese: false
    });

    eventosFin.push(finMs);

  });

  if(eventosInicio.length === 0)
    return 0;

  // ================================
  // INICIO Y FIN REAL DE JORNADA
  // ================================

  eventosInicio.sort((a,b)=>a.timestamp-b.timestamp);

  let inicioReal = eventosInicio[0].timestamp;
  const finReal = Math.max(...eventosFin);

  // Aplicar Tome y Cese SOLO si el primer evento es viaje con tomeCese
  if(
    eventosInicio[0].tipo === "viaje" &&
    eventosInicio[0].tomeCese
  ){
    inicioReal -= (45 * 60 * 1000);
  }

  const fecha = new Date(inicioReal);

  const franja14 = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    14,0,0,0
  ).getTime();

  const franja23 = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    23,0,0,0
  ).getTime();

  const TRES_Y_MEDIA = 3.5 * 60 * 60 * 1000;

  let viaticos = 0;

  // ================================
  // FRANJA 14
  // ================================
  if(inicioReal <= franja14 && finReal >= franja14){
    if((franja14 - inicioReal) >= TRES_Y_MEDIA){
      viaticos++;
    }
  }

  // ================================
  // FRANJA 23
  // ================================
  if(inicioReal <= franja23 && finReal >= franja23){
    if((franja23 - inicioReal) >= TRES_Y_MEDIA){
      viaticos++;
    }
  }

  // ================================
  // PISO MÍNIMO ≥9h
  // ================================
  if(viaticos === 0 && horasJornada >= 9){
    viaticos = 1;
  }

  return viaticos;
}
// =====================================================
// TOTALES DE LA ORDEN (VERSIÓN PROFESIONAL CON SNAPSHOT)
// =====================================================
function calculateOrderTotals(o){

  if(!o){
    return {
      kmViajes: 0,
      kmAcoplados: 0,
      kmGuardias: 0,
      kmTomeCese: 0,
      kmTotal: 0,
      monto: 0,
      viaticos: 0
    };
  }

  // =====================================================
  // USAR SNAPSHOT SI LA ORDEN ESTÁ FINALIZADA
  // =====================================================

  if(o.status === "finalizada" && o.totalsSnapshot){

    return {
      kmViajes: o.totalsSnapshot.kmViajes,
      kmAcoplados: o.totalsSnapshot.kmAcoplados,
      kmGuardias: o.totalsSnapshot.kmGuardias,
      kmTomeCese: o.totalsSnapshot.kmTomeCese,
      kmTotal: o.totalsSnapshot.kmTotal,
      monto: o.totalsSnapshot.monto,
      viaticos: o.totalsSnapshot.viaticos
    };

  }

  // =====================================================
  // CÁLCULO NORMAL (ORDEN ACTIVA)
  // =====================================================

  let kmViajes = 0;
  let kmAcoplados = 0;
  let kmGuardias = 0;

  if(o.travels){

   o.travels.forEach(t => {

  if(!t) return;

  // ignorar cancelados y programados
  if(t.status === "cancelado" || t.status === "programado")
    return;

  const km = t.kmEmpresa ?? t.kmAuto ?? 0;

  kmViajes += Number(km);

  if(t.acopladoKm)
    kmAcoplados += Number(t.acopladoKm);
  else if(t.acoplado)
    kmAcoplados += ACOPLADO_EXTRA_KM;

});

  }

  if(o.guards){

    o.guards.forEach(g => {

      if(!g) return;

      const kmHora =
        g.type === "especial"
          ? GUARDIA_ESPECIAL_KM_HORA
          : GUARDIA_COMUN_KM_HORA;

      kmGuardias += Number(g.hours || 0) * kmHora;

    });

  }

  // Tome y Cese automático en el primer viaje válido

let kmTomeCese = 0;

if(o.travels){

  const primerViaje = o.travels.find(
  t => t && t.status !== "cancelado" && t.status !== "programado"
);
  

  if(primerViaje){
    kmTomeCese = TOME_CESE_KM;
  }

}

  // Total km
  const kmTotal =
    kmViajes +
    kmAcoplados +
    kmGuardias +
    kmTomeCese;

  // Cálculo monetario
  const montoKm = kmTotal * LAUDO_KM;

  const cantidadViaticos =
    determinarViatico(o);

  const viaticoMonto =
    cantidadViaticos * MONTO_VIATICO;

  return {

    kmViajes,
    kmAcoplados,
    kmGuardias,
    kmTomeCese,

    kmTotal,

    monto: montoKm + viaticoMonto,

    viaticos: cantidadViaticos

  };

}

// ===== SUMMARY DEL DÍA =====
function getTodaySummary(){
  const today=new Date().toISOString().split("T")[0];
  const orders=getOrders().filter(o=>o.date===today);

  let s={kmTotal:0,acoplados:0,guardiasHoras:0,monto:0};

  orders.forEach(o=>{
    const c=calculateOrderTotals(o);
    s.kmTotal+=c.kmTotal;
    s.monto+=c.monto;
    s.acoplados+=o.travels.filter(t=>t.acoplado).length;
    s.guardiasHoras+=o.guards.reduce((a,g)=>a+g.hours,0);
  });

  return s;
}

// ===== DRIVER REG =====
function initDriverProfile(d){
  const existing = Storage.get("driverProfile");

  if(existing){
    console.warn("Driver ya registrado:", existing);
    alert("Este dispositivo ya tiene un chofer registrado");
    return false;
  }

  Storage.set("driverProfile", {
    ...d,
    createdAt: ahoraSistema()
  });

  return true;
}
// ------función para obtener viaje en curso------
function getTravelEnCurso(){

  const order = getActiveOrder();

  if(!order || !order.travels) return null;

  return order.travels.find(t => t.status === "en_curso") || null;
}
// ------función para finalizar viaje------
function finalizarViajeActual(){

  const order = getActiveOrder();
  if(!order) return null;

  const travel = order.travels.find(
    t => t.status === "en_curso"
  );

  if(!travel) return null;

  // ====================================
  // FIJAR HORA DE LLEGADA DECLARADA
  // ====================================

  if(!travel.arrivalTime){

    const ahora = new Date();

    const hh = String(ahora.getHours()).padStart(2,"0");
    const mm = String(ahora.getMinutes()).padStart(2,"0");

    travel.arrivalTime = `${hh}:${mm}`;
  }

  // ====================================
  // CALCULAR DURACIÓN DESDE HORAS DECLARADAS
  // ====================================

  const convertirHoraAMin = (hhmm)=>{
    const [h,m] = hhmm.split(":").map(Number);
    return h*60 + m;
  };

  const salidaMin = convertirHoraAMin(travel.departureTime);
  const llegadaMin = convertirHoraAMin(travel.arrivalTime);

  let duracion = llegadaMin - salidaMin;

  // Soporte cruce medianoche
  if(duracion < 0){
    duracion += 24 * 60;
  }

  travel.duracionMinutos = duracion;

  // ====================================
  // CERRAR VIAJE
  // ====================================

  travel.status = "finalizado";

  // llegadaReal se puede mantener solo como referencia técnica
  travel.llegadaReal = ahoraSistema();

  // ====================================
  // GUARDAR CAMBIOS
  // ====================================

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  setActiveOrder(order);

  // ====================================
  // REGISTRAR ESTADÍSTICA CONTABLE
  // ====================================

  if(typeof registrarEstadisticaViaje === "function"){
    registrarEstadisticaViaje(travel);
  }

  return travel;
}
// =====================================================
// COMPATIBILIDAD — mantener función vieja
// =====================================================

function getTravelEnCurso(){

  const order = getActiveOrder();

  if(!order || !order.travels)
    return null;

  return order.travels.find(
    t => t.status === "en_curso"
  ) || null;

}
function existeViajeEnCurso(){

  const order = getActiveOrder();

  if(!order || !order.travels) return false;

  return order.travels.some(
    t => t.status === "en_curso"
  );
}
// =====================================================
// CANCELAR VIAJE POR ID (PROFESIONAL)
// =====================================================

function cancelarViajePorId(travelId){

  const order = getActiveOrder();

  if(!order || !order.travels)
    return null;

  const travel =
    order.travels.find(
      t => t.id === travelId
    );

  if(!travel)
    return null;

  // evitar cancelar si ya está cancelado
  if(travel.status === "cancelado")
    return travel;

  travel.status = "cancelado";
  travel.canceladoAt = ahoraSistema();
  travel.acoplado = false;
  travel.acopladoKm = 0;

  // Si ya no queda ningún viaje activo con tomeCese, liberar el flag
  const quedaTomeCese = order.travels.some(
    t => t.status !== "cancelado" && t.tomeCese === true
  );
  if(!quedaTomeCese){
    order.tomeCeseGenerado = false;
  }

  // guardar cambios
  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  setActiveOrder(order);

  console.log(
    "Viaje cancelado:",
    travel.id
  );

  return travel;

}
function generateMonthlySummary(month, year){

  const orders = getOrders();

  const result = {
    month,
    year,
    totalKm: 0,
    totalViaticos: 0,
    totalImporte: 0,
    totalJornadas: 0,
    days: []
  };

  if(!orders || orders.length === 0) return result;

  const daysMap = {};

  orders.forEach(order => {

    if(!order.closed) return;

    const d = new Date(order.date);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();

    if(m !== month || y !== year) return;

    const t = calculateOrderTotals(order);

    result.totalKm += t.kmTotal || 0;
    result.totalViaticos += t.viaticos || 0;
    result.totalImporte += t.monto || 0;
    result.totalJornadas += 1;

    const dateKey = order.date;

    // 🔹 INIT
    if(!daysMap[dateKey]){
      daysMap[dateKey] = {
        date: dateKey,
        km: 0,
        viaticos: 0,
        importe: 0,
        jornadas: 0,

        // 🆕 operativos
        viajes: 0,
        guardias: 0,
        tomeCese: false
      };
    }

    // 🔹 ACUMULAR CORE
    daysMap[dateKey].km += t.kmTotal || 0;
    daysMap[dateKey].viaticos += t.viaticos || 0;
    daysMap[dateKey].importe += t.monto || 0;
    daysMap[dateKey].jornadas += 1;

    // 🔹 ACUMULAR OPERATIVO
    daysMap[dateKey].viajes += (order.travels?.length || 0);
    daysMap[dateKey].guardias += (order.guards?.length || 0);

    // 🔹 TOME Y CESE
    const tieneTomeCese =
      order.travels?.some(t => t.tomeCese);

    if(tieneTomeCese){
      daysMap[dateKey].tomeCese = true;
    }

  });

  result.days = Object.values(daysMap)
    .sort((a,b)=> new Date(b.date) - new Date(a.date));

  return result;
}

// =====================================================
// AGREGAR GUARDIA A LA JORNADA ACTIVA
// =====================================================
function addGuard(tipo, inicio, dia, descripcion){

  const TIPOS_VALIDOS = ["comun", "especial"];

  if(!TIPOS_VALIDOS.includes(tipo)){
    throw new Error(`GUARDIA_TIPO_INVALIDO: "${tipo}". Valores válidos: comun, especial`);
  }

  if(!/^\d{2}:\d{2}$/.test(inicio)){
    throw new Error(`GUARDIA_INICIO_INVALIDO: "${inicio}". Formato esperado: HH:mm`);
  }

  if(tipo === "especial" && !(descripcion || "").trim()){
    throw new Error("GUARDIA_DESCRIPCION_REQUERIDA: la guardia especial requiere descripción");
  }

  let order = getActiveOrder();
  if(!order){
    order = createOrder();
  }

  if(!order.guards){
    order.guards = [];
  }

  const guardia = {
    id: "GRD-" + ahoraSistema(),
    type: tipo,
    inicio,
    dia: dia || order.date,
    descripcion: descripcion || null,
    fin: null,
    hours: 0,
    kmGuardia: 0,
    viatico: false,
    status: "en_curso",
    createdAt: ahoraSistema(),
    syncStatus: "local"
  };

  order.guards.push(guardia);

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber ? order : o
    )
  );

  setActiveOrder(order);

  console.log("Guardia iniciada:", guardia);

  return guardia;
}
window.addGuard = addGuard;

// =====================================================
// FINALIZAR GUARDIA POR createdAt
// =====================================================
function finalizarGuardia(createdAt){

  const order = getActiveOrder();
  if(!order || !order.guards)
    throw new Error("GUARDIA_NO_ENCONTRADA");

  const g = order.guards.find(
    g => String(g.createdAt) === String(createdAt)
  );

  if(!g)
    throw new Error("GUARDIA_NO_ENCONTRADA");

  const ahora = new Date();
  const fin = String(ahora.getHours()).padStart(2,"0") + ":" +
              String(ahora.getMinutes()).padStart(2,"0");

  const [hI, mI] = g.inicio.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);

  let horas = (hF + mF / 60) - (hI + mI / 60);
  if(horas < 0) horas += 24; // cruce medianoche

  g.fin      = fin;
  g.hours    = horas;
  g.status   = "finalizada";
  g.kmGuardia = horas * (g.type === "especial" ? GUARDIA_ESPECIAL_KM_HORA : GUARDIA_COMUN_KM_HORA);
  g.viatico  = horas >= 9;

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber ? order : o
    )
  );

  setActiveOrder(order);

  console.log("Guardia finalizada:", g);

  return g;
}
window.finalizarGuardia = finalizarGuardia;

// export global
window.cancelarViajePorId = cancelarViajePorId;
window.getTravelEnCurso = getTravelEnCurso;
window.cortarGuardiaAntesDeViaje = cortarGuardiaAntesDeViaje;


