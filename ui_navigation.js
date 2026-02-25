// =====================================================
// NAVEGACIÓN
// =====================================================

function showScreen(id){

  console.log("[NAV] Mostrar pantalla:", id);

  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));

  const target =
    document.getElementById(id);

  if(!target) return;

  target.classList.add("active");

  // 🔥 ACTUALIZAR MAIN SCREEN
  if(id === "mainScreen"){

    console.log("Actualizando mainScreen...");

    if(typeof renderOrdenActivaUI === "function")
      renderOrdenActivaUI();

    if(typeof mostrarViajeEnCursoUI === "function")
      mostrarViajeEnCursoUI();

  }

}

window.showScreen = showScreen;

