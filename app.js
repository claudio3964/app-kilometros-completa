// VARIABLES GLOBALES
let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let favoriteDestinations = JSON.parse(localStorage.getItem('bus_favorites') || '[]');

// ===== SISTEMA INTELIGENTE DE VIAJES =====
const serviciosDB = {
    // DESDE MONTEVIDEO
    "MVD-PDE": {
        nombre: "Montevideo → Punta del Este",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false, reglas: "Primer coche - No genera acoplado" },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false, reglas: "Semi directo - No genera acoplado" },
            { numero: "3", tipo: "DIRECTO", acoplado: true, reglas: "Directo Pde - Genera acoplado" },
            { numero: "51", tipo: "PAN AZUCAR - SAN CARLOS", acoplado: true, reglas: "Por Pan de Azúcar y San Carlos" },
            { numero: "31", tipo: "RUTA 8/9 - PAN AZUCAR - SAN CARLOS", acoplado: true, reglas: "Por Ruta 8 y 9, Pan de Azúcar y San Carlos" }
        ]
    },
    "MVD-PIRIAPOLIS": {
        nombre: "Montevideo → Piriapolis",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false, reglas: "Primer coche - No genera acoplado" },
            { numero: "4", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Piriapolis - Genera acoplado" }
        ]
    },
    "MVD-COLONIA": {
        nombre: "Montevideo → Colonia",
        servicios: [
            { numero: "11", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" },
            { numero: "12", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Colonia - Genera acoplado" }
        ]
    },
    "MVD-CHUY": {
        nombre: "Montevideo → Chuy",
        servicios: [
            { numero: "41", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" },
            { numero: "42", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Chuy - Genera acoplado" }
        ]
    },
    "MVD-PEDRERA": {
        nombre: "Montevideo → La Pedrera",
        servicios: [
            { numero: "21", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" },
            { numero: "22", tipo: "DIRECTO", acoplado: true, reglas: "Directo a La Pedrera - Genera acoplado" }
        ]
    },
    "MVD-GARZON": {
        nombre: "Montevideo → Laguna Garzón",
        servicios: [
            { numero: "2", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" }
        ]
    },
    "MVD-PUNTA-NEGRA": {
        nombre: "Montevideo → Punta Negra",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false, reglas: "Directo a Punta Negra - No genera acoplado" }
        ]
    },

    // HACIA MONTEVIDEO
    "PDE-MVD": {
        nombre: "Punta del Este → Montevideo",
        servicios: [
            { numero: "Turno", tipo: "TURNO", acoplado: false, reglas: "Primer coche - No genera acoplado" },
            { numero: "2", tipo: "SEMI-DIRECTO", acoplado: false, reglas: "Semi directo - No genera acoplado" },
            { numero: "3", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Montevideo - Genera acoplado" },
            { numero: "31", tipo: "RUTA 8/9", acoplado: true, reglas: "Por Ruta 8 y 9 - Genera acoplado" },
            { numero: "51", tipo: "SAN CARLOS - PAN AZUCAR", acoplado: true, reglas: "Por San Carlos y Pan de Azúcar - Genera acoplado" }
        ]
    },
    "PIRIAPOLIS-MVD": {
        nombre: "Piriapolis → Montevideo",
        servicios: [
            { numero: "41", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" }
        ]
    },
    "COLONIA-MVD": {
        nombre: "Colonia → Montevideo",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" },
            { numero: "2", tipo: "DIRECTO", acoplado: true, reglas: "Directo a Montevideo - Genera acoplado" }
        ]
    },
    "CHUY-MVD": {
        nombre: "Chuy → Montevideo",
        servicios: [
            { numero: "61", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" }
        ]
    },
    "PEDRERA-MVD": {
        nombre: "La Pedrera → Montevideo",
        servicios: [
            { numero: "1", tipo: "TURNO", acoplado: false, reglas: "Directo a Montevideo - No genera acoplado" }
        ]
    },
    "GARZON-MVD": {
        nombre: "Laguna Garzón → Montevideo",
        servicios: [
            { numero: "81", tipo: "TURNO", acoplado: false, reglas: "Servicio regular - No genera acoplado" }
        ]
    },
    "PUNTA-NEGRA-MVD": {
        nombre: "Punta Negra → Montevideo",
        servicios: [
            { numero: "11", tipo: "TURNO", acoplado: false, reglas: "Directo a Montevideo - No genera acoplado" }
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

// 🆕 SISTEMA DE AUTO-DETECCIÓN DE RUTAS
function detectarYCrearRuta(origin, destination, numeroServicio, tipoServicio, conAcoplado) {
    const rutaKey = `${origin.toUpperCase().replace(/ /g, '_')}-${destination.toUpperCase().replace(/ /g, '_')}`;
    
    // Si la ruta ya existe, no hacer nada
    if (serviciosDB[rutaKey]) {
        return rutaKey;
    }
    
    // CREAR NUEVA RUTA AUTOMÁTICAMENTE
    serviciosDB[rutaKey] = {
        nombre: `${origin} → ${destination}`,
        servicios: [
            { 
                numero: numeroServicio, 
                tipo: tipoServicio, 
                acoplado: conAcoplado, 
                reglas: "Ruta creada automáticamente por el sistema" 
            }
        ]
    };
    
    console.log(`✅ Nueva ruta creada: ${rutaKey}`);
    return rutaKey;
}

// 🆕 FUNCIÓN PARA AGREGAR DESTINO MANUAL
function agregarDestinoManual() {
    const origin = prompt('Origen (ej: Montevideo):');
    const destination = prompt('Destino (ej: Punta Negra):');
    const numeroServicio = prompt('Número de servicio (ej: 11):');
    const tipoServicio = prompt('Tipo de servicio (ej: TURNO, DIRECTO):') || 'TURNO';
    const conAcoplado = confirm('¿Genera acoplado?');
    
    if (origin && destination && numeroServicio) {
        const rutaKey = detectarYCrearRuta(origin, destination, numeroServicio, tipoServicio, conAcoplado);
        alert(`✅ Destino agregado: ${origin} → ${destination}`);
        
        // Opcional: Cambiar a modo regular y seleccionar la nueva ruta
        setMode('regular');
        seleccionarRuta(rutaKey);
    } else {
        alert('❌ Faltan datos obligatorios');
    }
}

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
        
        // FILTRAR MEJORADO: Mostrar Piriapolis como destino independiente
        if (nombreBusqueda.includes(busqueda)) {
            // EVITAR mostrar rutas PDE que mencionen Piriapolis cuando se busca específicamente Piriapolis
            if (busqueda.includes('piriapolis') && nombreBusqueda.includes('punta del este')) {
                continue; // Saltar estas rutas
            }
            
            // EVITAR mostrar rutas Piriapolis cuando se busca específicamente Punta del Este
            if (busqueda.includes('punta del este') && nombreBusqueda.includes('piriapolis') && !nombreBusqueda.includes('punta del este')) {
                continue; // Saltar estas rutas
            }
            
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

// FUNCIONES DE NAVEGACIÓN - VERSIÓN CORREGIDA
function showScreen(screenId) {
    console.log('🎯 Mostrando pantalla:', screenId);
    
    // 1. Ocultar TODAS las pantallas
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
        screen.style.display = 'none';
        screen.classList.remove('active');
    });
    
    // 2. Mostrar pantalla objetivo
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
        targetScreen.classList.add('active');
        console.log('✅ Pantalla activada:', screenId);
        
        // 3. Actualizar datos específicos de cada pantalla
        if (screenId === 'mainScreen') {
            updateSummary();
        } else if (screenId === 'travelScreen') {
            updateTravelTable();
            limpiarSeleccionRegular();
        } else if (screenId === 'guardScreen') {
            updateGuardList();
            setTimeout(() => {
                actualizarDescripcionGuardia();
            }, 100);
        } else if (screenId === 'travelListScreen') {
            updateAllTravelsList();
            renderViajesList();
        } else if (screenId === 'guardListScreen') {
            updateAllGuardsList();
            renderGuardiasList();
        } else if (screenId === 'reportsScreen') {
            setTimeout(() => {
                limpiarFiltros(); // Mostrar todos los viajes al entrar
            }, 100);
        } else if (screenId === 'backupScreen') {
            // Limpiar estado de importación
            const importStatus = document.getElementById('importStatus');
            if (importStatus) importStatus.textContent = '';
        }
        else if (screenId === 'semanaScreen') {
            renderizarSemana();
        }
    } else {
        console.log('❌ Pantalla no encontrada:', screenId);
    }
}

// FUNCIONES DE VIAJES - VERSIÓN MEJORADA CON AUTO-DETECCIÓN
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
        // MODO CONTRATADO - usar datos manuales CON AUTO-DETECCIÓN
        origin = 'Montevideo'; // Por defecto desde MVD
        destination = document.getElementById('destinoContratado')?.value || '';
        tipoServicio = document.getElementById('tipoContratado')?.value || 'ESPECIAL';
        conAcoplado = document.getElementById('acopladoContratado')?.value === 'true';
        numeroServicio = document.getElementById('numeroContratado')?.value || '';
        
        if (!destination) {
            alert('Por favor ingresa el destino contratado');
            return;
        }
        
        // 🆕 AUTO-DETECCIÓN: Si no existe la ruta, crearla automáticamente
        const rutaKey = detectarYCrearRuta(origin, destination, numeroServicio, tipoServicio, conAcoplado);
        
        // Opcional: Seleccionar automáticamente la ruta creada
        seleccionarRuta(rutaKey);
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
    
    // 🆕 VIAJE CON DATOS DE USUARIO INCORPORADOS
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
        numeroServicio: numeroServicio,
        
        // ============================================
        // 🆕 CAMPOS DEL USUARIO (AGREGAR ESTOS)
        // ============================================
        conductor: usuario.nombre,
        numeroFuncionario: usuario.numero,
        rolUsuario: usuario.rol,
        fechaRegistroCompleta: new Date().toLocaleString()
        // ============================================
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

// EL RESTO DE TUS FUNCIONES SE MANTIENE EXACTAMENTE IGUAL
// 🆕 FUNCIÓN PARA MOSTRAR/OCULTAR CAMPO DE DESCRIPCIÓN
function actualizarDescripcionGuardia() {
    const tarifa = document.getElementById('guardTarifa').value;
    const campoDescripcion = document.getElementById('campoDescripcion');
    const inputDescripcion = document.getElementById('guardDescripcion');
    
    if (tarifa === '40') {
        campoDescripcion.style.display = 'block';
        inputDescripcion.required = true;
    } else {
        campoDescripcion.style.display = 'none';
        inputDescripcion.required = false;
        inputDescripcion.value = ''; // Limpiar campo
    }
}

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
// 🆕 FUNCIÓN PARA CALCULAR HORAS DE JORNADA POR ORDEN
function calcularHorasJornadaPorOrden(orderNumber, fecha) {
    // Filtrar todos los viajes/guardias del mismo orden y fecha
    const viajesOrden = travels.filter(v => v.orderNumber === orderNumber && v.date === fecha);
    const guardiasOrden = JSON.parse(localStorage.getItem('bus_guards') || '[]')
        .filter(g => g.orderNumber === orderNumber && g.date === fecha);
    
    // Combinar todos los servicios
    const todosServicios = [...viajesOrden, ...guardiasOrden];
    
    if (todosServicios.length === 0) return 0;
    
    // Encontrar hora más temprana y más tardía
    const todasHoras = [];
    
    todosServicios.forEach(servicio => {
        // Para viajes
        if (servicio.departureTime) todasHoras.push(servicio.departureTime);
        if (servicio.arrivalTime) todasHoras.push(servicio.arrivalTime);
        
        // Para guardias
        if (servicio.startTime) todasHoras.push(servicio.startTime);
        if (servicio.endTime) todasHoras.push(servicio.endTime);
    });
    
    if (todasHoras.length < 2) return 0;
    
    // Ordenar horas y calcular diferencia
    const horasOrdenadas = todasHoras.sort();
    const inicio = new Date(`2000-01-01T${horasOrdenadas[0]}`);
    const fin = new Date(`2000-01-01T${horasOrdenadas[horasOrdenadas.length - 1]}`);
    
    let horasTrabajadas = (fin - inicio) / (1000 * 60 * 60);
    if (horasTrabajadas < 0) horasTrabajadas += 24;
    
    return horasTrabajadas;
}

// 🆕 REEMPLAZAR LA FUNCIÓN renderViajesList EXISTENTE
function renderViajesList() {
    const container = document.getElementById('allTravelsList');
    if (!container) return;
    
    const viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    
    if (viajes.length === 0) {
        container.innerHTML = '<div class="no-data">No hay viajes registrados</div>';
        return;
    }
    
    const sortedViajes = [...viajes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 🆕 IDENTIFICAR ÚLTIMO VIAJE DE CADA ORDEN
    const ultimosViajesPorOrden = {};
    sortedViajes.forEach(viaje => {
        if (!ultimosViajesPorOrden[viaje.orderNumber] || 
            new Date(viaje.timestamp) > new Date(ultimosViajesPorOrden[viaje.orderNumber].timestamp)) {
            ultimosViajesPorOrden[viaje.orderNumber] = viaje;
        }
    });
    
    container.innerHTML = sortedViajes.map(viaje => {
        const horasJornada = calcularHorasJornadaPorOrden(viaje.orderNumber, viaje.date);
        const mostrarViatico = horasJornada >= 9;
        
        // 🆕 MOSTRAR VIÁTICO SOLO EN EL ÚLTIMO VIAJE DE LA ORDEN
        const esUltimoViaje = ultimosViajesPorOrden[viaje.orderNumber].id === viaje.id;
        
        return `
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
                    <span class="detalle-label">Horas Viaje</span>
                    <span class="detalle-valor">${viaje.hoursWorked}h</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horas Jornada</span>
                    <span class="detalle-valor ${mostrarViatico ? 'viatico-activo' : ''}">${horasJornada.toFixed(2)}h</span>
                </div>
            </div>
            
            <div>
                ${mostrarViatico && esUltimoViaje ? `<span class="viatico-badge">💰 Viáticos: $1</span>` : ''}
                ${viaje.tipoServicio ? `<span class="tarifa-badge">${viaje.tipoServicio}</span>` : ''}
                ${viaje.conAcoplado ? `<span class="acoplado-badge">🚛 Acoplado</span>` : ''}
            </div>
        </div>
        `;
    }).join('');
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
                    <span class="detalle-label">Horario Guardia</span>
                    <span class="detalle-valor">${guardia.startTime} - ${guardia.endTime}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Horas Totales</span>
                    <span class="detalle-valor">${guardia.hours}h</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Tarifa</span>
                    <span class="detalle-valor">$${guardia.tarifa}/hora</span>
                </div>
            </div>
            
            <div class="detalles-grid">
                <div class="detalle-item">
                    <span class="detalle-label">Monto Total</span>
                    <span class="detalle-valor">$${guardia.monto}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Tipo</span>
                    <span class="detalle-valor ${guardia.tipo === 'Especial' ? 'tipo-especial' : 'tipo-comun'}">${guardia.tipo}</span>
                </div>
            </div>
            
            ${guardia.descripcion ? `
            <div class="descripcion-guardia">
                <span class="detalle-label">Descripción:</span>
                <span class="detalle-valor">${guardia.descripcion}</span>
            </div>
            ` : ''}
            
            <div>
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

// 🎯 FUNCIONES DE REPORTES - VERSIÓN COMPLETA
function generarReporte() {
    const fechaDesde = document.getElementById('filterDateFrom').value;
    const fechaHasta = document.getElementById('filterDateTo').value;
    const numeroOrden = document.getElementById('filterOrderNumber').value.trim().toLowerCase();
    const conductor = document.getElementById('filterDriver').value.trim().toLowerCase();

    const todosViajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    
    // 🔍 APLICAR FILTROS
    let resultados = todosViajes.filter(viaje => {
        // Filtro por fecha
        if (fechaDesde && viaje.date < fechaDesde) return false;
        if (fechaHasta && viaje.date > fechaHasta) return false;
        
        // Filtro por número de orden
        if (numeroOrden && !viaje.orderNumber.toLowerCase().includes(numeroOrden)) return false;
        
        // Filtro por conductor
        if (conductor && viaje.conductor && !viaje.conductor.toLowerCase().includes(conductor)) return false;
        
        return true;
    });

    // 📊 ORDENAR POR FECHA MÁS RECIENTE PRIMERO
    resultados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    mostrarResultadosReporte(resultados);
}

function mostrarResultadosReporte(resultados) {
    const tbody = document.getElementById('reportResultsBody');
    const contador = document.getElementById('resultCount');
    const totalViajes = document.getElementById('totalViajesReport');
    const totalKm = document.getElementById('totalKmReport');
    const totalHoras = document.getElementById('totalHorasReport');
    const totalViaticos = document.getElementById('totalViaticosReport');
    
    // 📈 ACTUALIZAR RESUMEN
    const totalKM = resultados.reduce((sum, viaje) => sum + (parseFloat(viaje.km) || 0), 0);
    const totalHorasTrabajadas = resultados.reduce((sum, viaje) => sum + (parseFloat(viaje.hoursWorked) || 0), 0);
    const totalViaticosCount = resultados.reduce((sum, viaje) => sum + (viaje.viaticos || 0), 0);
    
    if (totalViajes) totalViajes.textContent = resultados.length;
    if (totalKm) totalKm.textContent = totalKM.toFixed(1);
    if (totalHoras) totalHoras.textContent = totalHorasTrabajadas.toFixed(1);
    if (totalViaticos) totalViaticos.textContent = `$${totalViaticosCount}`;
    
    // 📋 ACTUALIZAR CONTADOR
    contador.textContent = `${resultados.length} registro${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}`;
    
    // 🎯 MOSTRAR RESULTADOS EN TABLA
    if (resultados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No se encontraron resultados con los filtros aplicados</td></tr>';
        return;
    }
    
    tbody.innerHTML = resultados.map(viaje => `
        <tr>
            <td>${viaje.date}</td>
            <td><strong>${viaje.orderNumber}</strong></td>
            <td>${viaje.conductor || 'N/A'}</td>
            <td>${viaje.origin} → ${viaje.destination}</td>
            <td>${parseFloat(viaje.km).toFixed(1)} km</td>
            <td>${parseFloat(viaje.hoursWorked).toFixed(1)}h</td>
            <td>
                ${viaje.viaticos ? 
                    '<span class="badge-viatico">✅ $1</span>' : 
                    '<span style="color: #6c757d;">❌</span>'
                }
            </td>
            <td>
                <span class="badge-tipo">${viaje.tipoServicio || 'Regular'}</span>
                ${viaje.conAcoplado ? '<span style="margin-left: 5px; font-size: 0.8em;">🚛</span>' : ''}
            </td>
        </tr>
    `).join('');
}

function limpiarFiltros() {
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterOrderNumber').value = '';
    document.getElementById('filterDriver').value = '';
    
    // 🆕 GENERAR REPORTE VACÍO AL LIMPIAR
    generarReporte();
}

function exportarReporte() {
    // 📄 VERSIÓN SIMPLE DE EXPORTACIÓN (por ahora)
    const resultados = document.getElementById('reportResultsBody').innerHTML;
    const totalViajes = document.getElementById('totalViajesReport').textContent;
    const totalKm = document.getElementById('totalKmReport').textContent;
    
    if (resultados.includes('no-data')) {
        alert('❌ No hay datos para exportar');
        return;
    }
    
    // 🆕 EXPORTACIÓN BÁSICA - LUEGO MEJORAMOS A PDF
    const blob = new Blob([`
        REPORTE DE VIAJES
        =================
        Total Viajes: ${totalViajes}
        Total KM: ${totalKm}
        Fecha: ${new Date().toLocaleDateString()}
        
        ${Array.from(document.querySelectorAll('.report-table tr')).map(row => row.textContent).join('\n')}
    `], { type: 'text/plain' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_viajes_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('✅ Reporte exportado como archivo de texto');
}



// ============================================
// 🏗️ ESTRUCTURA MODULAR - FASE 1
// ============================================

// 💾 1. DATA MANAGER (Solo lectura por ahora)
class DataManager {
    static obtenerUsuario() {
        return JSON.parse(localStorage.getItem('travelUser') || '{}');
    }
    
    static obtenerViajes() {
        return JSON.parse(localStorage.getItem('bus_travels') || '[]');
    }
    
    static obtenerGuardias() {
        return JSON.parse(localStorage.getItem('bus_guards') || '[]');
    }
}

// 🎨 2. UI MANAGER (Complementa tu código existente)
class UIManager {
    static mostrarPantalla(pantallaId) {
        // Usa tu función existente showScreen()
        showScreen(pantallaId);
    }
    
    static actualizarResumen() {
        // Usa tu función existente updateSummary()
        updateSummary();
    }
    
    static mostrarError(mensaje) {
        alert(`❌ ${mensaje}`);
    }
    
    static mostrarExito(mensaje) {
        alert(`✅ ${mensaje}`);
    }
}
// ============================================
// 📊 REPORTES MANAGER - ESTRUCTURA MODULAR
// ============================================

class ReportesManager {
    constructor() {
        this.usuario = DataManager.obtenerUsuario();
        this.viajes = DataManager.obtenerViajes().filter(viaje => 
            viaje.conductor === this.usuario.nombre
        );
        console.log('📊 ReportesManager iniciado para:', this.usuario.nombre);
    }

    // 🔍 FILTRAR VIAJES POR FECHA - VERSIÓN DEFINITIVA
filtrarViajesPorFecha(fechaInicio, fechaFin) {
    console.log('🔍 DEBUG - Total viajes disponibles:', this.viajes.length);
    console.log('🔍 DEBUG - Fechas de viajes:', this.viajes.map(v => v.date));
    
    return this.viajes.filter(viaje => {
        // Convertir fecha del viaje "22/11/2025" a formato comparable
        const [dia, mes, año] = viaje.date.split('/');
        const fechaViaje = new Date(año, mes - 1, dia);
        
        // Si estamos buscando por fecha específica (como en Mi Día)
        if (fechaInicio && fechaFin && fechaInicio === fechaFin) {
            const fechaFiltro = new Date(fechaInicio);
            const coincide = fechaViaje.toISOString().split('T')[0] === fechaFiltro.toISOString().split('T')[0];
            
            console.log('📅 DEBUG - Comparación exacta:', {
                viaje: viaje.date,
                fechaViaje: fechaViaje.toISOString().split('T')[0],
                filtro: fechaFiltro.toISOString().split('T')[0],
                coincide: coincide
            });
            
            return coincide;
        }
        
        // Para búsquedas por rango (fechas diferentes)
        const inicio = fechaInicio ? new Date(fechaInicio) : new Date('2000-01-01');
        const fin = fechaFin ? new Date(fechaFin) : new Date('2100-01-01');
        
        return fechaViaje >= inicio && fechaViaje <= fin;
    });
}
    // 🆕 FUNCIÓN CORREGIDA PARA DETERMINAR VIÁTICOS
    determinarViaticos(viaje, todosViajes) {
        const viajesMismaOrden = todosViajes.filter(v => 
            v.orderNumber === viaje.orderNumber && v.date === viaje.date
        );
        
        viajesMismaOrden.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (viajesMismaOrden.length > 0) {
            const ultimoViaje = viajesMismaOrden[viajesMismaOrden.length - 1];
            if (ultimoViaje.id === viaje.id) {
                return '✅ SÍ';
            }
        }
        
        return '❌ NO';
    }

    // 📅 GENERAR REPORTE DIARIO - VERSIÓN MEJORADA
    generarReporteDiario() {
        const filtroOrden = document.getElementById('filterOrderNumber')?.value.trim().toLowerCase() || '';
        
        let fecha;
        const fechaFiltroDesde = document.getElementById('filterDateFrom')?.value;
        const fechaFiltroHasta = document.getElementById('filterDateTo')?.value;
        
        if (fechaFiltroDesde) {
    fecha = fechaFiltroDesde;
} else if (fechaFiltroHasta) {
    fecha = fechaFiltroHasta;
} else {
    // 🆕 FORZAR LA FECHA DE TUS VIAJES EN FORMATO CORRECTO
    fecha = '2025-11-22';
    console.log('🕐 Usando fecha forzada:', fecha);
}
        
        console.log('🔍 Buscando viajes para fecha:', fecha);
        
        let viajesFiltrados = this.filtrarViajesPorFecha(fecha, fecha);
        
        if (filtroOrden) {
            viajesFiltrados = viajesFiltrados.filter(viaje => 
                viaje.orderNumber.toLowerCase().includes(filtroOrden)
            );
        }
        
        console.log('📊 Viajes encontrados:', viajesFiltrados.length);
        
        const todosViajes = DataManager.obtenerViajes();
        
        return viajesFiltrados.map(viaje => ({
            fecha: viaje.date,
            orden: viaje.orderNumber,
            ruta: `${viaje.origin} → ${viaje.destination}`,
            km: parseFloat(viaje.km).toFixed(1),
            horaSalida: viaje.departureTime,
            horaLlegada: viaje.arrivalTime,
            horasViaje: viaje.hoursWorked,
            guardia: this.obtenerGuardiaOrden(viaje.orderNumber, viaje.date),
            viaticos: this.determinarViaticos(viaje, todosViajes),
            acoplado: (viaje.conAcoplado === true || viaje.conAcoplado === 'true') ? '✅ SÍ' : '❌ NO',
            tipoServicio: viaje.tipoServicio || 'Regular'
        }));
    }

    // 🛡️ OBTENER INFORMACIÓN DE GUARDIA
    obtenerGuardiaOrden(orderNumber, fecha) {
        const guardias = DataManager.obtenerGuardias();
        const guardia = guardias.find(g => g.orderNumber === orderNumber && g.date === fecha);
        
        if (guardia) {
            return `SÍ (${guardia.startTime}-${guardia.endTime})`;
        }
        
        const guardiaConductor = guardias.find(g => 
            g.driverName === this.usuario.nombre && g.date === fecha
        );
        
        if (guardiaConductor) {
            return `SÍ (${guardiaConductor.startTime}-${guardiaConductor.endTime})`;
        }
        
        return 'NO';
    }

    // 🖨️ MOSTRAR REPORTE
    mostrarReporte(tipo) {
        let contenido = '';
        let titulo = '';
        
        switch(tipo) {
            case 'diario':
                const reporteDiario = this.generarReporteDiario();
                contenido = this.generarHTMLReporteDiario(reporteDiario);
                titulo = '📅 Mis Viajes';
                break;
        }
        
        this.mostrarEnPantallaReportes(contenido, titulo);
    }

    // 🎨 GENERAR HTML REPORTE DIARIO
    generarHTMLReporteDiario(viajes) {
        if (viajes.length === 0) {
            return '<div class="no-data">No hay viajes registrados</div>';
        }

        return `
            <div class="user-report-container">
                <div class="user-report-header">
                    <h3>📅 MIS VIAJES - ${viajes[0].fecha}</h3>
                    <div class="user-info">👤 ${this.usuario.nombre}</div>
                </div>
                <div class="user-daily-trips">
                    ${viajes.map(viaje => `
                        <div class="user-trip-card">
                            <div class="user-trip-header">
                                <div class="user-trip-order">Orden: <strong>${viaje.orden}</strong></div>
                                <div class="user-trip-route">${viaje.ruta}</div>
                            </div>
                            <div class="user-trip-details">
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Kilómetros:</span>
                                    <span class="user-detail-value">${viaje.km} km</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Horario:</span>
                                    <span class="user-detail-value">${viaje.horaSalida} - ${viaje.horaLlegada}</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Duración:</span>
                                    <span class="user-detail-value">${viaje.horasViaje} horas</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Guardia:</span>
                                    <span class="user-detail-value">${viaje.guardia}</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Viáticos:</span>
                                    <span class="user-detail-value ${viaje.viaticos.includes('✅') ? 'user-viatico-yes' : 'user-viatico-no'}">${viaje.viaticos}</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Acoplado:</span>
                                    <span class="user-detail-value ${viaje.acoplado.includes('✅') ? 'user-acoplado-yes' : 'user-acoplado-no'}">${viaje.acoplado}</span>
                                </div>
                                <div class="user-detail-line">
                                    <span class="user-detail-label">Tipo Servicio:</span>
                                    <span class="user-detail-value user-service-type">${viaje.tipoServicio}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 🖥️ MOSTRAR EN PANTALLA DE REPORTES
    mostrarEnPantallaReportes(contenido, titulo) {
        const reportHeader = document.querySelector('#reportsScreen .screen-header h2');
        if (reportHeader && titulo) {
            reportHeader.textContent = titulo;
        }
        
        const reportResults = document.querySelector('.report-results');
        if (reportResults) {
            reportResults.style.display = 'block';
            reportResults.innerHTML = `
                <div class="report-header">
                    <h3>${titulo}</h3>
                </div>
                <div class="user-report-content">
                    ${contenido}
                </div>
            `;
        }
        
        const tablaNormal = document.querySelector('.table-container');
        if (tablaNormal) {
            tablaNormal.style.display = 'none';
        }
        
        const resumenRapido = document.querySelector('.report-summary');
        if (resumenRapido) {
            resumenRapido.style.display = 'none';
        }
    }

   // 🔄 RESTAURAR VISTA NORMAL - VERSIÓN SEGURA
restaurarVistaNormal() {
    console.log('🔄 Restaurando vista normal de reportes...');
    
    try {
        // 1. Restaurar título principal
        const reportHeader = document.querySelector('#reportsScreen .screen-header h2');
        if (reportHeader) {
            reportHeader.textContent = '📊 Reportes y Búsquedas';
        }
        
        // 2. Mostrar tabla normal
        const tablaNormal = document.querySelector('.table-container');
        if (tablaNormal) {
            tablaNormal.style.display = 'block';
        }
        
        // 3. Mostrar resumen rápido
        const resumenRapido = document.querySelector('.report-summary');
        if (resumenRapido) {
            resumenRapido.style.display = 'flex';
        }
        
        // 4. Limpiar y ocultar resultados de reportes personalizados
        const reportResults = document.querySelector('.report-results');
        if (reportResults) {
            reportResults.innerHTML = '';
            reportResults.style.display = 'none';
        }
        
        // 5. Limpiar filtros
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterOrderNumber').value = '';
        document.getElementById('filterDriver').value = '';
        
        // 6. Limpiar tabla de resultados (EN LUGAR de generarReporte)
        const tbody = document.getElementById('reportResultsBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8">Usa los filtros para generar un reporte</td></tr>';
        }
        
        // 7. Limpiar resumen
        const elementosResumen = ['totalViajesReport', 'totalKmReport', 'totalHorasReport', 'totalViaticosReport'];
        elementosResumen.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = id.includes('Viaticos') ? '$0' : '0';
        });
        
        console.log('✅ Vista normal restaurada correctamente (sin errores)');
        
    } catch (error) {
        console.error('❌ Error al restaurar vista:', error);
        // No mostrar alerta para evitar molestias al usuario
    }
}

// 🎯 INICIALIZACIÓN SEGURA
window.reportesManager = new ReportesManager();

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(inicializarReportesUsuario, 1000);
});
// 🆕 FUNCIONES PARA "MI SEMANA"

function obtenerInicioSemana(fecha) {
    const dia = new Date(fecha);
    const diaSemana = dia.getDay();
    const diferencia = diaSemana === 0 ? 6 : diaSemana - 1; // Lunes como inicio
    dia.setDate(dia.getDate() - diferencia);
    dia.setHours(0, 0, 0, 0);
    return dia;
}

function cargarViajesSemanaActual() {
    const viajes = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    const usuario = JSON.parse(localStorage.getItem('travelUser') || '{}');
    
    // Filtrar solo viajes del usuario actual
    const viajesUsuario = viajes.filter(viaje => viaje.conductor === usuario.nombre);
    
    const hoy = new Date();
    const inicioSemana = obtenerInicioSemana(hoy);
    
    const viajesSemana = viajesUsuario.filter(viaje => {
        const [dia, mes, año] = viaje.date.split('/');
        const fechaViaje = new Date(año, mes - 1, dia);
        return fechaViaje >= inicioSemana && fechaViaje <= hoy;
    });
    
    return viajesSemana;
}

function calcularEstadisticasSemana(viajes) {
    if (viajes.length === 0) {
        return {
            totalViajes: 0,
            totalKm: 0,
            totalHoras: 0,
            totalViaticos: 0,
            promedioPorViaje: 0
        };
    }
    
    const totalKm = viajes.reduce((sum, viaje) => sum + (parseFloat(viaje.km) || 0), 0);
    const totalHoras = viajes.reduce((sum, viaje) => sum + (parseFloat(viaje.hoursWorked) || 0), 0);
    const totalViaticos = viajes.reduce((sum, viaje) => sum + (viaje.viaticos || 0), 0);
    
    return {
        totalViajes: viajes.length,
        totalKm: totalKm,
        totalHoras: totalHoras,
        totalViaticos: totalViaticos,
        promedioPorViaje: totalKm / viajes.length
    };
}

function renderizarSemana() {
    const viajesSemana = cargarViajesSemanaActual();
    const stats = calcularEstadisticasSemana(viajesSemana);
    
    // Actualizar estadísticas
    const statsContainer = document.getElementById('semanaStats');
    if (statsContainer) {
        if (viajesSemana.length === 0) {
            statsContainer.innerHTML = `
                <div class="no-data" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h3>📅 No hay viajes esta semana</h3>
                    <p>Comienza agregando algunos viajes para ver tu resumen semanal</p>
                </div>
            ;
        } else {
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <h3>📅 Viajes Esta Semana</h3>
                    <p class="stat-number">${stats.totalViajes}</p>
                </div>
                
                <div class="stat-card">
                    <h3>🛣️ Total Kilómetros</h3>
                    <p class="stat-number">${stats.totalKm.toFixed(1)} km</p>
                </div>
                
                <div class="stat-card">
                    <h3>⏱️ Total Horas</h3>
                    <p class="stat-number">${stats.totalHoras.toFixed(1)} h</p>
                </div>
                
                <div class="stat-card">
                    <h3>💰 Total Viáticos</h3>
                    <p class="stat-number">$${stats.totalViaticos}</p>
                </div>
                
                <div class="stat-card">
                    <h3>📊 Promedio por Viaje</h3>
                    <p class="stat-number">${stats.promedioPorViaje.toFixed(1)} km</p>
                </div>
            `;
        }
    }
    
    // Actualizar lista de viajes
    const viajesContainer = document.getElementById('semanaViajesList');
    if (viajesContainer) {
        if (viajesSemana.length === 0) {
            viajesContainer.innerHTML = '<div class="no-data">No hay viajes esta semana</div>';
            return;
        }
        
        // Ordenar por fecha (más reciente primero)
        const viajesOrdenados = [...viajesSemana].sort((a, b) => {
            const [diaA, mesA, añoA] = a.date.split('/');
            const [diaB, mesB, añoB] = b.date.split('/');
            return new Date(añoB, mesB - 1, diaB) - new Date(añoA, mesA - 1, diaA);
        });
        
        viajesContainer.innerHTML = viajesOrdenados.map(viaje => `
            <div class="viaje-item semana-item">
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
                        <span class="detalle-label">Horas</span>
                        <span class="detalle-valor">${viaje.hoursWorked}h</span>
                    </div>
                </div>
                
                <div class="badges-container">
                    ${viaje.viaticos ? '<span class="viatico-badge">💰 Viáticos: $1</span>' : ''}
                    ${viaje.tipoServicio ? `<span class="tarifa-badge">${viaje.tipoServicio}</span>` : ''}
                    ${viaje.conAcoplado ? '<span class="acoplado-badge">🚛 Acoplado</span>' : ''}
                </div>
            </div>
        `).join('');
    }
}
