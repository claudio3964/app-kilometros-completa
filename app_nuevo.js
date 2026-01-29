console.log("APP OK");
alert("APP_NUEVO CARGADO OK");

// ================== SISTEMA DE PANTALLAS ==================
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add("active");
}

// ================== INICIO APP ==================
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM READY");

  // ===== REGISTRO / HOME =====
  const driver = getDriver();
  if (!driver) showScreen("registerScreen");
  else showScreen("mainScreen");

  refreshOrderUI();
  showDriver();

  // ================== NAVEGACIÓN PRINCIPAL ==================
  const btnNuevoViaje = document.getElementById("btnNuevoViaje");
  if (btnNuevoViaje) btnNuevoViaje.onclick = () => showScreen("travelScreen");

  const btnNuevaGuardia = document.getElementById("btnNuevaGuardia");
  if (btnNuevaGuardia) btnNuevaGuardia.onclick = () => showScreen("guardScreen");

  const btnListaViajes = document.getElementById("btnListaViajes");
  if (btnListaViajes) btnListaViajes.onclick = () => {
    renderListaViajes();
    showScreen("listaViajesScreen");
  };

  const btnListaGuardias = document.getElementById("btnListaGuardias");
  if (btnListaGuardias) btnListaGuardias.onclick = () => {
    renderListaGuardias();
    showScreen("listaGuardiasScreen");
  };

  const btnResumenDia = document.getElementById("btnResumenDia");
  if (btnResumenDia) btnResumenDia.onclick = () => {
    renderResumenDia();
    showScreen("resumenDiaScreen");
  };

  // ================== BOTONES VOLVER ==================
  document.querySelectorAll(".btnVolverMain").forEach(btn => {
    btn.onclick = () => showScreen("mainScreen");
  });

  // ================== JORNADA ==================
  const btnStartDay = document.getElementById("btnStartDay");
  if (btnStartDay) btnStartDay.onclick = () => {
    const o = createOrder();
    alert("Jornada iniciada: " + o.orderNumber);
    refreshOrderUI();
  };

  const btnEndDay = document.getElementById("btnEndDay");
  if (btnEndDay) btnEndDay.onclick = () => {
    if (!getActiveOrder()) return alert("No hay jornada activa");
    if (!confirm("Finalizar jornada?")) return;
    const o = closeActiveOrder();
    alert("Jornada cerrada: " + o.orderNumber);
    refreshOrderUI();
  };

  // ================== REGISTRO TERMINAL ==================
  const btnRegister = document.getElementById("btnRegister");
  if (btnRegister) btnRegister.onclick = () => {
    const name = regName.value.trim();
    const legajo = regLegajo.value.trim();
    const company = regCompany.value.trim();
    const pin = regPin.value.trim();

    if (!name || !legajo || pin.length !== 4) return alert("Datos inválidos");

    initDriverProfile({ name, legajo, company, pin });
    alert("Terminal registrada");
    showScreen("mainScreen");
  };

  // ================== VIAJES ==================
  const destinoInput = document.getElementById("destinoInput");
  const turnoInput = document.getElementById("turnoInput");

  const btnGuardarViaje = document.getElementById("btnGuardarViaje");
  if (btnGuardarViaje) btnGuardarViaje.onclick = () => {
    if (!getActiveOrder()) return alert("No hay jornada activa");

    const destino = destinoInput.value;
    const turno = Number(turnoInput.value);

    if (!destino) return alert("Seleccione destino");

    // Primer viaje del día = toma Tome/Cese automático
    const order = getActiveOrder();
    const esPrimerViaje = order.travels.length === 0;

    addTravel(destino, turno, null);

    if (esPrimerViaje) {
      setTomeCese(true);
      console.log("TOME/CESE AUTOMÁTICO ACTIVADO");
    }

    alert("Viaje guardado");
    showScreen("mainScreen");
  };

  // ================== GUARDIAS ==================
  const btnGuardarGuardia = document.getElementById("btnGuardarGuardia");
  if (btnGuardarGuardia) btnGuardarGuardia.onclick = () => {
    if (!getActiveOrder()) return alert("No hay jornada activa");

    const type = guardType.value;
    const hours = parseFloat(guardHours.value);
    if (!hours || hours <= 0) return alert("Ingrese horas válidas");

    addGuard(type, hours);
    alert("Guardia guardada");
    showScreen("mainScreen");
  };
});

// ================== UI INFO ==================
function refreshOrderUI() {
  const o = getActiveOrder();
  const info = document.getElementById("ordenActivaInfo");
  if (info) info.innerText = o ? "🟢 Jornada activa: " + o.orderNumber : "🔴 Sin jornada activa";
}

function showDriver() {
  const d = getDriver();
  const driverInfo = document.getElementById("driverInfo");
  if (d && driverInfo) driverInfo.innerText = `Chofer: ${d.name} | Legajo: ${d.legajo}`;
}

// ================== LISTA VIAJES ==================
function renderListaViajes() {
  const container = document.getElementById("listaViajesContainer");
  const order = getActiveOrder();

  if (!order || order.travels.length === 0) {
    container.innerHTML = "<p>No hay viajes registrados.</p>";
    return;
  }

  let html = `
  <table width="100%" border="1" style="border-collapse:collapse;font-size:14px;">
  <tr>
    <th>#</th>
    <th>Hora</th>
    <th>Destino</th>
    <th>Km Empresa</th>
    <th>Acoplado</th>
  </tr>`;

  order.travels.forEach((v, i) => {
    const hora = new Date(v.createdAt).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });

    html += `
    <tr>
      <td>${i + 1}</td>
      <td>${hora}</td>
      <td>${v.destino}</td>
      <td>${v.kmEmpresa}</td>
      <td>${v.acoplado ? "🚌 SI" : "NO"}</td>
    </tr>`;
  });

  html += "</table>";
  container.innerHTML = html;
}

// ================== LISTA GUARDIAS ==================
function renderListaGuardias() {
  const container = document.getElementById("listaGuardiasContainer");
  const order = getActiveOrder();

  if (!order || order.guards.length === 0) {
    container.innerHTML = "<p>No hay guardias registradas.</p>";
    return;
  }

  let html = "<table border='1' width='100%'><tr><th>#</th><th>Tipo</th><th>Horas</th></tr>";
  order.guards.forEach((g, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${g.type}</td>
      <td>${g.hours}</td>
    </tr>`;
  });
  html += "</table>";

  container.innerHTML = html;
}

// ================== RESUMEN DEL DÍA ==================
function renderResumenDia() {
  const container = document.getElementById("resumenDiaContainer");
  const s = getTodaySummary();

  container.innerHTML = `
    <p><b>Kilómetros:</b> ${s.kmTotal}</p>
    <p><b>Acoplados:</b> ${s.acoplados}</p>
    <p><b>Guardias (horas):</b> ${s.guardiasHoras}</p>
    <p><b>Monto total:</b> $${Math.round(s.monto)}</p>
  `;
}