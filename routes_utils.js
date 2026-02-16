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

  const input = document.getElementById("destinationTravels");
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

    div.innerText = `${m.destinoFinal} (${m.km} km)`;

    div.onclick = () => {

      input.value = m.destinoFinal;

      let kmCalculado =
        buscarKmRuta(origenActual, m.destinoFinal) || m.km;

      document.getElementById("kmTravels").value = kmCalculado;

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

    document.getElementById("kmTravels").value = kmCalculado;

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

// =====================================================
// EXPORTS
// =====================================================

window.autoKmPorDestino = autoKmPorDestino;
window.buscarKmRuta = buscarKmRuta;
window.buscarRutaCoincidente = buscarRutaCoincidente;
window.buscarMultiplesRutas = buscarMultiplesRutas;
window.mostrarHorariosOficiales = mostrarHorariosOficiales;
