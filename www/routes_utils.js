// =====================================================
// NORMALIZADOR DE TEXTO (GLOBAL)
// =====================================================
function normalizarTexto(txt){

  if(!txt) return "";

  return txt
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, " ")
    .trim();
}

window.normalizarTexto = normalizarTexto;

// =====================================================
// BUSCADOR DE RUTAS MEJORADO
// =====================================================

function buscarRutaCoincidente(textoUsuario) {
  const buscado = normalizarTexto(textoUsuario);

  let candidataExacta = null;
  let candidataConX = null;
  let candidataParcial = null;

  for (const ruta in ROUTES_CATALOG) {

    const rutaNorm = normalizarTexto(ruta);
    const partes = rutaNorm.split("→");
    const destinoFinal = partes[1] ? partes[1].trim() : rutaNorm;

    if (destinoFinal.includes(buscado) && !destinoFinal.includes(" x ")) {
      candidataExacta = { ruta, km: ROUTES_CATALOG[ruta] };
      break;
    }

    if (destinoFinal.includes(buscado) && destinoFinal.includes(" x ")) {
      candidataConX = { ruta, km: ROUTES_CATALOG[ruta] };
    }

    if (rutaNorm.includes(buscado)) {
      candidataParcial = { ruta, km: ROUTES_CATALOG[ruta] };
    }
  }

  return candidataExacta || candidataConX || candidataParcial;
}



// =====================================================
// BUSCAR KM RUTA (VERSIÓN DEFINITIVA NORMALIZADA)
// =====================================================

function buscarKmRuta(origen, destino){

  if(!origen || !destino) return 0;

  const origenNorm = normalizarTexto(origen);
  const destinoNorm = normalizarTexto(destino);

  for(const ruta in ROUTES_CATALOG){

    const partes = ruta.split("→");

    const origenCatalogo = normalizarTexto(partes[0]);
    const destinoCatalogo = normalizarTexto(partes[1]);

    // Coincidencia directa
    if(origenNorm === origenCatalogo && destinoNorm === destinoCatalogo){
      return ROUTES_CATALOG[ruta];
    }

    // Coincidencia inversa (retorno)
    if(origenNorm === destinoCatalogo && destinoNorm === origenCatalogo){
      return ROUTES_CATALOG[ruta];
    }

  }

  return 0;
}

window.buscarKmRuta = buscarKmRuta;


// =====================================================
// BUSCAR MÚLTIPLES RUTAS
// =====================================================

function buscarMultiplesRutas(textoUsuario){

  const buscado = normalizarTexto(textoUsuario);
  let resultados = [];

  for (const ruta in ROUTES_CATALOG){

    const rutaNorm = normalizarTexto(ruta);
    const partes = rutaNorm.split("→");

    const origen = partes[0]?.trim();
    const destinoFinal = partes[1]?.trim();

    if (destinoFinal && destinoFinal.includes(buscado))
      resultados.push({
        rutaOriginal: ruta,
        destinoFinal,
        km: ROUTES_CATALOG[ruta]
      });

    if (origen && origen.includes(buscado))
      resultados.push({
        rutaOriginal: ruta,
        destinoFinal: origen,
        km: ROUTES_CATALOG[ruta]
      });
  }

  return resultados;
}

// =====================================================
// AUTOCOMPLETADO KM
// =====================================================

function buscarSugerenciasCarteles(texto) {
  const buscado = normalizarTexto(texto);
  const resultados = [];

  const origenActual = normalizarTexto(
    document.getElementById("originTravels")?.value || "montevideo"
  );

  for (const ruta in ROUTES_CATALOG) {
    const km = ROUTES_CATALOG[ruta];
    const rutaNorm = normalizarTexto(ruta);
    const partes = rutaNorm.split("→");
    if (partes.length < 2) continue;

    const origenRuta  = partes[0].trim();
    const destinoCompleto = partes[1].trim();

    // Separar destino base y variante
    const xIdx = destinoCompleto.indexOf(" x ");
    const destinoBase = xIdx !== -1 ? destinoCompleto.substring(0, xIdx).trim() : destinoCompleto;
    const variante    = xIdx !== -1 ? destinoCompleto.substring(xIdx + 3).trim() : null;

    // RUTA DIRECTA: origen coincide con origen seleccionado
    if (origenRuta === origenActual && destinoCompleto.includes(buscado)) {
      const label = variante ? destinoBase + " - x " + variante : destinoBase;
      resultados.push({ label, destino: destinoBase, variante, km });
    }

    // RUTA INVERSA: destino base coincide con origen seleccionado
    // → ofrecer el origen de esa ruta como destino disponible
    if (destinoBase === origenActual && origenRuta.includes(buscado)) {
      resultados.push({ label: origenRuta, destino: origenRuta, variante: null, km });
    }
  }

  return resultados;
}

