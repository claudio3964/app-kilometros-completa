"use strict";
alert("CORE CARGADO");
console.log("CORE OK");



/* ================================
   COT DRIVER CORE ENGINE v1.0
   © Claudio Andrés 2026
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
  "Montevideo → Punta del Este": 140,
  "Montevideo → Punta del Este x Piriápolis": 145,
  "Montevideo → Punta del Este x Pan de Azúcar y San Carlos": 155,
  "Montevideo → Punta del Este x Ruta 8 y 9": 165,
  "Montevideo → Colonia": 178,
  "Montevideo → Laguna Garzón": 183,
  "Montevideo → La Pedrera": 250,
  "Montevideo → Chuy": 345,
  "Punta del Este → Montevideo": 140,
  "Colonia → Montevideo": 178,
  "La Pedrera → Montevideo": 250,
  "Chuy → Montevideo": 345
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
  const d=getDriver()||{legajo:"0000"};
  let c=Storage.get("orderCounter",0)+1;
  Storage.set("orderCounter",c);
  return `${d.legajo}-${String(c).padStart(8,"0")}`;
}

// ===== ACTIVE ORDER =====
function getActiveOrder(){ return Storage.get("activeOrder"); }
function setActiveOrder(o){ Storage.set("activeOrder",o); }
function clearActiveOrder(){ Storage.remove("activeOrder"); }

// ===== CREATE ORDER =====
function createOrder(){
  if(getActiveOrder()) return getActiveOrder();

  const o={
    orderNumber: generateOrderNumber(),
    date: new Date().toISOString().split("T")[0],
    travels: [],
    guards: [],
    closed: false,
    createdAt: Date.now()
  };

  const all=getOrders();
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

// ===== VIAJES =====
function addTravel(destino, turno){
  const o=getActiveOrder();
  if(!o || o.closed) return false;

  const kmEmpresa=ROUTES_CATALOG[destino]||0;
  const acoplado=turno>=2;
  const esPrimer=o.travels.length===0;

  o.travels.push({
    destino,
    turno,
    kmEmpresa,
    acoplado,
    tomeCese: esPrimer,
    createdAt: Date.now()
  });

  saveOrders(getOrders().map(x=>x.orderNumber===o.orderNumber?o:x));
  setActiveOrder(o);
  return true;
}

// ===== GUARDIAS =====
function addGuard(type,hours){
  const o=getActiveOrder();
  if(!o || o.closed) return false;

  o.guards.push({type,hours,createdAt:Date.now()});
  saveOrders(getOrders().map(x=>x.orderNumber===o.orderNumber?o:x));
  setActiveOrder(o);
}

// ===== CÁLCULOS =====
function calcularHorasJornada(o){
  if(o.travels.length===0) return 0;
  const t=o.travels.map(v=>v.createdAt);
  return (Math.max(...t)-Math.min(...t))/(1000*60*60);
}

function tocaFranja(o,h){ return o.travels.some(v=>new Date(v.createdAt).getHours()>=h); }

// VIÁTICO REALISTA
function determinarViatico(o){
  if(o.travels.length<2) return false;
  const h=calcularHorasJornada(o);
  const f14=tocaFranja(o,14);
  const f23=tocaFranja(o,23);
  return h>=9 || (f14&&h>=4) || (f23&&h>=4);
}

function calculateOrderTotals(o){
  let kmViajes=0, kmAcoplados=0, kmGuardias=0;

  o.travels.forEach(t=>{
    kmViajes+=t.kmEmpresa;
    if(t.acoplado) kmAcoplados+=ACOPLADO_EXTRA_KM;
  });

  o.guards.forEach(g=>{
    kmGuardias+=g.hours*(g.type==="especial"?GUARDIA_ESPECIAL_KM_HORA:GUARDIA_COMUN_KM_HORA);
  });

  const kmTomeCese=o.travels.some(t=>t.tomeCese)?TOME_CESE_KM:0;
  const kmTotal=kmViajes+kmAcoplados+kmGuardias+kmTomeCese;
  const montoKm=kmTotal*LAUDO_KM;
  const viatico=determinarViatico(o)?MONTO_VIATICO:0;

  return {kmViajes,kmAcoplados,kmGuardias,kmTomeCese,kmTotal,monto:montoKm+viatico,viatico};
}

// ===== SUMMARY =====
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
