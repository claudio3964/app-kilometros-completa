/* =========================================================
   APP.JS — VERSIÓN LIMPIA Y BLINDADA
   ========================================================= */

/* ===============================
   1. CONFIGURACIÓN
=============================== */

const KM_POR_HORA_GUARDIA = 20;

/* ===============================
   2. ESTADO GLOBAL + STORAGE
=============================== */

let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let guards = JSON.parse(localStorage.getItem('bus_guards') || '[]');

let usuario = JSON.parse(
    localStorage.getItem('travelUser') || 'null'
);

// estado de viaje
let rutaSeleccionada = null;
let servicioSeleccionado = null;
let modoActual = 'regular';

/* ===============================
   3. SISTEMA DE PANTALLAS (BLINDADO)
=============================== */

function showScreen(screenId) {
    console.log('🎯 showScreen →', screenId);

    // apagar todas
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

    requestAnimationFrame(() => {
        target.scrollTop = 0;
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    });
}

/* ===============================
   4. INICIALIZACIÓN APP
=============================== */

document.addEventListener('DOMContentLoaded', () => {
    // reset total
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });

    // splash
    showScreen('splashScreen');

    setTimeout(() => {
        if (usuario) {
            showScreen('mainScreen');
        } else {
            showScreen('loginScreen');
        }
    }, 1200);
});

/* ===============================
   5. LOGIN / USUARIO
=============================== */

function guardarUsuario() {
    const numero = document.getElementById('userNumber').value.trim();
    const nombre = document.getElementById('userName').value.trim();
    const rol = document.getElementById('userRole').value;

    if (!numero || !nombre) {
        alert('Completa todos los datos');
        return;
    }

    usuario = { numero, nombre, rol };
    localStorage.setItem('travelUser', JSON.stringify(usuario));

    showScreen('mainScreen');
}

/* ===============================
   6. BASE DE RUTAS Y SERVICIOS
=============================== */

const serviciosDB = {
    "MVD-PDE": {
        nombre: "Montevideo → Punta del Este",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false },
            { numero: "3", tipo: "DIRECTO", acoplado: true }
        ]
    },
    "PDE-MVD": {
        nombre: "Punta del Este → Montevideo",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false },
            { numero: "3", tipo: "DIRECTO", acoplado: true }
        ]
    }
};

/* ===============================
   7. POPUP RUTAS
=============================== */

function abrirRutaPopup() {
    const popup = document.getElementById('rutaPopup');
    if (!popup) return;
    popup.classList.add('active');
    buscarRutasPopup('');
}

function cerrarRutaPopup() {
    const popup = document.getElementById('rutaPopup');
    if (!popup) return;
    popup.classList.remove('active');
}

function buscarRutasPopup(termino) {
    const lista = document.getElementById('listaRutasPopup');
    if (!lista) return;

    const t = termino.toLowerCase();
    const rutas = Object.entries(serviciosDB).filter(
        ([_, r]) => r.nombre.toLowerCase().includes(t)
    );

    lista.innerHTML = rutas.map(([key, ruta]) => `
        <div class="ruta-popup-item"
             onclick="seleccionarRuta('${key}'); cerrarRutaPopup();">
            ${ruta.nombre}
        </div>
    `).join('');
}

function seleccionarRuta(key) {
    rutaSeleccionada = serviciosDB[key];
    if (!rutaSeleccionada) return;

    const [origen, destino] = rutaSeleccionada.nombre.split(' → ');
    document.getElementById('originTravels').value = origen;
    document.getElementById('destinationTravels').value = destino;
    document.getElementById('buscarRuta').value = rutaSeleccionada.nombre;

    const select = document.getElementById('numeroServicio');
    select.innerHTML = '<option value="">Elegí servicio</option>';

    rutaSeleccionada.servicios.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.numero;
        opt.dataset.tipo = s.tipo;
        opt.dataset.acoplado = s.acoplado;
        opt.textContent = `[${s.numero}] ${s.tipo}`;
        select.appendChild(opt);
    });
}

/* ===============================
   8. MODOS DE VIAJE
=============================== */

function setMode(modo) {
    modoActual = modo;

    document.getElementById('modoRegular').style.display =
        modo === 'regular' ? 'block' : 'none';

    document.getElementById('modoContratado').style.display =
        modo === 'contratado' ? 'block' : 'none';
}

/* ===============================
   9. ALTA DE VIAJES
=============================== */

function addTravel(event) {
    event.preventDefault();

    const orderNumber = orderNumberTravels.value;
    const km = parseFloat(kmTravels.value);
    const dep = departureTimeTravels.value;
    const arr = arrivalTimeTravels.value;

    if (!orderNumber || !km || !dep || !arr) {
        alert('Faltan datos');
        return;
    }

    let origin, destination, tipoServicio, acoplado, numeroServicio;

    if (modoActual === 'regular') {
        if (!rutaSeleccionada || !numeroServicio) {
            alert('Seleccioná ruta y servicio');
            return;
        }
        [origin, destination] = rutaSeleccionada.nombre.split(' → ');
    } else {
        origin = 'Montevideo';
        destination = destinoContratado.value;
        tipoServicio = tipoContratado.value;
        acoplado = acopladoContratado.value === 'true';
        numeroServicio = numeroContratado.value;
    }

    const inicio = new Date(`2000-01-01T${dep}`);
    const fin = new Date(`2000-01-01T${arr}`);
    let horas = (fin - inicio) / 36e5;
    if (horas < 0) horas += 24;

    const travel = {
        id: Date.now(),
        orderNumber,
        origin,
        destination,
        km,
        dep,
        arr,
        horas: horas.toFixed(2),
        conductor: usuario?.nombre || '—',
        timestamp: new Date().toISOString()
    };

    travels.push(travel);
    localStorage.setItem('bus_travels', JSON.stringify(travels));

    alert('✅ Viaje agregado');
    showScreen('mainScreen');
}

/* ===============================
   10. GUARDIAS
=============================== */

function addGuard(event) {
    event.preventDefault();

    const orderNumber = guardOrderNumber.value;
    const start = guardStartTime.value;
    const end = guardEndTime.value;
    const tarifa = parseFloat(guardTarifa.value || 30);

    if (!orderNumber || !start || !end) {
        alert('Faltan datos');
        return;
    }

    const inicio = new Date(`2000-01-01T${start}`);
    const fin = new Date(`2000-01-01T${end}`);
    let horas = (fin - inicio) / 36e5;
    if (horas < 0) horas += 24;

    guards.push({
        id: Date.now(),
        orderNumber,
        horas: horas.toFixed(2),
        monto: (horas * tarifa).toFixed(2),
        timestamp: new Date().toISOString()
    });

    localStorage.setItem('bus_guards', JSON.stringify(guards));
    alert('✅ Guardia agregada');
    showScreen('mainScreen');
}



