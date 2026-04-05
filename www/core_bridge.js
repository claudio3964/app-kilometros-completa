// ===============================
// BRIDGE CORE APK ↔ UI
// ===============================

// -------- DRIVER --------
window.getDriver = getDriver;

// -------- ACTIVE ORDER --------
window.getActiveOrder = getActiveOrder;
window.setActiveOrder = setActiveOrder;

// -------- GUARDIAS --------
window.addGuardia = function(tipo, inicio, dia, descripcion){
  return addGuard(tipo, inicio, dia, descripcion);
};

// -------- VIAJES --------
window.addViaje = function(data){
  const ok = addTravel(
    data.origen,
    data.destino,
    data.turno,
    data.departureTime,
    data.arrivalTime,
    data.hoursWorked,
    data.tipo,
    data.acoplado
  );

  if(ok && window.verificarViajesProgramados){
    window.verificarViajesProgramados();
  }

  return ok;
};

// -------- HISTORIAL --------
window.abrirHistorial = function(){
  if(typeof abrirHistorial === "function"){
    abrirHistorial();
  } else {
    console.warn("abrirHistorial no disponible");
  }
};

// -------- FINALIZAR JORNADA --------
window.finalizarJornada = function(){
  return closeActiveOrder();
};
