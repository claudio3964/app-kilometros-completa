
// =====================================================
// 🚀 ARRANQUE GENERAL DE LA APP
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

  const o = getActiveOrder();
  if(o){
    document.getElementById("ordenActivaInfo").innerText =
      "🟢 Jornada activa: " + o.orderNumber;
  }

  const diaInput = document.getElementById("diaGuardia");
  if(diaInput){
    diaInput.value = new Date().toISOString().split("T")[0];
  }

  renderListaViajes();
  renderResumenDia();

  window.addEventListener("load", () => {

    const splash = document.getElementById("splashScreen");
    if (splash) splash.classList.add("active");

    setTimeout(() => {

      const driver = getDriver();

      document.querySelectorAll(".screen")
        .forEach(s => s.classList.remove("active"));

      if (!driver) {
        document.getElementById("registroScreen")?.classList.add("active");
      } else {

        const badge = document.getElementById("baseChoferBadge");
        if (badge) {
          badge.innerText = "Base: " + (driver.base || "Montevideo");
        }

        const sel = document.getElementById("originTravels");
        if (sel) {
          const bases = ["Montevideo","Colonia","Maldonado",
                         "Punta del Este","Rocha","Chuy","Otro"];

          sel.innerHTML = bases.map(b =>
            `<option value="${b}" ${b===driver.base?'selected':''}>${b}</option>`
          ).join("");
        }

        document.getElementById("mainScreen")?.classList.add("active");
      }

      if (splash) {
        splash.classList.add("fade-out");
        setTimeout(() => splash.style.display = "none", 400);
      }

    }, 900);

  });

});