function autoKmPorDestino(terminoDeEscribir = false){

  const inputDestino = document.getElementById("destinationTravels");
  const box          = document.getElementById("sugerenciasRutas");
  const texto        = inputDestino.value;
  const origenActual = document.getElementById("originTravels")?.value || "Montevideo";

  // limpiar código cartel y servicio guardado mientras el usuario escribe
  document.getElementById("codigoCartel").innerHTML = "";
  window._servicioCartel = null;
  window._destinoSeleccionado = false;

  if(!texto){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const matches = buscarSugerenciasCarteles(texto);

  if(matches.length === 0){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";
  box.innerHTML = "";

  matches.forEach(m => {

    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.cursor  = "pointer";
    div.innerText = m.label + (m.km ? ` (${m.km} km)` : "");

    div.onclick = () => {
      // destino LIMPIO — sin el " - servicio"
      inputDestino.value = m.variante ? m.destino + " x " + m.variante : m.destino;

      // guardar servicio para actualizarCodigoCartel
      window._servicioCartel = m.servicio;

      // intentar actualizar el select de servicio
      const mapaServicio = {
        "directo":     "DIRECTO",
        "directisimo": "DIRECTO",
        "turno":       "TURNO",
        "expreso":     "EXPRESO"
      };
      const selectEl = document.getElementById("numeroServicio");
      const valSelect = mapaServicio[m.servicio] || "";
      if(selectEl && valSelect){
        selectEl.value = valSelect;
        if(typeof actualizarInfoServicio === "function")
          actualizarInfoServicio();
      }

      document.getElementById("kmTravels").value = m.km;
      window._destinoSeleccionado = true;

      box.style.display = "none";

      mostrarHorariosOficiales(origenActual, m.destino);
      actualizarCodigoCartel();
    };

    box.appendChild(div);
  });
}

// =====================================================
// HORARIOS OFICIALES
// =====================================================

function mostrarHorariosOficiales(origen, destino){

  const ruta = `${origen} → ${destino}`;

  const horarios = SCHEDULE_COT[ruta];

  const box = document.getElementById("horariosOficiales");

  if(!horarios){

    box.style.display = "none";
    box.innerHTML = "";

    return;
  }

  box.innerHTML = "<b>Horarios sugeridos:</b>";

  box.style.display = "flex";

  horarios.forEach(h => {

    const btn = document.createElement("button");

    btn.textContent =
      `${h.salida} → ${h.llegada}`;

    btn.onclick = () => {

      document.getElementById("departureTimeTravels").value = h.salida;

      document.getElementById("arrivalTimeTravels").value = h.llegada;
    };

    box.appendChild(btn);
  });
}
function obtenerCodigosRuta(destino){
  if(!destino) return null;
  const key = normalizarTexto(destino);
  const catalogo = window.ROUTES_SIGNS || {};

  // 1) coincidencia exacta
  for(const ruta in catalogo){
    if(normalizarTexto(ruta) === key) return catalogo[ruta];
  }

  // 2) destino base antes del " x " (ej: "punta del este x piriapolis" → "punta del este")
  const base = key.split(" x ")[0].trim();
  if(base !== key){
    for(const ruta in catalogo){
      if(normalizarTexto(ruta) === base) return catalogo[ruta];
    }
  }

  return null;
}

function actualizarCodigoCartel(){

  const valor   = document.getElementById("destinationTravels").value.trim();
  const div     = document.getElementById("codigoCartel");
  const servicio = document.getElementById("numeroServicio")?.value;

  if (!window._destinoSeleccionado || !servicio) {
    div.innerHTML = "";
    return;
  }

  if(!valor){
    div.innerHTML = "";
    return;
  }

  const destinoBase = valor.split(" x ")[0].trim();

  const catalogo = window.ROUTES_SIGNS || {};
  const destinoKey = normalizarTexto(destinoBase);
  let entrada = null;
  for (const ruta in catalogo) {
    if (normalizarTexto(ruta) === destinoKey) { entrada = catalogo[ruta]; break; }
  }

  if (!entrada) { div.innerHTML = "Sin código disponible"; return; }

  const tipo = document.getElementById("tipoCoche")?.value;
  const servicioNorm = normalizarTexto(servicio);

  if (tipo) {
    const codigo = (entrada[tipo] || {})[servicioNorm];
    div.innerHTML = codigo || "-";
  } else {
    const mp = (entrada.marcopolo || {})[servicioNorm];
    const nb = (entrada.neobus || {})[servicioNorm];
    div.innerHTML = [mp && `<b>${mp}</b> Marcopolo`, nb && `<b>${nb}</b> Neobus`]
      .filter(Boolean).join(" &nbsp;|&nbsp; ") || "-";
  }
}

// =====================================================
// EXPORTS
// =====================================================

window.autoKmPorDestino = autoKmPorDestino;
window.buscarKmRuta = buscarKmRuta;
window.buscarRutaCoincidente = buscarRutaCoincidente;
window.buscarMultiplesRutas = buscarMultiplesRutas;
window.mostrarHorariosOficiales = mostrarHorariosOficiales;
window.obtenerCodigosRuta = obtenerCodigosRuta;
window.actualizarCodigoCartel = actualizarCodigoCartel;
