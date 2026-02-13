// =====================================================
// NAVEGACIÓN
// =====================================================

function showScreen(id){
  console.clear();
  console.log("👉 Quiero mostrar:", id);

  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    console.log("Oculto:", s.id);
  });

  const target = document.getElementById(id);
  if (!target) {
    console.error("❌ NO EXISTE LA PANTALLA:", id);
    return;
  }

  target.classList.add("active");
  console.log("✅ Activada:", id);
}

window.showScreen = showScreen;

