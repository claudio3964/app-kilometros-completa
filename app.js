alert('APP.JS NUEVO CARGADO');
 

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

    // 🔴 IMPORTANTE: NO bloquear el body en mobile
    if (window.innerWidth > 768) {
        document.body.style.overflow = 'hidden';
    }

    buscarRutasPopup('');
    console.log('📱 abrirRutaPopup ejecutado');
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

    const resultados = texto.length < 1
        ? Object.entries(serviciosDB)
        : Object.entries(serviciosDB).filter(([_, ruta]) =>
            ruta.nombre.toLowerCase().includes(texto)
          );

    if (resultados.length === 0) {
        lista.innerHTML = '<div class="no-data">No hay rutas</div>';
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

    console.log(
        '📋 items popup:',
        document.querySelectorAll('#listaRutasPopup .ruta-popup-item').length
    );
}

/* ===============================
   6. INPUT BUSCAR RUTA (DESKTOP + MOBILE)
   =============================== */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('buscarRuta');
    if (!input) return;

    const abrir = () => {
        abrirRutaPopup();
        buscarRutasPopup(input.value);
    };

    input.addEventListener('focus', abrir);
    input.addEventListener('click', abrir);
    input.addEventListener('touchend', abrir);

    input.addEventListener('input', e => {
        buscarRutasPopup(e.target.value);
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
/* =========================================================
   APP.JS — BLOQUE 2 / 4
   UI CORE · MODOS · VIAJES
   ========================================================= */

/* ===============================
   8. UI CORE - PANTALLAS / MODALES
   =============================== */

function showScreen(screenId) {
    console.log('📺 Mostrando pantalla:', screenId);

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });

    const target = document.getElementById(screenId);

    if (!target) {
        console.error('❌ Pantalla no encontrada:', screenId);
        return;
    }

    target.style.display = 'block';
    target.classList.add('active');

    window.scrollTo(0, 0);
}

/* ===============================
   9. MODOS REGULAR / CONTRATADO
   =============================== */

function setMode(modo) {
    modoActual = modo;

    document.getElementById('btnRegular')?.classList.toggle('active', modo === 'regular');
    document.getElementById('btnContratado')?.classList.toggle('active', modo === 'contratado');

    const regular = document.getElementById('modoRegular');
    const contratado = document.getElementById('modoContratado');

    if (regular) regular.style.display = modo === 'regular' ? 'block' : 'none';
    if (contratado) contratado.style.display = modo === 'contratado' ? 'block' : 'none';

    if (modo === 'contratado') limpiarSeleccionRegular();
}

function limpiarSeleccionRegular() {
    rutaSeleccionada = null;
    servicioSeleccionado = null;

    const buscar = document.getElementById('buscarRuta');
    const servicio = document.getElementById('numeroServicio');
    const info = document.getElementById('infoAuto');

    if (buscar) buscar.value = '';
    if (servicio) servicio.innerHTML = '<option value="">Primero elegí una ruta...</option>';
    if (info) info.style.display = 'none';
}

/* ===============================
   10. INFO AUTOMÁTICA DE SERVICIO
   =============================== */

function actualizarInfoServicio() {
    const select = document.getElementById('numeroServicio');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;

    servicioSeleccionado = {
        numero: opt.value,
        tipo: opt.dataset.tipo,
        acoplado: opt.dataset.acoplado === 'true',
        reglas: opt.dataset.reglas
    };

    document.getElementById('autoTipo').textContent = servicioSeleccionado.tipo;
    document.getElementById('autoAcoplado').textContent = servicioSeleccionado.acoplado ? 'SÍ' : 'NO';
    document.getElementById('autoReglas').textContent = servicioSeleccionado.reglas || '';

    document.getElementById('infoAuto').style.display = 'block';
}

/* ===============================
   11. ALTA DE VIAJES
   =============================== */

