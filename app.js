/* =========================================================
   APP.JS — BLOQUE 1 / 4
   Configuración · Estado · Rutas · Popup de Rutas
   ========================================================= */

/* ===============================
   1. CONFIGURACIÓN GENERAL
   =============================== */

const KM_POR_HORA_GUARDIA = 20;

/* ===============================
   2. ESTADO GLOBAL Y STORAGE
   =============================== */

let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let favoriteDestinations = JSON.parse(localStorage.getItem('bus_favorites') || '[]');
let usuario = JSON.parse(
    localStorage.getItem('travelUser') ||
    '{"nombre":"Conductor","numero":"000","rol":"driver"}'
);

// Estado del sistema inteligente
let rutaSeleccionada = null;
let servicioSeleccionado = null;
let modoActual = 'regular';

/* ===============================
   3. BASE DE RUTAS Y SERVICIOS
   =============================== */

const serviciosDB = {

    /* ===== DESDE MONTEVIDEO ===== */
    "MVD-PDE": {
        nombre: "Montevideo → Punta del Este",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false, reglas: "Primer coche" },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false },
            { numero: "3", tipo: "DIRECTO", acoplado: true },
            { numero: "51", tipo: "PAN AZUCAR - SAN CARLOS", acoplado: true },
            { numero: "31", tipo: "RUTA 8/9 - PAN AZUCAR - SAN CARLOS", acoplado: true }
        ]
    },

    "MVD-PIRIAPOLIS": {
        nombre: "Montevideo → Piriápolis",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false },
            { numero: "4", tipo: "DIRECTO", acoplado: true }
        ]
    },

    "MVD-COLONIA": {
        nombre: "Montevideo → Colonia",
        servicios: [
            { numero: "11", tipo: "TURNO", acoplado: false },
            { numero: "12", tipo: "DIRECTO", acoplado: true }
        ]
    },

    "MVD-CHUY": {
        nombre: "Montevideo → Chuy",
        servicios: [
            { numero: "41", tipo: "TURNO", acoplado: false },
            { numero: "42", tipo: "DIRECTO", acoplado: true }
        ]
    },

    "MVD-PEDRERA": {
        nombre: "Montevideo → La Pedrera",
        servicios: [
            { numero: "21", tipo: "TURNO", acoplado: false },
            { numero: "22", tipo: "DIRECTO", acoplado: true }
        ]
    },

    /* ===== HACIA MONTEVIDEO ===== */
    "PDE-MVD": {
        nombre: "Punta del Este → Montevideo",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false },
            { numero: "3", tipo: "DIRECTO", acoplado: true }
        ]
    }
};

/* ===============================
   4. SISTEMA AUTO-DETECCIÓN RUTAS
   =============================== */

function detectarYCrearRuta(origen, destino, numero, tipo, acoplado) {
    const key = `${origen.toUpperCase().replace(/ /g,'_')}-${destino.toUpperCase().replace(/ /g,'_')}`;

    if (serviciosDB[key]) return key;

    serviciosDB[key] = {
        nombre: `${origen} → ${destino}`,
        servicios: [{
            numero,
            tipo,
            acoplado,
            reglas: "Ruta creada automáticamente"
        }]
    };

    console.log('✅ Ruta creada:', key);
    return key;
}

/* ===============================
   5. POPUP DE SELECCIÓN DE RUTA
   (sistema único y definitivo)
   =============================== */

function abrirRutaPopup() {
    const popup = document.getElementById('rutaPopup');
    if (!popup) return;

    popup.classList.add('active');
    document.body.style.overflow = 'hidden';
    buscarRutasPopup('');
}

function cerrarRutaPopup() {
    const popup = document.getElementById('rutaPopup');
    if (!popup) return;

    popup.classList.remove('active');
    document.body.style.overflow = '';
}

function buscarRutasPopup(termino) {
    const lista = document.getElementById('listaRutasPopup');
    if (!lista) return;

    const texto = termino.toLowerCase().trim();

    if (texto.length < 2) {
        lista.innerHTML = '<div class="no-data">Escribí para buscar rutas</div>';
        return;
    }

    const resultados = Object.entries(serviciosDB).filter(([_, ruta]) =>
        ruta.nombre.toLowerCase().includes(texto)
    );

    if (resultados.length === 0) {
        lista.innerHTML = '<div class="no-data">No hay rutas que coincidan</div>';
        return;
    }

    lista.innerHTML = resultados.map(([key, ruta]) => `
        <div class="ruta-popup-item"
             onclick="seleccionarRuta('${key}'); cerrarRutaPopup();">
            <strong>${ruta.nombre}</strong>
            <div style="font-size:.85em;opacity:.7">
                Servicios: ${ruta.servicios.map(s => s.numero).join(', ')}
            </div>
        </div>
    `).join('');
}

/* ===============================
   6. INPUT BUSCAR RUTA
   =============================== */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('buscarRuta');
    if (!input) return;

    input.addEventListener('focus', () => {
        abrirRutaPopup();
        buscarRutasPopup(input.value);
    });

    input.addEventListener('input', e => {
        if (e.target.value.trim().length >= 2) {
            abrirRutaPopup();
            buscarRutasPopup(e.target.value);
        }
    });
});

/* ===============================
   7. SELECCIÓN DE RUTA
   =============================== */

function seleccionarRuta(rutaKey) {
    rutaSeleccionada = serviciosDB[rutaKey];
    if (!rutaSeleccionada) return;

    const [origen, destino] = rutaSeleccionada.nombre.split(' → ');
    document.getElementById('originTravels').value = origen;
    document.getElementById('destinationTravels').value = destino;
    document.getElementById('buscarRuta').value = rutaSeleccionada.nombre;

    const select = document.getElementById('numeroServicio');
    select.innerHTML = '<option value="">Elegí el servicio...</option>';

    rutaSeleccionada.servicios.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.numero;
        opt.textContent = `[${s.numero}] ${s.tipo} ${s.acoplado ? '🚛' : ''}`;
        opt.dataset.tipo = s.tipo;
        opt.dataset.acoplado = s.acoplado;
        opt.dataset.reglas = s.reglas || '';
        select.appendChild(opt);
    });

    select.style.display = 'block';
}
