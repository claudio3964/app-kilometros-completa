"use strict";

console.log("CORE OK");

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
    createdAt: Date.now()
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

    cerradoAt: Date.now()

  };

  // marcar estado final
  order.status = "finalizada";

  order.closed = true;

  order.closedAt = Date.now();

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
  acoplado = false     // ← FIX
){

  if(existeViajeEnCurso()){

    console.warn("No se puede programar viaje: hay uno en curso");

    return false;
  }

  const order = getActiveOrder();
  if(!order) return false;

  const ahora = Date.now();

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
  inicioReal: ahora,

  llegadaEstimada:
    ahora + (hoursWorked * 60 * 60 * 1000),

  acoplado: acoplado,   // ← FIX correcto

  tomeCese: false
};

  if(!order.travels)
    order.travels = [];

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
  acoplado = false
){

  const order = getActiveOrder();
  if(!order) return false;

  const ahora = Date.now();

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

  tomeCese: false
};

  if(!order.travels)
    order.travels = [];

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

  const ahora = Date.now();

  let cambio = false;

  order.travels.forEach(travel => {

    if(
      travel.status === "programado"
      &&
      travel.inicioProgramado
      &&
      travel.inicioProgramado <= ahora
    ){

      travel.status = "en_curso";
      travel.inicioReal = ahora;

      // =====================================================
      // RESTAURAR TOME Y CESE (PRIMER VIAJE DEL DÍA)
      // =====================================================

      if(!order.tomeCeseGenerado){

        travel.tomeCese = true;

        order.tomeCeseGenerado = true;

        console.log("Tome y Cese generado automáticamente");

      }

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

// =====================================================
// 🆕 CÁLCULO REAL DE JORNADA (viajes + guardias)
// =====================================================
function calcularHorasJornada(o){

  let todasHoras = [];

  // Horas de viajes
  o.travels.forEach(v=>{
    if(v.departureTime) todasHoras.push(v.departureTime);
    if(v.arrivalTime) todasHoras.push(v.arrivalTime);
  });

  // Horas de guardias (si vienen de la UI)
  o.guards.forEach(g=>{
    if(g.inicio) todasHoras.push(g.inicio);
    if(g.fin) todasHoras.push(g.fin);
  });

  if(todasHoras.length < 2) return 0;

  todasHoras.sort();

  const inicio = new Date(`2000-01-01T${todasHoras[0]}`);
  const fin    = new Date(`2000-01-01T${todasHoras[todasHoras.length-1]}`);

  let horasTrabajadas = (fin - inicio)/(1000*60*60);
  if(horasTrabajadas < 0) horasTrabajadas += 24;

  return horasTrabajadas;
}

// ¿Toca franja 14 o 23?
function tocaFranja(o,h){
  return o.travels.some(v => {
    const hr = Number(v.departureTime?.split(":")[0] || 0);
    return hr >= h;
  });
}

// =====================================================
// 🆕 VIÁTICOS POR JORNADA (tu regla empresarial)
// =====================================================
function determinarViatico(o){

  const travelsValidos =
  o.travels.filter(
    t => t.status !== "cancelado"
  );

if(travelsValidos.length === 0)
  return 0;

  const horasJornada = calcularHorasJornada(o);
  const toca14 = tocaFranja(o,14);
  const toca23 = tocaFranja(o,23);

  let viaticos = 0;

  // 1 viático si ≥ 9 horas
  if(horasJornada >= 9){
    viaticos = 1;
  }

  // 2 viáticos si ≥ 9 horas Y toca 14 Y toca 23
  if(horasJornada >= 9 && toca14 && toca23){
    viaticos = 2;
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

      // ignorar cancelados
      if(t.status === "cancelado")
        return;

      kmViajes += Number(t.kmEmpresa || 0);

      if(t.acoplado)
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

  // Tome y Cese
  const kmTomeCese =
    o.travels && o.travels.some(t => t.tomeCese)
      ? TOME_CESE_KM
      : 0;

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
  if(Storage.get("driverProfile")) return false;
  Storage.set("driverProfile",{...d,createdAt:Date.now()});
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

  const travel = order.travels.find(t => t.status === "en_curso");

  if(!travel) return null;

  const ahora = Date.now();

  travel.status = "finalizado";
  travel.llegadaReal = ahora;

  saveOrders(getOrders().map(o =>
    o.orderNumber === order.orderNumber ? order : o
  ));

  setActiveOrder(order);

  return travel;
}
function getTravelActivoOProgramado(){

  const order = getActiveOrder();

  if(!order || !order.travels)
    return null;

  // prioridad 1: en curso
  let travel =
    order.travels.find(
      t => t.status === "en_curso"
    );

  if(travel) return travel;

  // prioridad 2: programado
  travel =
    order.travels.find(
      t => t.status === "programado"
    );

  return travel || null;

}
//----Funcion cancelar viaje -----
function cancelarViajeActual(){

  const order = getActiveOrder();
  if(!order) return null;

  const travel = order.travels.find(
    t => t.status === "en_curso"
  );

  if(!travel) return null;

  travel.status = "cancelado";
  travel.canceladoAt = Date.now();

  saveOrders(
    getOrders().map(o =>
      o.orderNumber === order.orderNumber
        ? order
        : o
    )
  );

  setActiveOrder(order);

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

  travel.canceladoAt = Date.now();

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

// export global
window.cancelarViajePorId = cancelarViajePorId;
window.getTravelEnCurso = getTravelEnCurso;