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

function buscarSugerenciasCarteles(texto){
  const buscado = normalizarTexto(texto);
  const catalogo = window.ROUTES_SIGNS || {};
  const resultados = [];

  for(const destino in catalogo){
    if(destino.startsWith("_")) continue;

    const coches = catalogo[destino];
    const servicios = new Set([
      ...Object.keys(coches.marcopolo || {}),
      ...Object.keys(coches.neobus   || {})
    ]);

    for(const servicio of servicios){
      const label = destino + " - " + servicio;
      if(normalizarTexto(label).includes(buscado)){
        resultados.push({
          label,
          destino,
          servicio,
          km: buscarKmRuta("Montevideo", destino) || 0
        });
      }
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
      inputDestino.value = m.destino;

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

      const kmCalculado = buscarKmRuta(origenActual, m.destino) || m.km;
      document.getElementById("kmTravels").value = kmCalculado;

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

  const valor = document.getElementById("destinationTravels").value.trim();
  const tipo  = document.getElementById("tipoCoche").value;
  const div   = document.getElementById("codigoCartel");

  if(!valor){
    div.innerHTML = "";
    return;
  }

  // Parsear destino y servicio (input limpio usa window._servicioCartel como fallback)
  const sep      = valor.indexOf(" - ");
  const destino  = sep !== -1 ? valor.substring(0, sep)  : valor;
  const servicio = sep !== -1 ? valor.substring(sep + 3) : (window._servicioCartel || null);

  const catalogo   = window.ROUTES_SIGNS || {};
  const destinoKey = normalizarTexto(destino);
  let entrada = null;
  for(const ruta in catalogo){
    if(normalizarTexto(ruta) === destinoKey){ entrada = catalogo[ruta]; break; }
  }

  if(!entrada){
    div.innerHTML = "Sin código disponible";
    return;
  }

  // Con servicio seleccionado: mostrar código limpio
  if(servicio){
    if(tipo){
      const codigo = (entrada[tipo] || {})[servicio];
      div.innerHTML = codigo || "-";
    } else {
      const mp = (entrada.marcopolo || {})[servicio];
      const nb = (entrada.neobus   || {})[servicio];
      div.innerHTML = [mp, nb].filter(Boolean).join(" / ") || "-";
    }
    return;
  }

  // Sin servicio: mostrar todos los códigos del tipo seleccionado
  const formatear = (obj) =>
    Object.entries(obj).map(([srv, cod]) =>
      `<b>${cod}</b> <span style="color:#666">${srv}</span>`
    ).join(" &nbsp;|&nbsp; ");

  if(tipo){
    const servicios = entrada[tipo];
    div.innerHTML = servicios ? formatear(servicios) : "Sin código disponible para " + tipo;
  } else {
    div.innerHTML =
      "<div>Marcopolo: " + formatear(entrada.marcopolo || {}) + "</div>" +
      "<div style='margin-top:4px'>Neobus: " + formatear(entrada.neobus || {}) + "</div>";
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
