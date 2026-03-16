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

function autoKmPorDestino(terminoDeEscribir = false){

  const inputDestino = document.getElementById("destinationTravels");
  const inputOrigen = document.getElementById("originTravels");

  const input = inputDestino.value ? inputDestino : inputOrigen;

  const box = document.getElementById("sugerenciasRutas");

  const texto = input.value;

  const origenActual =
    document.getElementById("originTravels")?.value || "Montevideo";

  if (!texto){

    box.style.display = "none";
    box.innerHTML = "";
    return;

  }

  const matches = buscarMultiplesRutas(texto);

  if (matches.length === 0){

    box.style.display = "none";
    box.innerHTML = "";
    return;

  }

  box.style.display = "block";
  box.innerHTML = "";

  matches.forEach(m => {

    const div = document.createElement("div");

    div.style.padding = "8px";
    div.style.cursor = "pointer";

    // 🔧 MOSTRAR KM SOLO SI ES DESTINO
    if(input.id === "originTravels"){
      div.innerText = m.destinoFinal;
    }else{
      div.innerText = `${m.destinoFinal} (${m.km} km)`;
    }

    div.onclick = () => {

      input.value = m.destinoFinal;

      let kmCalculado =
        buscarKmRuta(origenActual, m.destinoFinal) || m.km;

      // 🔧 solo calcular km si estamos en destino
      if(input.id !== "originTravels"){
        document.getElementById("kmTravels").value = kmCalculado;
      }

      box.style.display = "none";

      mostrarHorariosOficiales(origenActual, m.destinoFinal);
    };

    box.appendChild(div);

  });

  const matchUnico = buscarRutaCoincidente(texto);

  if (matchUnico){

    const destinoFinal =
      matchUnico.ruta.split("→")[1].trim();

    const kmCalculado =
      buscarKmRuta(origenActual, destinoFinal) || matchUnico.km;

    if(input.id !== "originTravels"){
      document.getElementById("kmTravels").value = kmCalculado;
    }

    if (terminoDeEscribir){

      input.value = destinoFinal;

      box.style.display = "none";

      mostrarHorariosOficiales(origenActual, destinoFinal);

    }
  }
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

  const destino =
    document.getElementById("destinationTravels").value;

  const tipo =
    document.getElementById("tipoCoche").value;

  const div =
    document.getElementById("codigoCartel");

  const codigos = obtenerCodigosRuta(destino);

  if(!destino){
    div.innerHTML = "";
    return;
  }

  if(!codigos){
    div.innerHTML = "Sin código disponible";
    return;
  }

  const formatearServicios = (servicios) =>
    Object.entries(servicios)
      .map(([srv, cod]) => `<b>${cod}</b> <span style="color:#666">${srv}</span>`)
      .join(" &nbsp;|&nbsp; ");

  if(!tipo){
    div.innerHTML =
      "<div>Marcopolo: " + formatearServicios(codigos.marcopolo || {}) + "</div>" +
      "<div style='margin-top:4px'>Neobus: " + formatearServicios(codigos.neobus || {}) + "</div>";
    return;
  }

  const servicios = codigos[tipo];
  if(!servicios){
    div.innerHTML = "Sin código disponible para " + tipo;
    return;
  }

  div.innerHTML = formatearServicios(servicios);
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
