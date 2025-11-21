// VARIABLES GLOBALES
let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let favoriteDestinations = JSON.parse(localStorage.getItem('bus_favorites') || '[]');

// ===== SISTEMA INTELIGENTE DE VIAJES =====
const serviciosDB = {
    // DESDE MONTEVIDEO
    "MVD-PDE": {
        nombre: "Montevideo → Punta del Este",
        servicios: [
            { numero: "1", tipo: "PIRIAPOLIS", acoplado: false, reglas: "Por Piriapolis" },
            { numero: "1", tipo: "PUNTA NEGRA", acoplado: false, reglas: "Punta Negra directo" },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false, reglas: "Semi directo o como 1 si no hay Piriapolis" },
            { numero: "3", tipo: "DIRECTO", acoplado: true, reglas: "Directo Pde o 2 si no hay Piriapolis" },
            { numero: "4", tipo: "PIRIAPOLIS DIRECTO", acoplado: false, reglas: "Directo a Piriapolis" },
            { numero: "51", tipo: "PAN AZUCAR - SAN CARLOS", acoplado: true, reglas: "Por Pan de Azúcar y San Carlos" },
            { numero: "31", tipo: "RUTA 8/9 - PAN AZUCAR - SAN CARLOS", acoplado: true, reglas: "Por Ruta 8 y 9, Pan de Azúcar y San Carlos" }
        ]
    },
    "MVD-COLONIA": {
        nombre: "Montevideo → Colonia",
        servicios: [
            { numero: "11", tipo: "TURNO", acoplado: false, reglas: "Servicio regular" },
            { numero: "12", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Colonia" }
        ]
    },
    "MVD-CHUY": {
        nombre: "Montevideo → Chuy",
        servicios: [
            { numero: "41", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Chuy" },
            { numero: "42", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Chuy" }
        ]
    },
    "MVD-PIRIAPOLIS": {
        nombre: "Montevideo → Piriapolis",
        servicios: [
            { numero: "4", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Piriapolis" }
        ]
    },
    "MVD-PEDRERA": {
        nombre: "Montevideo → La Pedrera",
        servicios: [
            { numero: "21", tipo: "DIRECTO", acoplado: true, reglas: "Directo a La Pedrera" },
            { numero: "22", tipo: "DIRECTO", acoplado: true, reglas: "Directo a La Pedrera" }
        ]
    },
    "MVD-GARZON": {
        nombre: "Montevideo → Laguna Garzón",
        servicios: [
            { numero: "2", tipo: "REGULAR", acoplado: false, reglas: "Servicio regular" }
        ]
    },
    "MVD-PUNTA-NEGRA": {
        nombre: "Montevideo → Punta Negra",
        servicios: [
            { numero: "1", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Punta Negra" },
            { numero: "11", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Punta Negra" }
        ]
    },

    // HACIA MONTEVIDEO
    "PDE-MVD": {
        nombre: "Punta del Este → Montevideo",
        servicios: [
            { numero: "1", tipo: "PIRIAPOLIS", acoplado: false, reglas: "Por Piriapolis" },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false, reglas: "Semi directo o como 1 si no hay Piriapolis" },
            { numero: "3", tipo: "DIRECTO", acoplado: true, reglas: "Directo o 2 si no hay Piriapolis" },
            { numero: "31", tipo: "RUTA 8/9", acoplado: true, reglas: "Por Ruta 8 y 9" },
            { numero: "51", tipo: "SAN CARLOS - PAN AZUCAR", acoplado: true, reglas: "Por San Carlos y Pan de Azúcar" }
        ]
    },
    "COLONIA-MVD": {
        nombre: "Colonia → Montevideo",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false, reglas: "Servicio regular" },
            { numero: "2", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Montevideo" }
        ]
    },
    "CHUY-MVD": {
        nombre: "Chuy → Montevideo",
        servicios: [
            { numero: "61", tipo: "REGULAR", acoplado: true, reglas: "Servicio regular" },
            { numero: "62", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Montevideo" }
        ]
    },
    "PIRIAPOLIS-MVD": {
        nombre: "Piriapolis → Montevideo",
        servicios: [
            { numero: "42", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Montevideo" }
        ]
    },
    "PEDRERA-MVD": {
        nombre: "La Pedrera → Montevideo",
        servicios: [
            { numero: "1", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Montevideo" }
        ]
    },
    "GARZON-MVD": {
        nombre: "Laguna Garzón → Montevideo",
        servicios: [
            { numero: "81", tipo: "REGULAR", acoplado: false, reglas: "Servicio regular" }
        ]
    },
    "PUNTA-NEGRA-MVD": {
        nombre: "Punta Negra → Montevideo",
        servicios: [
            { numero: "11", tipo: "DIRECTO", acoplado: false, reglas: "Directo a Montevideo" }
        ]
    },
    "MALDONADO-MVD": {
        nombre: "Maldonado Terminal → Montevideo",
        servicios: [
            { numero: "21", tipo: "DIRECTO", acoplado: true, reglas: "Directo desde Maldonado" },
            { numero: "22", tipo: "DIRECTO", acoplado: true, reglas: "Directo desde Maldonado" }
        ]
    }
};

// VARIABLES DEL SISTEMA INTELIGENTE
let rutaSeleccionada = null;
let servicioSeleccionado = null;
let modoActual = 'regular';

// FUNCIONES DEL SISTEMA INTELIGENTE
function setMode(modo) {
    modoActual = modo;
    
    // Actualizar botones
    document.getElementById('btnRegular').classList.toggle('active', modo === 'regular');
    document.getElementById('btnContratado').classList.toggle('active', modo === 'contratado');
    
    // Mostrar/ocultar secciones
    document.getElementById('modoRegular').style.display = modo === 'regular' ? 'block' : 'none';
    document.getElementById('modoContratado').style.display = modo === 'contratado' ? 'block' : 'none';
    
    // Limpiar selecciones al cambiar modo
    if (modo === 'contratado') {
        limpiarSeleccionRegular();
    }
}

function buscarRutas(termino) {
    const sugerencias = document.getElementById('sugerenciasRutas');
    sugerencias.innerHTML = '';
    
    if (!termino || termino.length < 2) {
        sugerencias.style.display = 'none';
        return;
    }
    
    const busqueda = termino.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const resultados = [];
    
    for (const [key, ruta] of Object.entries(serviciosDB)) {
        const nombreBusqueda = ruta.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (nombreBusqueda.includes(busqueda)) {
            resultados.push({ key, ruta });
        }
    }
    
    if (resultados.length === 0) {
        sugerencias.style.display = 'none';
        return;
    }
    
    sugerencias.innerHTML = resultados.map(({ key, ruta }) => `
        <div class="sugerencia-item" onclick="seleccionarRuta('${key}')">
            <div class="sugerencia-nombre">${ruta.nombre}</div>
            <div class="sugerencia-codigos">Servicios: ${ruta.servicios.map(s => s.numero).join(', ')}</div>
        </div>
    `).join('');
    
    sugerencias.style.display = 'block';
}

function seleccionarRuta(rutaKey) {
    rutaSeleccionada = serviciosDB[rutaKey];
    
    // Actualizar campos de origen y destino
    const [origen, destino] = rutaSeleccionada.nombre.split(' → ');
    document.getElementById('originTravels').value = origen;
    document.getElementById('destinationTravels').value = destino;
    
    // Llenar selector de servicios
    const selectServicio = document.getElementById('numeroServicio');
    selectServicio.innerHTML = '<option value="">Elegí el servicio...</option>';
    
    rutaSeleccionada.servicios.forEach(servicio => {
        const option = document.createElement('option');
        option.value = servicio.numero;
        option.textContent = `[${servicio.numero}] ${servicio.tipo} ${servicio.acoplado ? '✅' : ''}`;
        option.setAttribute('data-tipo', servicio.tipo);
        option.setAttribute('data-acoplado', servicio.acoplado);
        option.setAttribute('data-reglas', servicio.reglas);
        selectServicio.appendChild(option);
    });
    
    // Ocultar sugerencias
    document.getElementById('sugerenciasRutas').style.display = 'none';
    document.getElementById('buscarRuta').value = rutaSeleccionada.nombre;
    
    // Mostrar selector de servicios
    selectServicio.style.display = 'block';
}

function actualizarInfoServicio() {
    const selectServicio = document.getElementById('numeroServicio');
    const selectedOption = selectServicio.options[selectServicio.selectedIndex];
    
    if (!selectedOption.value) {
        document.getElementById('infoAuto').style.display = 'none';
        servicioSeleccionado = null;
        return;
    }
    
    servicioSeleccionado = {
        numero: selectedOption.value,
        tipo: selectedOption.getAttribute('data-tipo'),
        acoplado: selectedOption.getAttribute('data-acoplado') === 'true',
        reglas: selectedOption.getAttribute('data-reglas')
    };
    
    // Actualizar info automática
    document.getElementById('autoTipo').textContent = servicioSeleccionado.tipo;
    document.getElementById('autoAcoplado').textContent = servicioSeleccionado.acoplado ? 'SÍ ✅' : 'NO ❌';
    document.getElementById('autoAcoplado').className = servicioSeleccionado.acoplado ? 'info-value acoplado-si' : 'info-value acoplado-no';
    document.getElementById('autoReglas').textContent = servicioSeleccionado.reglas;
    
    document.getElementById('infoAuto').style.display = 'block';
}

function limpiarSeleccionRegular() {
    rutaSeleccionada = null;
    servicioSeleccionado = null;
    document.getElementById('buscarRuta').value = '';
    document.getElementById('numeroServicio').innerHTML = '<option value="">Primero elegí una ruta...</option>';
    document.getElementById('infoAuto').style.display = 'none';
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', function() {
    updateTodayDate();
    updateSummary();
    
    // Configurar evento para importar datos
    document.getElementById('backupFile')?.addEventListener('change', handleFileSelect);
});

// FUNCIONES DE NAVEGACIÓN
function showScreen(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar pantalla seleccionada
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Actualizar datos específicos de cada pantalla
    if (screenId === 'mainScreen') {
        updateSummary();
    } else if (screenId === 'travelScreen') {
        updateTravelTable();
        // Limpiar selección al entrar a viajes
        limpiarSeleccionRegular();
    } else if (screenId === 'guardScreen') {
        updateGuardList();
    } else if (screenId === 'travelListScreen') {
        updateAllTravelsList();
    } else if (screenId === 'guardListScreen') {
        updateAllGuardsList();
    }
    
    // 🆕 NUEVAS LISTAS MEJORADAS
    if (screenId === 'travelListScreen') renderViajesList();
    if (screenId === 'guardListScreen') renderGuardiasList();
}

// FUNCIONES DE VIAJES - VERSIÓN MEJORADA CON SISTEMA INTELIGENTE
function addTravel(event) {
    event.preventDefault();
    
    const orderNumber = document.getElementById('orderNumberTravels')?.value || '';
    const km = parseFloat(document.getElementById('kmTravels')?.value) || 0;
    const departureTime = document.getElementById('departureTimeTravels')?.value || '';
    const arrivalTime = document.getElementById('arrivalTimeTravels')?.value || '';
    
    let origin, destination, tipoServicio, conAcoplado, numeroServicio;
    
    if (modoActual === 'regular') {
        // MODO REGULAR - usar datos automáticos
        if (!rutaSeleccionada || !servicioSeleccionado) {
            alert('Por favor selecciona una ruta y servicio válidos');
            return;
        }
        
        const [origen, destino] = rutaSeleccionada.nombre.split(' → ');
        origin = origen;
        destination = destino;
        tipoServicio = servicioSeleccionado.tipo;
        conAcoplado = servicioSeleccionado.acoplado;
        numeroServicio = servicioSeleccionado.numero;
        
    } else {
        // MODO CONTRATADO - usar datos manuales
        origin = 'Montevideo'; // Por defecto desde MVD
        destination = document.getElementById('destinoContratado')?.value || '';
        tipoServicio = document.getElementById('tipoContratado')?.value || 'ESPECIAL';
        conAcoplado = document.getElementById('acopladoContratado')?.value === 'true';
        numeroServicio = document.getElementById('numeroContratado')?.value || '';
        
        if (!destination) {
            alert('Por favor ingresa el destino contratado');
            return;
        }
    }
    
    if (!orderNumber || !km || !departureTime || !arrivalTime) {
        alert('Complete todos los campos obligatorios');
        return;
    }
    
    // Calcular horas trabajadas
    const start = new Date(`2000-01-01T${departureTime}`);
    const end = new Date(`2000-01-01T${arrivalTime}`);
    let hoursWorked = (end - start) / (1000 * 60 * 60);
    if (hoursWorked < 0) hoursWorked += 24;
    
    if (hoursWorked <= 0) {
        alert('La hora de llegada debe ser posterior a la de salida');
        return;
    }
    
    const travel = {
        id: Date.now(),
        orderNumber, 
        origin, 
        destination, 
        km,
        departureTime, 
        arrivalTime, 
        hoursWorked: hoursWorked.toFixed(2),
        date: new Date().toLocaleDateString('es-ES'),
        viaticos: hoursWorked >= 9 ? 1 : 0,
        timestamp: new Date().toISOString(),
        // NUEVOS CAMPOS DEL SISTEMA INTELIGENTE
        modo: modoActual,
        tipoServicio: tipoServicio,
        conAcoplado: conAcoplado,
        numeroServicio: numeroServicio
    };
    
    travels.push(travel);
    localStorage.setItem('bus_travels', JSON.stringify(travels));
    
    // Limpiar formulario
    if (event.target.reset) event.target.reset();
    limpiarSeleccionRegular();
    
    updateSummary();
    updateTravelTable();
    
    alert('✅ Viaje agregado exitosamente!');
    showScreen('mainScreen');
}

// FUNCIONES DE GUARDIAS (MANTENIDAS IGUAL)
function addGuard(event) {
    event.preventDefault();
    
    const orderNumber = document.getElementById('guardOrderNumber')?.value || '';
    const driverName = document.getElementById('guardDriverName')?.value || '';
    const startTime = document.getElementById('guardStartTime')?.value || '';
    const endTime = document.getElementById('guardEndTime')?.value || '';
    
    if (!orderNumber || !driverName || !startTime || !endTime) {
        alert('Complete todos los campos obligatorios');
        return;
    }
    
    // Calcular horas
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let hours = (end - start) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    
    if (hours <= 0) {
        alert('La hora de finalización debe ser posterior a la de inicio');
        return;
    }
    
    const guard = {
        id: Date.now(),
        orderNumber,
        driverName,
        startTime,
        endTime,
        hours: hours.toFixed(2),
        type: document.getElementById('guardType')?.value || 'diurna',
        date: new Date().toLocaleDateString('es-ES'),
        viaticos: hours >= 9 ? 1 : 0,
        timestamp: new Date().toISOString()
    };
    
    let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    savedGuards.push(guard);
    localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
    
    // Limpiar formulario
    if (event.target.reset) event.target.reset();
    
    updateSummary();
    updateGuardList();
    
    alert('✅ Guardia agregada exitosamente!');
    showScreen('mainScreen');
}

// EL RESTO DE TUS FUNCIONES SE MANTIENE EXACTAMENTE IGUAL
// ACTUALIZAR INTERFACES
function updateSummary() {
    const savedTravels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    // Elementos del resumen
    const elements = {
        'totalTravels': savedTravels.length,
        'totalKm': savedTravels.reduce((sum, travel) => sum + travel.km, 0).toFixed(0),
        'totalViaticos': savedTravels.filter(travel => travel.viaticos).length,
        'totalGuards': savedGuards.length,
        'totalGuardHours': savedGuards.reduce((sum, guard) => sum + parseFloat(guard.hours), 0).toFixed(2),
        'todayTravels': savedTravels.filter(travel => travel.date === new Date().toLocaleDateString('es-ES')).length
    };
    
    // Actualizar solo los elementos que existen
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
}

function updateTravelTable() {
    const travelList = document.getElementById('travelList');
    if (!travelList) return;
    
    travelList.innerHTML = '';
    
    if (travels.length === 0) {
        travelList.innerHTML = '<tr><td colspan="8" class="no-data">No hay viajes registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedTravels = [...travels].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedTravels.forEach(travel => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${travel.date}</td>
            <td>${travel.orderNumber}</td>
            <td>${travel.origin}</td>
            <td>${travel.destination}</td>
            <td>${travel.km.toFixed(1)}</td>
            <td>${travel.departureTime} - ${travel.arrivalTime}</td>
            <td>${travel.viaticos ? '✅' : '❌'}</td>
            <td>
                <button class="btn-delete" onclick="deleteTravel(${travel.id})">🗑️</button>
            </td>
        `;
        
        travelList.appendChild(row);
    });
}

function updateGuardList() {
    const guardList = document.getElementById('guardList');
    if (!guardList) return;
    
    guardList.innerHTML = '';
    
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    if (savedGuards.length === 0) {
        guardList.innerHTML = '<tr><td colspan="7" class="no-data">No hay guardias registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedGuards = [...savedGuards].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedGuards.forEach((guard, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${guard.date}</td>
            <td>${guard.orderNumber}</td>
            <td>${guard.driverName}</td>
            <td>${guard.startTime} - ${guard.endTime}</td>
            <td>${guard.hours}</td>
            <td>${guard.type}</td>
            <td>
                <button class="btn-delete" onclick="deleteGuard(${guard.id})">🗑️</button>
            </td>
        `;
        
        guardList.appendChild(row);
    });
}

// FUNCIONES PARA LAS NUEVAS PANTALLAS
function updateAllTravelsList() {
    const allTravelsList = document.getElementById('allTravelsList');
    if (!allTravelsList) return;
    
    allTravelsList.innerHTML = '';
    
    if (travels.length === 0) {
        allTravelsList.innerHTML = '<tr><td colspan="7" class="no-data">No hay viajes registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedTravels = [...travels].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedTravels.forEach(travel => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${travel.date}</td>
            <td>${travel.orderNumber}</td>
            <td>${travel.origin}</td>
            <td>${travel.destination}</td>
            <td>${travel.km.toFixed(1)}</td>
            <td>${travel.departureTime} - ${travel.arrivalTime}</td>
            <td>${travel.viaticos ? '✅' : '❌'}</td>
        `;
        
        allTravelsList.appendChild(row);
    });
}

function updateAllGuardsList() {
    const allGuardsList = document.getElementById('allGuardsList');
    if (!allGuardsList) return;
    
    allGuardsList.innerHTML = '';
    
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    if (savedGuards.length === 0) {
        allGuardsList.innerHTML = '<tr><td colspan="6" class="no-data">No hay guardias registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedGuards = [...savedGuards].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedGuards.forEach(guard => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${guard.date}</td>
            <td>${guard.orderNumber}</td>
            <td>${guard.driverName}</td>
            <td>${guard.startTime} - ${guard.endTime}</td>
            <td>${guard.hours}</td>
            <td>${guard.type}</td>
        `;
        
        allGuardsList.appendChild(row);
    });
}

// 🆕 NUEVAS FUNCIONES DE LISTAS MEJORADAS
function renderViajesList() {
    const container = document.getElementById('allTravelsList');
    if (!container) return;
    
    const viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    
    if (viajes.length === 0) {
        container.innerHTML = '<div class="no-data">No hay viajes registrados</div>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedViajes = [...viajes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = sortedViajes.map(viaje => `
        <div class="item-viaje">
            <div class="item-header">
                <span class="orden-numero">Orden: ${viaje.orderNumber}</span>
                <span class="fecha-item">${viaje.date}</span>
            </div>
            
            <div class="ruta-viaje">🛣️ ${viaje.origin} → ${viaje.destination}</div>
            
            <div class="detalles-grid">
                <div class="detalle-item">
                    <span class="detalle-label">Kilómetros</span>
                    <span class="detalle-valor">${viaje.km} km</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horario</span>
                    <span class="detalle-valor">${viaje.departureTime} - ${viaje.arrivalTime}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horas Trabajadas</span>
                    <span class="detalle-valor">${viaje.hoursWorked}h</span>
                </div>
            </div>
            
            <div>
                ${viaje.viaticos ? `<span class="viatico-badge">💰 Viáticos: $${viaje.viaticos}</span>` : ''}
                ${viaje.tipoServicio ? `<span class="tarifa-badge">${viaje.tipoServicio}</span>` : ''}
                ${viaje.conAcoplado ? `<span class="viatico-badge" style="background: #fdebd0; color: #e67e22;">🚛 Acoplado</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderGuardiasList() {
    const container = document.getElementById('allGuardsList');
    if (!container) return;
    
    const guardias = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    if (guardias.length === 0) {
        container.innerHTML = '<div class="no-data">No hay guardias registradas</div>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    const sortedGuardias = [...guardias].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = sortedGuardias.map(guardia => `
        <div class="item-guardia">
            <div class="item-header">
                <span class="orden-numero">Orden: ${guardia.orderNumber}</span>
                <span class="fecha-item">${guardia.date}</span>
            </div>
            
            <div class="detalles-grid">
                <div class="detalle-item">
                    <span class="detalle-label">Conductor</span>
                    <span class="detalle-valor">${guardia.driverName}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horario Guardia</span>
                    <span class="detalle-valor">${guardia.startTime} - ${guardia.endTime}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horas Totales</span>
                    <span class="detalle-valor">${guardia.hours}h</span>
                </div>
            </div>
            
            <div>
                <span class="tipo-guardia tipo-${guardia.type}">${guardia.type.toUpperCase()}</span>
                <span class="tarifa-badge">$30/hora</span>
                ${guardia.viaticos ? `<span class="viatico-badge">💰 Viáticos: $${guardia.viaticos}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ELIMINAR DATOS
function deleteTravel(travelId) {
    if (confirm('¿Estás seguro de que quieres eliminar este viaje?')) {
        travels = travels.filter(travel => travel.id !== travelId);
        localStorage.setItem('bus_travels', JSON.stringify(travels));
        updateTravelTable();
        updateSummary();
    }
}

function deleteGuard(guardId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta guardia?')) {
        let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
        savedGuards = savedGuards.filter(guard => guard.id !== guardId);
        localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
        updateGuardList();
        updateSummary();
    }
}

// BACKUP FUNCTIONS
function exportData() {
    const data = {
        travels: JSON.parse(localStorage.getItem('bus_travels') || '[]'),
        guards: JSON.parse(localStorage.getItem('bus_guards') || '[]'),
        favorites: JSON.parse(localStorage.getItem('bus_favorites') || '[]'),
        exportDate: new Date().toISOString(),
        version: '2.0'
    };
    
    downloadJSON(data, `backup_completo_${getCurrentDateTime()}.json`);
}

function exportTravels() {
    const travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    const data = {
        travels: travels,
        exportDate: new Date().toISOString(),
        total: travels.length
    };
    
    downloadJSON(data, `backup_viajes_${getCurrentDateTime()}.json`);
}

function exportGuards() {
    const guards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    const data = {
        guards: guards,
        exportDate: new Date().toISOString(),
        total: guards.length
    };
    
    downloadJSON(data, `backup_guardias_${getCurrentDateTime()}.json`);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`✅ Archivo ${filename} descargado exitosamente`);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            event.target.dataset.importData = e.target.result;
            const importStatus = document.getElementById('importStatus');
            if (importStatus) {
                importStatus.textContent = `✅ Archivo cargado: ${file.name}`;
                importStatus.style.color = 'green';
            }
        } catch (error) {
            const importStatus = document.getElementById('importStatus');
            if (importStatus) {
                importStatus.textContent = '❌ Error: Archivo JSON inválido';
                importStatus.style.color = 'red';
            }
        }
    };
    reader.readAsText(file);
}

function importData() {
    const backupFile = document.getElementById('backupFile');
    const importData = backupFile?.dataset.importData;
    
    if (!importData) {
        alert('Por favor selecciona un archivo de backup primero');
        return;
    }
    
    try {
        const data = JSON.parse(importData);
        
        if (confirm('¿Estás seguro de que quieres importar estos datos? Se sobrescribirán los datos actuales.')) {
            if (data.travels) {
                localStorage.setItem('bus_travels', JSON.stringify(data.travels));
                travels = data.travels;
            }
            
            if (data.guards) {
                localStorage.setItem('bus_guards', JSON.stringify(data.guards));
            }
            
            if (data.favorites) {
                localStorage.setItem('bus_favorites', JSON.stringify(data.favorites));
                favoriteDestinations = data.favorites;
            }
            
            // Actualizar toda la interfaz
            updateSummary();
            updateTravelTable();
            updateGuardList();
            
            // Limpiar estado
            if (backupFile) {
                backupFile.value = '';
                backupFile.dataset.importData = '';
            }
            
            const importStatus = document.getElementById('importStatus');
            if (importStatus) {
                importStatus.textContent = '';
            }
            
            alert('✅ Datos importados exitosamente!');
        }
    } catch (error) {
        alert('❌ Error al importar datos: ' + error.message);
    }
}

function clearAllData() {
    if (confirm('⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? Esto eliminará TODOS los datos de viajes y guardias. Esta acción no se puede deshacer.')) {
        localStorage.removeItem('bus_travels');
        localStorage.removeItem('bus_guards');
        localStorage.removeItem('bus_favorites');
        
        travels = [];
        favoriteDestinations = [];
        
        updateSummary();
        updateTravelTable();
        updateGuardList();
        
        alert('🗑️ Todos los datos han sido eliminados');
    }
}

function generateSampleData() {
    if (confirm('¿Generar datos de ejemplo? Esto agregará viajes y guardias de prueba.')) {
        const sampleTravels = [
            {
                id: Date.now() + 1,
                orderNumber: 'ORD-001',
                origin: 'Montevideo',
                destination: 'Punta del Este',
                km: 120.0,
                departureTime: '08:00',
                arrivalTime: '10:30',
                hoursWorked: '2.50',
                date: new Date().toLocaleDateString('es-ES'),
                viaticos: 0,
                timestamp: new Date().toISOString(),
                modo: 'regular',
                tipoServicio: 'DIRECTO',
                conAcoplado: true,
                numeroServicio: '3'
            },
            {
                id: Date.now() + 2,
                orderNumber: 'ORD-002',
                origin: 'Montevideo',
                destination: 'Colonia',
                km: 180.0,
                departureTime: '14:00',
                arrivalTime: '17:30',
                hoursWorked: '3.50',
                date: new Date().toLocaleDateString('es-ES'),
                viaticos: 1,
                timestamp: new Date().toISOString(),
                modo: 'regular',
                tipoServicio: 'DIRECTO',
                conAcoplado: true,
                numeroServicio: '12'
            }
        ];
        
        const sampleGuards = [
            {
                id: Date.now() + 3,
                orderNumber: 'GUARD-001',
                driverName: 'Juan Pérez',
                startTime: '18:00',
                endTime: '06:00',
                hours: '12.00',
                type: 'nocturna',
                date: new Date().toLocaleDateString('es-ES'),
                timestamp: new Date().toISOString()
            }
        ];
        
        // Agregar datos de ejemplo
        sampleTravels.forEach(travel => travels.push(travel));
        localStorage.setItem('bus_travels', JSON.stringify(travels));
        
        let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
        sampleGuards.forEach(guard => savedGuards.push(guard));
        localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
        
        // Actualizar interfaz
        updateSummary();
        updateTravelTable();
        updateGuardList();
        
        alert('🎯 Datos de ejemplo generados exitosamente!');
    }
}

// UTILIDADES
function updateTodayDate() {
    const todayDate = document.getElementById('todayDate');
    if (todayDate) {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        todayDate.textContent = today.toLocaleDateString('es-ES', options);
    }
}

function getCurrentDateTime() {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace(/:/g, '-');
}
