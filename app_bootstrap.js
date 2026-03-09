// =====================================================
// 🚀 ARRANQUE GENERAL DE LA APP
// =====================================================

// =====================================================
// 🔔 DETECCIÓN DE CAMBIO DE DÍA
// =====================================================

function verificarCambioDeDia(){

  const order = getActiveOrder();
  if(!order) return;

  const hoy = new Date().toISOString().split("T")[0];

  if(order.date !== hoy){
    mostrarModalCierrePendiente(order);
  }
}

function mostrarModalCierrePendiente(order){

  const modal = document.createElement("div");

  modal.id = "modalCambioDia";
  modal.style.cssText = `
    position: fixed;
    top:0; left:0;
    width:100%; height:100%;
    background: rgba(0,0,0,0.6);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
  `;

  modal.innerHTML = `
    <div style="
      background:white;
      padding:20px;
      border-radius:8px;
      max-width:400px;
      text-align:center;
    ">
      <h3>Jornada pendiente</h3>
      <p>
        Tiene una jornada pendiente del día ${order.date}.<br>
        Debe finalizarla antes de continuar.
      </p>
      <button id="btnForzarCierre"
        style="
          background:#c62828;
          color:white;
          padding:10px 20px;
          border:none;
          border-radius:6px;
          font-weight:bold;
        ">
        Finalizar Jornada
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnForzarCierre")
    .addEventListener("click", function(){

      const resultado = closeActiveOrder();

      if(resultado){

        document.body.removeChild(modal);

        if(typeof renderResumenFinal === "function"){
          renderResumenFinal(resultado);
        }

      }

    });
}

// =====================================================
// 🚀 BOOTSTRAP PRINCIPAL
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

    if(real.travels){

      let cambio = false;

      real.travels.forEach(t => {

       if(t.status === "en_curso"){

  console.warn(
    "Viaje en curso recuperado al iniciar app:",
    t.id
  );

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

  if(typeof renderBotonCerrarJornada === "function")
  renderBotonCerrarJornada();

  if(typeof renderOrdenActivaUI === "function")
    renderOrdenActivaUI();

  if(typeof mostrarViajeEnCursoUI === "function")
    mostrarViajeEnCursoUI();

  // 🔔 Detectar cambio de día (DESPUÉS de render básico)
  verificarCambioDeDia();

  // =====================================================
  // MOTOR AUTOMÁTICO DE VIAJES PROGRAMADOS
  // =====================================================

  if(!window.__motorViajesProgramados){

    window.__motorViajesProgramados =
      setInterval(() => {

        renderListaViajes();

        if(typeof mostrarViajeEnCursoUI === "function")
          mostrarViajeEnCursoUI();

      }, 15000);

  }
// =====================================================
// REACTIVACIÓN AL VOLVER A LA APP
// =====================================================

document.addEventListener("visibilitychange", () => {

  if(!document.hidden){

    console.log("🔄 App volvió a foreground");
activarViajesProgramados();
    if(typeof mostrarViajeEnCursoUI === "function")
      mostrarViajeEnCursoUI();

  }

});
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

         // Obtener ciudades desde rutas
const ciudades = new Set();

if(typeof routes !== "undefined"){
  routes.forEach(r=>{
    ciudades.add(r.origen);
    ciudades.add(r.destino);
  });
}

// agregar base por si no aparece
ciudades.add(driver.base || "Montevideo");

const bases = [...ciudades].sort();

bases.push("Otro");

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
// ========================================
// MOTOR VIAJES PROGRAMADOS
// ========================================

setInterval(() => {

  activarViajesProgramados();

}, 60000);