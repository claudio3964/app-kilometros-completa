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

  if(!inicio || !fin){
    alert("Ingresá hora inicio y fin");
    return;
  }

  if(!tipo){
    alert("Elegí tipo de guardia");
    return;
  }

  const [hI, mI] = inicio.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);

  let horas = (hF + mF/60) - (hI + mI/60);

  if(horas <= 0){
    alert("La hora fin debe ser mayor que la de inicio");
    return;
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

  // 2. CALCULAR km y viatico
  const kmGuardia = horas * (tipo === "especial" ? 40 : 30);
  const viatico   = horas >= 9;

  order.guards.push({
    type: tipo,
    hours: horas,
    descripcion: descripcion,
    dia: dia,
    inicio: inicio,
    fin: fin,
    kmGuardia,
    viatico,
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
// LISTA DE GUARDIAS
// =====================================================

function renderListaGuardias(){
  const container = document.getElementById("cardsGuardiasContainer");
  container.innerHTML = "";

  const orders = getOrders();
  if(!orders || orders.length === 0) return;

  // Agrupar guardias por día
  const porDia = {};
  orders.forEach(o => {
    if(!o.guards) return;
    o.guards.forEach(g => {
      const dia = g.dia || new Date(g.createdAt).toLocaleDateString();
      if(!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(g);
    });
  });

  for(const dia in porDia){
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #ddd; border-radius:8px; padding:16px; margin:12px 0;";

    let html = `<p><strong>📅 ${dia}</strong></p><p><strong>Guardias:</strong></p>`;

    porDia[dia].forEach(g => {
      const kmGuardia = g.hours * (g.type === "especial" ? 40 : 30);
      const viatico = g.viatico ? "✅ Viático" : "";
      const horario = g.inicio && g.fin ? `${g.inicio} – ${g.fin}` : "—";
      const tipo = g.type === "especial" ? "especial" : "comun";

      html += `${horario} | ${g.hours.toFixed(1)} h | ${g.kmGuardia} km | ${tipo}`;
      if(g.viatico) html += ` | ✅ Viático`;
      html += `<br>`;
    });

    card.innerHTML = html;
    container.appendChild(card);
  }
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
// TARJETAS DE GUARDIAS POR DÍA (ESTILO MOBILE)
// =====================================================

function renderTarjetasGuardiasPorDia(){

  const container =
    document.getElementById("cardsGuardiasContainer");

  if(!container) return;

  container.innerHTML = "";

  const orders = getOrders();

  if(!orders || orders.length === 0) return;

  const porDia = {};

  orders.forEach(o => {

    const d = o.date;

    if(!porDia[d]) porDia[d] = [];

    porDia[d].push(o);
  });

  const fechas = Object.keys(porDia)
    .sort((a,b) => new Date(b) - new Date(a))
    .slice(0,5);

  fechas.forEach(fecha => {

    const listaGuardias = [];

    porDia[fecha].forEach(o => {

      o.guards.forEach(g => {

        listaGuardias.push(
          `${g.inicio || "--:--"} – ${g.fin || "--:--"} | ` +
          `${g.hours.toFixed(2)} h | ${g.type}` +
          (g.descripcion ? ` (${g.descripcion})` : "")
        );
      });

    });

    const card = document.createElement("div");

    card.style.cssText = `
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      background:white;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
      margin-bottom:10px;
    `;

    card.innerHTML = `
      <b>📅 ${fecha}</b><br><br>
      <b>Guardias:</b><br>
      ${listaGuardias.join("<br>") || "—"}
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
// EXPORTS
// =====================================================

window.addGuardUI = addGuardUI;
window.renderListaGuardias = renderListaGuardias;
window.renderTarjetasGuardiasPorDia = renderTarjetasGuardiasPorDia;
window.manejarDescripcionGuardia = manejarDescripcionGuardia;
