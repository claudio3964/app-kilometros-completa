// =====================================================
// 🚀 ARRANQUE GENERAL DE LA APP
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

  // =====================================================
  // 🔒 SINCRONIZACIÓN SEGURA DE ACTIVE ORDER
  // =====================================================

  (function syncActiveOrderBootstrap(){

    const active = getActiveOrder();

    if(!active) return;

    const orders = getOrders();

    const real = orders.find(
      o => o.orderNumber === active.orderNumber && !o.closed
    );

    if(!real){

      console.warn("activeOrder inválido eliminado (bootstrap)");

      clearActiveOrder();

      return;
    }

    // limpiar viajes en_curso corruptos
    if(real.travels){

      let cambio = false;

      real.travels.forEach(t => {

        if(t.status === "en_curso"){

          t.status = "finalizado";

          t.llegadaReal = t.llegadaReal || Date.now();

          cambio = true;

        }

      });

      if(cambio){

        saveOrders(
          orders.map(o =>
            o.orderNumber === real.orderNumber ? real : o
          )
        );

        setActiveOrder(real);

        console.warn("Viajes en_curso corruptos corregidos");

      }

    }

  })();

  // =====================================================
  // RESTO DE INICIALIZACIÓN
  // =====================================================

  const o = getActiveOrder();

  if(o){

    const info = document.getElementById("ordenActivaInfo");

    if(info){
      info.innerText =
        "🟢 Jornada activa: " + o.orderNumber;
    }

  }

  const diaInput = document.getElementById("diaGuardia");

  if(diaInput){
    diaInput.value =
      new Date().toISOString().split("T")[0];
  }

  renderListaViajes();
  renderResumenDia();

  if(typeof renderOrdenActivaUI === "function")
    renderOrdenActivaUI();

  if(typeof mostrarViajeEnCursoUI === "function")
    mostrarViajeEnCursoUI();

  // =====================================================
  // MOTOR AUTOMÁTICO DE VIAJES PROGRAMADOS
  // =====================================================

  verificarViajesProgramados();

  if(!window.__motorViajesProgramados){

    window.__motorViajesProgramados =
      setInterval(() => {

        verificarViajesProgramados();

        renderListaViajes();

        if(typeof mostrarViajeEnCursoUI === "function")
          mostrarViajeEnCursoUI();

      }, 15000);

  }

  // =====================================================
  // SPLASH Y CARGA INICIAL
  // =====================================================

  window.addEventListener("load", () => {

    const splash =
      document.getElementById("splashScreen");

    if(splash) splash.classList.add("active");

    setTimeout(() => {

      const driver = getDriver();

      document
        .querySelectorAll(".screen")
        .forEach(s =>
          s.classList.remove("active")
        );

      if(!driver){

        document
          .getElementById("registroScreen")
          ?.classList.add("active");

      }else{

        const badge =
          document.getElementById("baseChoferBadge");

        if(badge){
          badge.innerText =
            "Base: " + (driver.base || "Montevideo");
        }

        const sel =
          document.getElementById("originTravels");

        if(sel){

          const bases = [
            "Montevideo",
            "Colonia",
            "Maldonado",
            "Punta del Este",
            "Rocha",
            "Chuy",
            "Otro"
          ];

          sel.innerHTML =
            bases.map(b =>
              `<option value="${b}" ${
                b===driver.base?'selected':''
              }>${b}</option>`
            ).join("");

        }

        document
          .getElementById("mainScreen")
          ?.classList.add("active");

      }

      if(splash){

        splash.classList.add("fade-out");

        setTimeout(() =>
          splash.style.display = "none",
          400
        );

      }

    }, 900);

  });

});