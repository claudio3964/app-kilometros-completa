"use strict";
// =====================================================
// RELOJ CENTRAL (modo simulación)
// =====================================================

function ahoraSistema(){
  return Date.now() + (window.TIME_OFFSET || 0);
}
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
    createdAt: ahoraSistema()
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

  const ahora = ahoraSistema();

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

  const ahora = ahoraSistema();

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

        const [h1,m1] = g.inicio.split(":").map(Number);
        const [h2,m2] = g.fin.split(":").map(Number);

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
  // GUARDIAS
  // ================================
  (o.guards || []).forEach(g => {

    if(g.inicio && g.fin){

      const [hI,mI] = g.inicio.split(":").map(Number);
      const [hF,mF] = g.fin.split(":").map(Number);

      let inicioMs =
        fechaBase + ((hI * 60 + mI) * 60 * 1000);

      let finMs =
        fechaBase + ((hF * 60 + mF) * 60 * 1000);

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
    }

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
  Storage.set("driverProfile",{...d,createdAt:ahoraSistema()});
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