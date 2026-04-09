"use strict";

// =====================================================
// SYNC ROTACIÓN — COT Driver App
// Carga viajes programados desde Supabase al arrancar
// =====================================================

console.log("sync_rotacion cargado");
const SB_URL_ROT = "https://frjeivfpldcigklwepqt.supabase.co";
const SB_KEY_ROT = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

// =====================================================
// CARGAR VIAJES PROGRAMADOS DEL DÍA
// =====================================================
async function cargarViajesProgramadosDesdeSupabase() {
  try {
    const driver = getDriver();
    if (!driver) return; // No hay chofer registrado

    const hoy = new Date().toISOString().split("T")[0];

    // Buscar jornada programada para hoy en Supabase
    const res = await fetch("".concat(SB_URL_ROT, "/rest/v1/jornadas?empresa_id=eq.cot&chofer_id=eq.").concat(driver.legajo, "&order_number=eq.").concat(hoy, "-").concat(driver.legajo, "&select=*"), {
      headers: {
        "apikey": SB_KEY_ROT,
        "Authorization": "Bearer ".concat(SB_KEY_ROT)
      }
    });
    if (!res.ok) {
      console.warn("sync_rotacion: error al consultar Supabase", res.status);
      return;
    }
    const jornadas = await res.json();
    if (!jornadas || !jornadas.length) {
      console.log("sync_rotacion: sin jornada programada para hoy");
      return;
    }
    const jornadaRemota = jornadas[0];
    let data = {};
    try {
      data = JSON.parse(jornadaRemota.data || "{}");
    } catch {}

    // Verificar que es para hoy y fue generada automáticamente
    if (data.date !== hoy || !data.generado_auto) {
      console.log("sync_rotacion: jornada no es de hoy o no es automática");
      return;
    }

    // Verificar si ya existe una jornada activa local
    const activeOrder = getActiveOrder();
    if (activeOrder && activeOrder.date === hoy) {
      console.log("sync_rotacion: ya hay jornada activa para hoy");
      return;
    }

    // Verificar si ya fue cargada antes (evitar duplicados)
    const yaImportada = localStorage.getItem("rotacion_importada_".concat(hoy));
    if (yaImportada) {
      console.log("sync_rotacion: ya importada hoy");
      return;
    }

    // Construir viajes programados
    const viajes = (data.travels || []).map((v, i) => ({
      id: "rot-".concat(hoy, "-").concat(driver.legajo, "-").concat(i),
      destination: v.destino || v.destination || "",
      departureTime: v.hora || v.departureTime || "",
      status: "programado",
      tipo: v.tipo || "TURNO",
      inicioProgramado: construirTimestamp(hoy, v.hora || v.departureTime),
      kmEmpresa: 0,
      kmAuto: 0,
      generado_auto: true
    }));
    if (!viajes.length) {
      console.log("sync_rotacion: sin viajes en la jornada remota");
      return;
    }

    // Crear nueva jornada con los viajes programados
    const nuevaJornada = {
      orderNumber: jornadaRemota.order_number || "".concat(hoy, "-").concat(driver.legajo),
      date: hoy,
      driverLegajo: driver.legajo,
      driverName: driver.nombre,
      base: driver.base || "Montevideo",
      tipo: "efectivo",
      travels: viajes,
      guards: [],
      closed: false,
      generado_auto: true,
      posicion: data.posicion || null
    };

    // Guardar en localStorage
    setActiveOrder(nuevaJornada);

    // Guardar en historial
    const orders = getOrders();
    orders.push(nuevaJornada);
    Storage.set("orders", orders);

    // Marcar como importada para no repetir
    localStorage.setItem("rotacion_importada_".concat(hoy), "true");
    console.log("\u2705 sync_rotacion: ".concat(viajes.length, " viajes importados para ").concat(driver.nombre));

    // Mostrar notificación al chofer
    mostrarNotificacionViajes(viajes, data.posicion);
  } catch (e) {
    console.error("sync_rotacion error:", e.message);
  }
}

// =====================================================
// CONSTRUIR TIMESTAMP desde fecha + hora "HH:MM"
// =====================================================
function construirTimestamp(fecha, hora) {
  if (!hora) return null;
  try {
    const [hh, mm] = hora.split(":").map(Number);
    const dt = new Date(fecha);
    dt.setHours(hh, mm, 0, 0);
    return dt.toISOString();
  } catch {
    return null;
  }
}

// =====================================================
// NOTIFICACIÓN AL CHOFER
// =====================================================
function mostrarNotificacionViajes(viajes, posicion) {
  // Esperar a que el DOM esté listo
  setTimeout(() => {
    const container = document.getElementById("viajeEnCursoContainer");
    if (!container) return;
    const lista = viajes.map(v => "<div style=\"padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px\">\n        \uD83D\uDD52 <b>".concat(v.departureTime, "</b> \u2014 ").concat(v.destination, " \n        <span style=\"color:#64748b;font-size:11px\">").concat(v.tipo, "</span>\n      </div>")).join("");
    const banner = document.createElement("div");
    banner.id = "bannerRotacion";
    banner.style.cssText = "\n      background: #eff6ff;\n      border: 1px solid #bfdbfe;\n      border-radius: 10px;\n      padding: 14px 16px;\n      margin-bottom: 14px;\n    ";
    banner.innerHTML = "\n      <div style=\"font-weight:600;color:#1e40af;margin-bottom:8px\">\n        \uD83D\uDCCB Servicios programados para hoy".concat(posicion ? " \u2014 Posici\xF3n ".concat(posicion) : "", "\n      </div>\n      ").concat(lista, "\n      <div style=\"margin-top:10px;font-size:12px;color:#64748b\">\n        Los viajes se activar\xE1n autom\xE1ticamente a la hora indicada\n      </div>\n    ");

    // Insertar al principio del container
    if (container.firstChild) {
      container.insertBefore(banner, container.firstChild);
    } else {
      container.appendChild(banner);
    }
  }, 1500);
}

// =====================================================
// EXPORTAR
// =====================================================
window.cargarViajesProgramadosDesdeSupabase = cargarViajesProgramadosDesdeSupabase;
