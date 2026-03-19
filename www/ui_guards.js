console.log("ui_guards cargado");
// =====================================================
// GUARDIAS (UI → CORE) JORNADA AUTOMÁTICA
// =====================================================
function addGuardUI(event){
  event.preventDefault();

  // 🔥 CREACIÓN AUTOMÁTICA DE JORNADA
  let o = getActiveOrder();
  if(!o){
    o = createOrder();
    console.log("Jornada creada automáticamente:", o.orderNumber);
  }

  const dia = document.getElementById("diaGuardia").value;
  const inicio = document.getElementById("horaInicioGuardia").value;
  const fin = document.getElementById("horaFinGuardia").value;
  const tipo = document.getElementById("tipoGuardia").value;

  if(!dia){
    alert("Seleccioná el día");
    return;
  }

  if(!inicio){
    alert("Ingresá hora de inicio");
    return;
  }

  if(!tipo){
    alert("Elegí tipo de guardia");
    return;
  }

  let horas = 0;
  let status = "en_curso";

  if(fin){
    const [hI, mI] = inicio.split(":").map(Number);
    const [hF, mF] = fin.split(":").map(Number);
    horas = (hF + mF/60) - (hI + mI/60);
    if(horas <= 0){
      alert("La hora fin debe ser mayor que la de inicio");
      return;
    }
    status = "finalizada";
  }

  let descripcion = "";

  if(tipo === "especial"){
    descripcion =
      document.getElementById("descripcionGuardia").value.trim();

    if(!descripcion){
      alert("Si es guardia especial, debés completar la descripción");
      return;
    }
  }

  // 🔥 GUARDADO COMPATIBLE CON CORE
  const order = getActiveOrder();
  if(!order){
    alert("No hay jornada activa");
    return;
  }

  if(!order.guards) order.guards = [];

  // 1. VALIDAR SOLAPAMIENTO
  const solapada = order.guards.find(
    g => g.dia === dia && g.inicio === inicio && g.fin === fin
  );
  if(solapada){
    alert("Ya existe una guardia en ese horario");
    return;
  }

  order.guards.push({
    type: tipo,
    hours: horas,
    status: status,
    descripcion: descripcion,
    dia: dia,
    inicio: inicio,
    fin: fin || null,
    kmGuardia: status === "finalizada" ? horas * (tipo === "especial" ? 40 : 30) : 0,
    viatico: status === "finalizada" ? horas >= 9 : false,
    createdAt: Date.now()
  });

  const orders = getOrders();
  saveOrders(orders.map(o =>
    o.orderNumber === order.orderNumber ? order : o
  ));
  setActiveOrder(order);

  renderResumenDia();
  renderListaGuardias();

  const totals = calculateOrderTotals(order);

  const mensajeViatico =
    totals.viaticos > 0
      ? "\n✅ Viático generado en esta jornada"
      : "\nℹ️ Aún sin viático";

  alert(
    `Guardia ${tipo} de ${horas.toFixed(2)} hs registrada` +
    mensajeViatico
  );

  showScreen("mainScreen");
}

// =====================================================
// TARJETAS DE GUARDIAS POR DÍA — VERSIÓN CORREGIDA
// Muestra: inicio, fin (o EN CURSO), horas, km, tipo
// =====================================================

