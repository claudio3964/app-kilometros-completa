// ===============================
// BRIDGE CORE APK ↔ UI
// ===============================

// -------- DRIVER --------
window.getDriver = getDriver;


// -------- ACTIVE ORDER --------
window.getActiveOrder = getActiveOrder;


window.setActiveOrder = setActiveOrder;

// -------- GUARDIAS --------
window.addGuardia = function (inicio) {
  // adaptá si el core usa otro nombre
  if (typeof crearGuardia === "function") {
    return crearGuardia(inicio);
  }

  console.warn("crearGuardia no existe en core");
  return null;
};

// -------- VIAJES --------
window.addViaje = function (data) {
  if (typeof crearViaje === "function") {
    const viaje = crearViaje(data);

    // MUY IMPORTANTE
    if (window.verificarViajesProgramados) {
      window.verificarViajesProgramados();
    }

    return viaje;
  }

  console.warn("crearViaje no existe en core");
  return null;
};
// ===============================
// HISTORIAL (UI stub temporal)
// ===============================
window.abrirHistorial = function () {
  console.log("Historial no implementado aún");

  alert("Pantalla de historial en construcción");
};