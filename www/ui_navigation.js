// =====================================================
// NAVEGACIÓN
// =====================================================
function refreshMainUI(){

  if(typeof renderOrdenActivaUI === "function")
    renderOrdenActivaUI();

  if(typeof mostrarViajeEnCursoUI === "function")
    mostrarViajeEnCursoUI();

  if(typeof renderListaViajes === "function")
    renderListaViajes();

  if(typeof renderResumenDia === "function")
    renderResumenDia();

  if(typeof renderBotonCerrarJornada === "function")
    renderBotonCerrarJornada();

}

window.refreshMainUI = refreshMainUI;
function showScreen(id){

  console.log("[NAV] Mostrar pantalla:", id);

  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));

  const target = document.getElementById(id);
  if(!target) return;

  target.classList.add("active");

  // 🔥 ACTUALIZAR MAIN SCREEN
  if(id === "mainScreen"){

    console.log("Actualizando mainScreen...");
    refreshMainUI();

  }

}

window.showScreen = showScreen;

