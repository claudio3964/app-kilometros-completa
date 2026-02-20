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
function getActiveOrder(){ return Storage.get("activeOrder"); }
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


// ===== CLOSE ORDER =====
function closeActiveOrder(){
  const o=getActiveOrder();
  if(!o) return null;
  o.closed=true;
  o.closedAt=Date.now();

  saveOrders(getOrders().map(x=>x.orderNumber===o.orderNumber?o:x));
  clearActiveOrder();
  return o;
}

// =====================================================
// VIAJES (CORE OFICIAL CON KM AUTO)
// =====================================================
function addTravel(origen, destino, turno, departureTime, arrivalTime, hoursWorked){

  const o = getActiveOrder();

  if(!o || o.closed) return false;

  const rutaDirecta = `${origen} → ${destino}`;
  const rutaInversa = `${destino} → ${origen}`;

  let kmEmpresa = ROUTES_CATALOG[rutaDirecta];

  if(!kmEmpresa){
    kmEmpresa = ROUTES_CATALOG[rutaInversa] || 0;
  }

  // 🔥 LEER KM REAL DESDE UI
  const kmAuto =
    Number(document.getElementById("kmTravels")?.value) || kmEmpresa;

  const acoplado = turno >= 2;
  const esPrimer = o.travels.length === 0;

  const nuevoViaje = {

    origen,
    destino,

    turno,

    kmEmpresa,
    kmAuto,   // 🔥 ESTA ES LA CLAVE

    acoplado,
    tomeCese: esPrimer,

    departureTime,
    arrivalTime,
    hoursWorked,

    createdAt: Date.now()
  };

  o.travels.push(nuevoViaje);

  saveOrders(
    getOrders().map(x =>
      x.orderNumber === o.orderNumber ? o : x
    )
  );

  setActiveOrder(o);

  console.log("💾 Guardado en CORE:", nuevoViaje);

  return true;
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

  if(o.travels.length === 0) return 0;

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
// TOTALES DE LA ORDEN (CORREGIDO)
// =====================================================
function calculateOrderTotals(o){
  let kmViajes=0, kmAcoplados=0, kmGuardias=0;

  o.travels.forEach(t=>{
    kmViajes+=t.kmEmpresa;
    if(t.acoplado) kmAcoplados+=ACOPLADO_EXTRA_KM;
  });

  o.guards.forEach(g=>{
    kmGuardias+=g.hours*(g.type==="especial"
      ? GUARDIA_ESPECIAL_KM_HORA
      : GUARDIA_COMUN_KM_HORA);
  });

  const kmTomeCese =
    o.travels.some(t=>t.tomeCese)?TOME_CESE_KM:0;

  const kmTotal =
    kmViajes + kmAcoplados + kmGuardias + kmTomeCese;

  const montoKm = kmTotal * LAUDO_KM;

  const cantidadViaticos = determinarViatico(o);
  const viatico = cantidadViaticos * MONTO_VIATICO;

  return {
    kmViajes,
    kmAcoplados,
    kmGuardias,
    kmTomeCese,
    kmTotal,
    monto: montoKm + viatico,
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