function addTravel(event) {
    event.preventDefault();

    const orderNumber = document.getElementById('orderNumberTravels').value;
    const km = parseFloat(document.getElementById('kmTravels').value);
    const departureTime = document.getElementById('departureTimeTravels').value;
    const arrivalTime = document.getElementById('arrivalTimeTravels').value;
    const dateInput = document.getElementById('travelDate');

    let origin, destination, tipoServicio, conAcoplado, numeroServicio;

    if (modoActual === 'regular') {
        if (!rutaSeleccionada || !servicioSeleccionado) {
            alert('Seleccioná ruta y servicio');
            return;
        }
        [origin, destination] = rutaSeleccionada.nombre.split(' → ');
        tipoServicio = servicioSeleccionado.tipo;
        conAcoplado = servicioSeleccionado.acoplado;
        numeroServicio = servicioSeleccionado.numero;
    } else {
        origin = 'Montevideo';
        destination = document.getElementById('destinoContratado').value;
        tipoServicio = document.getElementById('tipoContratado').value;
        conAcoplado = document.getElementById('acopladoContratado').value === 'true';
        numeroServicio = document.getElementById('numeroContratado').value;

        detectarYCrearRuta(origin, destination, numeroServicio, tipoServicio, conAcoplado);
    }

    if (!orderNumber || !km || !departureTime || !arrivalTime) {
        alert('Faltan datos');
        return;
    }

    const start = new Date(`2000-01-01T${departureTime}`);
    const end = new Date(`2000-01-01T${arrivalTime}`);
    let hoursWorked = (end - start) / 36e5;
    if (hoursWorked < 0) hoursWorked += 24;

    const travel = {
        id: Date.now(),
        orderNumber,
        origin,
        destination,
        km,
        departureTime,
        arrivalTime,
        hoursWorked: hoursWorked.toFixed(2),
        date: dateInput?.value || new Date().toISOString().split('T')[0],
        viaticos: hoursWorked >= 9 ? 1 : 0,
        timestamp: new Date().toISOString(),
        tipoServicio,
        conAcoplado,
        numeroServicio,
        conductor: usuario.nombre
    };

    travels.push(travel);
    localStorage.setItem('bus_travels', JSON.stringify(travels));

    event.target.reset();
    limpiarSeleccionRegular();

    updateSummary();
    updateTravelTable();

    alert('✅ Viaje agregado');
    showScreen('mainScreen');
}
/* =========================================================
   APP.JS — BLOQUE 3 / 4
   GUARDIAS · RESÚMENES · TABLAS
   ========================================================= */

/* ===============================
   12. RESUMEN GENERAL
   =============================== */

function updateSummary() {
    const viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    const guardias = JSON.parse(localStorage.getItem('bus_guards') || '[]');

    const totalKm = viajes.reduce((s, v) => s + (parseFloat(v.km) || 0), 0);
    const totalHoras = viajes.reduce((s, v) => s + (parseFloat(v.hoursWorked) || 0), 0);
    const totalViaticos = viajes.reduce((s, v) => s + (v.viaticos || 0), 0);

    const el = (id) => document.getElementById(id);

    el('totalTravels') && (el('totalTravels').textContent = viajes.length);
    el('totalKm') && (el('totalKm').textContent = totalKm.toFixed(1));
    el('totalHours') && (el('totalHours').textContent = totalHoras.toFixed(1));
    el('totalViaticos') && (el('totalViaticos').textContent = totalViaticos);
    el('totalGuards') && (el('totalGuards').textContent = guardias.length);
}

/* ===============================
   13. TABLA DE VIAJES
   =============================== */

function updateTravelTable() {
    const tbody = document.getElementById('travelList');
    if (!tbody) return;

    const viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    tbody.innerHTML = '';

    if (viajes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No hay viajes</td></tr>';
        return;
    }

    viajes
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${v.date}</td>
                <td>${v.orderNumber}</td>
                <td>${v.origin}</td>
                <td>${v.destination}</td>
                <td>${v.km}</td>
                <td>${v.departureTime} - ${v.arrivalTime}</td>
                <td>${v.viaticos ? '✅' : '❌'}</td>
                <td>
                    <button onclick="deleteTravel(${v.id})">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
}

/* ===============================
   14. GUARDIAS
   =============================== */

function addGuard(event) {
    event.preventDefault();

    const orderNumber = document.getElementById('guardOrderNumber').value;
    const start = document.getElementById('guardStartTime').value;
    const end = document.getElementById('guardEndTime').value;
    const tarifa = parseFloat(document.getElementById('guardTarifa').value || 30);

    if (!orderNumber || !start || !end) {
        alert('Faltan datos');
        return;
    }

    const inicio = new Date(`2000-01-01T${start}`);
    const fin = new Date(`2000-01-01T${end}`);
    let horas = (fin - inicio) / 36e5;
    if (horas < 0) horas += 24;

    const guardia = {
        id: Date.now(),
        orderNumber,
        startTime: start,
        endTime: end,
        hours: horas.toFixed(2),
        monto: (horas * tarifa).toFixed(2),
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    };

    const guardias = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    guardias.push(guardia);
    localStorage.setItem('bus_guards', JSON.stringify(guardias));

    updateSummary();
    alert('✅ Guardia agregada');
    showScreen('mainScreen');
}

/* ===============================
   15. ELIMINAR VIAJE
   =============================== */

function deleteTravel(id) {
    if (!confirm('¿Eliminar viaje?')) return;
    let viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    viajes = viajes.filter(v => v.id !== id);
    localStorage.setItem('bus_travels', JSON.stringify(viajes));
    updateTravelTable();
    updateSummary();
}
/* =========================================================
   APP.JS — BLOQUE 4 / 4
   INICIALIZACIÓN FINAL
   ========================================================= */


