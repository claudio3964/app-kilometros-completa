console.log("ui_guards cargado");
// =====================================================
// GUARDIAS (UI → CORE)
// =====================================================

function addGuardUI(event){
  event.preventDefault();

  const o = getActiveOrder();
  if(!o){
    alert("Primero iniciá la jornada");
    return;
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
    descripcion = document.getElementById("descripcionGuardia").value.trim();

    if(!descripcion){
      alert("Si es guardia especial, debés completar la descripción");
      return;
    }
  }

// CORE (agregar guardia manualmente en este commit)
const orders = getOrders();
const ultima = orders[orders.length - 1];

if (!ultima.guards) ultima.guards = [];

ultima.guards.push({
  type: tipo,
  hours: horas,
  descripcion: descripcion,
  dia: dia,
  inicio: inicio,
  fin: fin,
  createdAt: new Date().toISOString()
});

saveOrders(orders);
setActiveOrder(ultima);

  // 🔥 AHORA sí obtenemos la orden actualizada
  const updatedOrder = getActiveOrder();

  renderResumenDia();
  renderListaGuardias();

  const totals = calculateOrderTotals(updatedOrder);

  const mensajeViatico =
    totals.viatico > 0
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
  const tbody =
    document.getElementById("listaGuardiasContainer");

  tbody.innerHTML = "";

  const orders = getOrders(); // CORE
  if(!orders || orders.length === 0) return;

  const o = orders[orders.length - 1]; // última jornada
  if(!o.guards || o.guards.length === 0) return;

  o.guards.forEach((g,i) => {

    const tipoTexto =
      g.type === "especial" ? "Especial" : "Común";

    // 👉 Cálculo de KM por guardia (sin tocar el core)
    const kmGuardia =
      g.hours * (g.type === "especial" ? 40 : 30);

    // Formateo de horario (si existen inicio/fin)
    const horario =
      g.inicio && g.fin
        ? `${g.inicio} – ${g.fin}`
        : new Date(g.createdAt).toLocaleTimeString();

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${g.dia || new Date(g.createdAt).toLocaleDateString()}</td>
      <td>${horario}</td>
      <td>${g.hours.toFixed(2)}</td>
      <td>${kmGuardia.toFixed(0)} km</td>
      <td>${tipoTexto}</td>
      <td>${g.descripcion || "—"}</td>
    `;

    tbody.appendChild(tr);
  });
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