function renderTarjetasGuardiasPorDia(){

  const container =
    document.getElementById("cardsGuardiasContainer");

  if(!container) return;

  container.innerHTML = "";

  const orders = getOrders();

  if(!orders || orders.length === 0) return;

  // Agrupar guardias por fecha de jornada (order.date)
  const porDia = {};

  orders.forEach(o => {
    const fecha = o.date;
    if(!porDia[fecha]) porDia[fecha] = [];
    (o.guards || []).forEach(g => {
      porDia[fecha].push(g);
    });
  });

  const fechas = Object.keys(porDia)
    .sort((a,b) => new Date(b) - new Date(a))
    .slice(0, 5);

  fechas.forEach(fecha => {

    const card = document.createElement("div");
    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
      margin-bottom:10px;
    `;

    let guardiasHTML = "";

    porDia[fecha].forEach(g => {

      const kmHora = g.type === "especial" ? 40 : 30;

      // ── GUARDIA EN CURSO ──
      if(g.status === "en_curso"){

        const ahora = new Date();
        const [hI, mI] = g.inicio.split(":").map(Number);
        const inicio = new Date();
        inicio.setHours(hI, mI, 0, 0);
        const transcurridoMin = Math.max(0, Math.floor((ahora - inicio) / 60000));
        const hTrans = Math.floor(transcurridoMin / 60);
        const mTrans = transcurridoMin % 60;
        const kmAcum = (transcurridoMin / 60 * kmHora).toFixed(1);

        guardiasHTML += `
          <div style="
            background:#fff3e0;
            border:1px solid #ffb300;
            border-radius:8px;
            padding:10px;
            margin:6px 0;
            font-size:14px;
            line-height:1.8;
          ">
            🟡 <b>EN CURSO</b><br>
            🕐 Inicio: <b>${g.inicio}</b><br>
            ⏱ Transcurrido: <b>${hTrans}h ${mTrans}m</b><br>
            📏 KM acumulados: <b>${kmAcum} km</b><br>
            🔖 Tipo: <b>${g.type}</b>
            <br><br>
            <button onclick="finalizarGuardiaUI('${g.createdAt}')"
              style="
                background:#c62828;
                color:white;
                border:none;
                border-radius:6px;
                padding:8px 16px;
                font-size:14px;
                cursor:pointer;
              ">
              Finalizar Guardia
            </button>
          </div>
        `;

      // ── GUARDIA FINALIZADA ──
      } else {

        // Recalcular horas y km desde inicio/fin para garantizar consistencia
        let horas = g.hours || 0;
        let km = g.kmGuardia;

        if(g.inicio && g.fin){
          const [hI, mI] = g.inicio.split(":").map(Number);
          const [hF, mF] = g.fin.split(":").map(Number);
          let calculado = (hF + mF/60) - (hI + mI/60);
          if(calculado < 0) calculado += 24; // cruce medianoche
          if(calculado > 0){
            horas = calculado;
            km = horas * kmHora;
          }
        }

        // Indicar si fue cortada automáticamente por viaje
        const cortadaAuto = g.cortadaAuto
          ? `<span style="font-size:12px; color:#888;"> ✂️ cortada por viaje</span>`
          : "";

        const viatico = g.viatico
          ? `<span style="color:green;"> ✅ Viático</span>`
          : "";

        const horasStr = Number.isFinite(horas)
          ? horas.toFixed(2)
          : "0.00";

        const kmStr = Number.isFinite(km)
          ? km.toFixed(1)
          : "0.0";

        guardiasHTML += `
          <div style="
            background:#f9f9f9;
            border:1px solid #ddd;
            border-radius:8px;
            padding:10px;
            margin:6px 0;
            font-size:14px;
            line-height:1.8;
          ">
            ✅ <b>FINALIZADA</b>${cortadaAuto}<br>
            🕐 Inicio: <b>${g.inicio || "--:--"}</b><br>
            🕑 Fin: <b>${g.fin || "--:--"}</b><br>
            ⏱ Duración: <b>${horasStr} h</b><br>
            📏 KM generados: <b>${kmStr} km</b><br>
            🔖 Tipo: <b>${g.type}</b>${viatico}
            ${g.descripcion ? `<br>📝 ${g.descripcion}` : ""}
          </div>
        `;
      }
    });

    card.innerHTML = `
      <p style="font-weight:bold; margin:0 0 8px 0;">📅 ${fecha}</p>
      <p style="font-weight:bold; margin:0 0 4px 0;">Guardias:</p>
      ${guardiasHTML || "<p style='color:#888;'>Sin guardias registradas</p>"}
    `;

    container.appendChild(card);
  });
}

// =====================================================
// FUNCIÓN PRINCIPAL LLAMADA POR LA APP
// =====================================================

function renderListaGuardias(){
  renderTarjetasGuardiasPorDia();
}

// =====================================================
// CONTROL VISUAL DE DESCRIPCIÓN DE GUARDIA
// =====================================================

function manejarDescripcionGuardia(){
  const tipo = document.getElementById("tipoGuardia").value;
  const box = document.getElementById("boxDescripcionGuardia");

  if(tipo === "especial"){
    box.style.display = "block";
  } else {
    box.style.display = "none";
    document.getElementById("descripcionGuardia").value = "";
  }
}

// =====================================================
// FINALIZAR GUARDIA MANUAL (botón en card)
// =====================================================

function finalizarGuardiaUI(createdAt){
  const order = getActiveOrder();
  if(!order) return;

  const g = order.guards.find(g => String(g.createdAt) === String(createdAt));
  if(!g){ alert("Guardia no encontrada"); return; }

  const ahora = new Date();
  const fin = ahora.toTimeString().substring(0,5);

  const [hI, mI] = g.inicio.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);
  let horas = (hF + mF/60) - (hI + mI/60);
  if(horas < 0) horas += 24; // cruce medianoche

  if(horas <= 0){ alert("Error en horario"); return; }

  g.fin = fin;
  g.hours = horas;
  g.status = "finalizada";
  g.kmGuardia = horas * (g.type === "especial" ? 40 : 30);
  g.viatico = horas >= 9;

  const orders = getOrders();
  saveOrders(orders.map(o =>
    o.orderNumber === order.orderNumber ? order : o
  ));
  setActiveOrder(order);

  renderResumenDia();
  renderListaGuardias();
  renderBotonCerrarJornada?.();

  alert(`Guardia finalizada: ${g.inicio} – ${fin} | ${horas.toFixed(2)}h | ${g.kmGuardia.toFixed(1)} km`);
}

window.finalizarGuardiaUI = finalizarGuardiaUI;

// =====================================================
// EXPORTS
// =====================================================

window.addGuardUI = addGuardUI;
window.renderListaGuardias = renderListaGuardias;
window.renderTarjetasGuardiasPorDia = renderTarjetasGuardiasPorDia;
window.manejarDescripcionGuardia = manejarDescripcionGuardia;
