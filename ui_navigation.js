// =====================================================
// NAVEGACIÓN
// =====================================================

function showScreen(id){

  console.log("[NAV] Mostrar pantalla:", id);

  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  const target = document.getElementById(id);

  if (!target) {
    console.error("❌ Pantalla no encontrada:", id);
    return;
  }

  target.classList.add("active");
}

window.showScreen = showScreen;

