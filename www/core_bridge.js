// ===============================
// BRIDGE CORE APK ↔ UI
// ===============================

// -------- DRIVER --------
window.getDriver = function () {
  try {
    const d = localStorage.getItem("driver");
    return d ? JSON.parse(d) : null;
  } catch (e) {
    console.error("Error getDriver:", e);
    return null;
  }
};

// -------- ACTIVE ORDER --------
window.getActiveOrder = function () {
  try {
    const o = localStorage.getItem("activeOrder");
    return o ? JSON.parse(o) : null;
  } catch (e) {
    console.error("Error getActiveOrder:", e);
    return null;
  }
};

window.setActiveOrder = function (order) {
  localStorage.setItem("activeOrder", JSON.stringify(order));
};

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