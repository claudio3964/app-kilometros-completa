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

  // 👉 ÚNICO cálculo que hace la UI: convertir inicio/fin → horas
  const [hI, mI] = inicio.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);

  let horas = (hF + mF/60) - (hI + mI/60);

  if(horas <= 0){
    alert("La hora fin debe ser mayor que la de inicio");
    return;
  }

  // ======= Manejo de descripción para guardia especial =======
  let descripcion = "";

  if(tipo === "especial"){
    descripcion = document.getElementById("descripcionGuardia").value.trim();

    if(!descripcion){
      alert("Si es guardia especial, debés completar la descripción");
      return;
    }
  }

  // 👉 Mandamos al CORE lo mínimo que espera (sin cambiar core)
  addGuard(tipo, horas);

  // 👉 Enriquecemos la última guardia con más datos útiles
  const orders = getOrders();
  const ultima = orders[orders.length - 1];
  const ultimaGuardia = ultima.guards[ultima.guards.length - 1];

  ultimaGuardia.descripcion = descripcion;
  ultimaGuardia.dia = dia;
  ultimaGuardia.inicio = inicio;
  ultimaGuardia.fin = fin;

  saveOrders(orders);

  renderResumenDia();
  renderListaGuardias();

  // ======= NUEVO: mensaje con viático en el alert =======
  const totals = calculateOrderTotals(o);
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
// LISTA DE VIAJES  (COMPATIBLE CON TARJETAS)
// =====================================================
function renderListaViajes(){

  // Si ya estamos usando tarjetas, NO tocamos tablas:
  renderTarjetasPorDia();
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
window.addGuardUI = addGuardUI;
window.renderListaGuardias = renderListaGuardias;
