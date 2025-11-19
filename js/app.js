// VARIABLES GLOBALES
let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let favoriteDestinations = JSON.parse(localStorage.getItem('bus_favorites') || '[]');

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', function() {
    updateSummary();
    updateTravelTable();
    updateGuardList();
    updateRecentTravels();
    updateTodayDate();
    
    // Configurar evento para importar datos
    document.getElementById('backupFile').addEventListener('change', handleFileSelect);
});

// FUNCIONES DE NAVEGACIÓN
function showScreen(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Remover active de todas las pestañas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar pantalla seleccionada
    document.getElementById(screenId).classList.add('active');
    
    // Activar pestaña correspondiente
    event.target.classList.add('active');
    
    // Actualizar datos específicos de cada pantalla
    if (screenId === 'mainScreen') {
        updateRecentTravels();
    } else if (screenId === 'travelScreen') {
        updateTravelTable();
    } else if (screenId === 'guardScreen') {
        updateGuardList();
    }
}

// NUEVA FUNCIÓN PARA CALCULAR HORAS POR ORDEN (UNIFICADO)
function calcularHorasTotalesOrden(orderNumber, fecha) {
    // Obtener todos los viajes del orden en la fecha
    const viajesOrden = travels.filter(t => 
        t.orderNumber == orderNumber && t.date === fecha
    );
    
    // Obtener todas las guardias del orden en la fecha
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    const guardiasOrden = savedGuards.filter(g => 
        g.orderNumber == orderNumber && g.date === fecha
    );
    
    // Si no hay actividades, retornar 0
    if (viajesOrden.length === 0 && guardiasOrden.length === 0) {
        return 0;
    }
    
    // Encontrar el horario más temprano
    let horarioInicio = '23:59';
    
    // Revisar viajes
    viajesOrden.forEach(viaje => {
        if (viaje.departureTime < horarioInicio) {
            horarioInicio = viaje.departureTime;
        }
    });
    
    // Revisar guardias
    guardiasOrden.forEach(guardia => {
        if (guardia.startTime < horarioInicio) {
            horarioInicio = guardia.startTime;
        }
    });
    
    // Encontrar el horario más tardío
    let horarioFin = '00:00';
    
    // Revisar viajes
    viajesOrden.forEach(viaje => {
        if (viaje.arrivalTime > horarioFin) {
            horarioFin = viaje.arrivalTime;
        }
    });
    
    // Revisar guardias
    guardiasOrden.forEach(guardia => {
        if (guardia.endTime > horarioFin) {
            horarioFin = guardia.endTime;
        }
    });
    
    // Calcular horas totales
    const start = new Date(`2000-01-01T${horarioInicio}`);
    const end = new Date(`2000-01-01T${horarioFin}`);
    let horasTotales = (end - start) / (1000 * 60 * 60);
    
    // Ajustar si cruza medianoche
    if (horasTotales < 0) horasTotales += 24;
    
    console.log(`🕒 Orden ${orderNumber} (${fecha}): ${horarioInicio} - ${horarioFin} = ${horasTotales.toFixed(2)} horas`);
    
    return horasTotales;
}

// FUNCIONES DE VIAJES
function addTravel(event) {
    event.preventDefault();
    
    const orderNumber = document.getElementById('orderNumber').value;
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const km = parseFloat(document.getElementById('km').value);
    const travelType = document.getElementById('travelType').value;
    const departureTime = document.getElementById('departureTime').value;
    const arrivalTime = document.getElementById('arrivalTime').value;
    const fechaInput = document.getElementById('fechaViaje').value;
    
    if (!orderNumber || !origin || !destination || !km || !departureTime || !arrivalTime) {
        alert('Complete todos los campos obligatorios');
        return;
    }
    
    // CALCULAR HORAS TRABAJADAS PRIMERO
    const start = new Date(`2000-01-01T${departureTime}`);
    const end = new Date(`2000-01-01T${arrivalTime}`);
    let hoursWorked = (end - start) / (1000 * 60 * 60);
    if (hoursWorked < 0) hoursWorked += 24;
    
    if (hoursWorked <= 0) {
        alert('La hora de llegada debe ser posterior a la de salida');
        return;
    }
    
    let fechaViaje;
    if (fechaInput) {
        const [año, mes, dia] = fechaInput.split('-');
        fechaViaje = `${dia}/${mes}/${año}`;
    } else {
        fechaViaje = new Date().toLocaleDateString('es-ES');
    }
    
    // CALCULAR HORAS TOTALES (GUARDIAS + VIAJES) - NUEVA LÓGICA
    const horasTotalesOrden = calcularHorasTotalesOrden(orderNumber, fechaViaje);
    const viaticos = horasTotalesOrden >= 9 ? 1 : 0;
    
    console.log(`💰 Viático para orden ${orderNumber}: ${viaticos ? 'SÍ' : 'NO'} (${horasTotalesOrden.toFixed(2)} horas totales)`);
    
    // CALCULAR ACOPLADOS
    const turnoSeleccionado = document.getElementById('turnoSeleccionado');
    const descripcionTurno = turnoSeleccionado.options[turnoSeleccionado.selectedIndex].text;
    const esDirecto = descripcionTurno.includes('Directo');
    const acoplados = esDirecto ? 1 : 0;
    const kmTotal = esDirecto ? km + 30 : km;
    
    const travel = {
        id: Date.now(),
        orderNumber, 
        origin, 
        destination, 
        km: kmTotal,
        kmRuta: km,
        acoplados: acoplados,
        type: travelType,
        departureTime, 
        arrivalTime, 
        hoursWorked: hoursWorked.toFixed(2),
        date: fechaViaje,
        viaticos: viaticos,
        timestamp: new Date().toISOString()
    };
    
    travels.push(travel);
    localStorage.setItem('bus_travels', JSON.stringify(travels));
    
    // ACTUALIZAR VIÁTICOS DE TODAS LAS ACTIVIDADES DEL MISMO ORDEN
    actualizarViaticosPorOrden(orderNumber, fechaViaje, horasTotalesOrden);
    
    // GUARDAR COMO FAVORITO SI ES MANUAL
    const turnoId = document.getElementById('turnoSeleccionado').value;
    if (turnoId === 'manual') {
        guardarDestinoFavorito(origin, destination, km);
    }
    
    // Limpiar formulario
    document.getElementById('travelForm').reset();
    
    updateSummary();
    updateTravelTable();
    updateRecentTravels();
    
    alert('✅ Viaje agregado! ' + (viaticos ? '(Con viático)' : '') + 
          (turnoId === 'manual' ? ' ⭐ (Guardado como favorito)' : ''));
    showScreen('mainScreen');
}

// FUNCIONES DE GUARDIAS
function addGuard(event) {
    event.preventDefault();
    
    const orderNumber = document.getElementById('guardOrderNumber').value;
    const driverName = document.getElementById('guardDriverName').value;
    const startTime = document.getElementById('guardStartTime').value;
    const endTime = document.getElementById('guardEndTime').value;
    const guardType = document.getElementById('guardType').value;
    const fechaInput = document.getElementById('guardFecha').value;
    
    if (!orderNumber || !driverName || !startTime || !endTime) {
        alert('Complete todos los campos obligatorios');
        return;
    }
    
    // CALCULAR HORAS
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let hours = (end - start) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    
    if (hours <= 0) {
        alert('La hora de finalización debe ser posterior a la de inicio');
        return;
    }
    
    let fechaGuardia;
    if (fechaInput) {
        const [año, mes, dia] = fechaInput.split('-');
        fechaGuardia = `${dia}/${mes}/${año}`;
    } else {
        fechaGuardia = new Date().toLocaleDateString('es-ES');
    }
    
    // CALCULAR HORAS TOTALES (GUARDIAS + VIAJES) - NUEVA LÓGICA
    const horasTotalesOrden = calcularHorasTotalesOrden(orderNumber, fechaGuardia);
    const viaticos = horasTotalesOrden >= 9 ? 1 : 0;
    
    console.log(`💰 Viático para orden ${orderNumber}: ${viaticos ? 'SÍ' : 'NO'} (${horasTotalesOrden.toFixed(2)} horas totales)`);
    
    const guard = {
        id: Date.now(),
        orderNumber,
        driverName,
        startTime,
        endTime,
        hours: hours.toFixed(2),
        type: guardType,
        date: fechaGuardia,
        viaticos: viaticos,
        timestamp: new Date().toISOString()
    };
    
    let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    savedGuards.push(guard);
    localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
    
    // ACTUALIZAR VIÁTICOS DE TODAS LAS ACTIVIDADES DEL MISMO ORDEN
    actualizarViaticosPorOrden(orderNumber, fechaGuardia, horasTotalesOrden);
    
    // Limpiar formulario
    document.getElementById('guardForm').reset();
    
    updateGuardList();
    updateSummary();
    
    alert('✅ Guardia agregada exitosamente! ' + (viaticos ? '(Con viático)' : ''));
    showScreen('mainScreen');
}

// FUNCIÓN ACTUALIZADA PARA ACTUALIZAR VIÁTICOS
function actualizarViaticosPorOrden(orderNumber, fecha, horasTotales) {
    const viaticos = horasTotales >= 9 ? 1 : 0;
    
    // Actualizar todos los viajes del mismo orden y fecha
    travels.forEach(travel => {
        if (travel.orderNumber === orderNumber && travel.date === fecha) {
            travel.viaticos = viaticos;
        }
    });
    
    // Actualizar todas las guardias del mismo orden y fecha
    let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    savedGuards.forEach(guard => {
        if (guard.orderNumber === orderNumber && guard.date === fecha) {
            guard.viaticos = viaticos;
        }
    });
    
    // Guardar en localStorage
    localStorage.setItem('bus_travels', JSON.stringify(travels));
    localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
    
    console.log(`🔄 Actualizados viáticos para orden ${orderNumber} (${fecha}): ${viaticos ? 'SÍ' : 'NO'}`);
}

function guardarDestinoFavorito(origin, destination, km) {
    const nuevoFavorito = {
        id: Date.now(),
        origin,
        destination,
        km,
        timestamp: new Date().toISOString()
    };
    
    // Evitar duplicados
    const existe = favoriteDestinations.some(fav => 
        fav.origin === origin && fav.destination === destination
    );
    
    if (!existe) {
        favoriteDestinations.push(nuevoFavorito);
        localStorage.setItem('bus_favorites', JSON.stringify(favoriteDestinations));
    }
}

function updateTravelTable() {
    const travelList = document.getElementById('travelList');
    travelList.innerHTML = '';
    
    if (travels.length === 0) {
        travelList.innerHTML = '<tr><td colspan="8" class="no-data">No hay viajes registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    travels.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    travels.forEach(travel => {
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

function deleteTravel(travelId) {
    if (confirm('¿Estás seguro de que quieres eliminar este viaje?')) {
        travels = travels.filter(travel => travel.id !== travelId);
        localStorage.setItem('bus_travels', JSON.stringify(travels));
        updateTravelTable();
        updateSummary();
        updateRecentTravels();
    }
}

function updateGuardList() {
    const guardList = document.getElementById('guardList');
    guardList.innerHTML = '';
    
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    if (savedGuards.length === 0) {
        guardList.innerHTML = '<tr><td colspan="7" class="no-data">No hay guardias registrados</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente primero
    savedGuards.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    savedGuards.forEach((guard, index) => {
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

function deleteGuard(guardId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta guardia?')) {
        let savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
        savedGuards = savedGuards.filter(guard => guard.id !== guardId);
        localStorage.setItem('bus_guards', JSON.stringify(savedGuards));
        updateGuardList();
        updateSummary();
    }
}

// FUNCIONES DE RESUMEN Y UTILIDADES
function updateSummary() {
    const savedTravels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    const savedGuards = JSON.parse(localStorage.getItem('bus_guards') || '[]');
    
    // Cálculos para viajes
    const totalTravels = savedTravels.length;
    const totalKm = savedTravels.reduce((sum, travel) => sum + travel.km, 0);
    const totalViaticos = savedTravels.filter(travel => travel.viaticos).length;
    
    // Cálculos para guardias
    const totalGuards = savedGuards.length;
    const totalGuardHours = savedGuards.reduce((sum, guard) => sum + parseFloat(guard.hours), 0);
    
    // Cálculos para hoy
    const today = new Date().toLocaleDateString('es-ES');
    const todayTravels = savedTravels.filter(travel => travel.date === today).length;
    
    // Actualizar resumen
    document.getElementById('totalTravels').textContent = totalTravels;
    document.getElementById('totalKm').textContent = totalKm.toFixed(0);
    document.getElementById('totalViaticos').textContent = totalViaticos;
    document.getElementById('totalGuards').textContent = totalGuards;
    document.getElementById('totalGuardHours').textContent = totalGuardHours.toFixed(2);
    document.getElementById('todayTravels').textContent = todayTravels;
}

function updateRecentTravels() {
    const recentTravels = document.getElementById('recentTravels');
    recentTravels.innerHTML = '';
    
    const savedTravels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
    
    if (savedTravels.length === 0) {
        recentTravels.innerHTML = '<tr><td colspan="6" class="no-data">No hay viajes recientes</td></tr>';
        return;
    }
    
    // Ordenar por fecha más reciente y tomar los últimos 5
    const recent = savedTravels
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);
    
    recent.forEach(travel => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${travel.date}</td>
            <td>${travel.orderNumber}</td>
            <td>${travel.origin} → ${travel.destination}</td>
            <td>${travel.km.toFixed(1)}</td>
            <td>${travel.departureTime} - ${travel.arrivalTime}</td>
            <td>${travel.viaticos ? '✅' : '❌'}</td>
        `;
        
        recentTravels.appendChild(row);
    });
}

function updateTodayDate() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('todayDate').textContent = today.toLocaleDateString('es-ES', options);
}

// FUNCIONES DE BACKUP
function exportData() {
    const data = {
        travels: JSON.parse(localStorage.getItem('bus_travels') || '[]'),
        guards: JSON.parse(localStorage.getItem('bus_guards') || '[]'),
        favorites: JSON.parse(localStorage.getItem('bus_favorites') || '[]'),
        exportDate: new Date().toISOString(),
        version: '1.0'
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
            document.getElementById('backupFile').dataset.importData = e.target.result;
            document.getElementById('importStatus').textContent = `✅ Archivo cargado: ${file.name}`;
            document.getElementById('importStatus').style.color = 'green';
        } catch (error) {
            document.getElementById('importStatus').textContent = '❌ Error: Archivo JSON inválido';
            document.getElementById('importStatus').style.color = 'red';
        }
    };
    reader.readAsText(file);
}

function importData() {
    const importData = document.getElementById('backupFile').dataset.importData;
    
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
            updateRecentTravels();
            
            // Limpiar estado
            document.getElementById('backupFile').value = '';
            document.getElementById('backupFile').dataset.importData = '';
            document.getElementById('importStatus').textContent = '';
            
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
        updateRecentTravels();
        
        alert('🗑️ Todos los datos han sido eliminados');
    }
}

function generateSampleData() {
    if (confirm('¿Generar datos de ejemplo? Esto agregará viajes y guardias de prueba.')) {
        const sampleTravels = [
            {
                id: Date.now() + 1,
                orderNumber: 'ORD-001',
                origin: 'Depósito Central',
                destination: 'Planta Norte',
                km: 45.5,
                kmRuta: 45.5,
                acoplados: 0,
                type: 'normal',
                departureTime: '08:00',
                arrivalTime: '09:30',
                hoursWorked: '1.50',
                date: new Date().toLocaleDateString('es-ES'),
                viaticos: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 2,
                orderNumber: 'ORD-002',
                origin: 'Planta Norte',
                destination: 'Puerto',
                km: 85.0,
                kmRuta: 85.0,
                acoplados: 1,
                type: 'directo',
                departureTime: '10:00',
                arrivalTime: '13:00',
                hoursWorked: '3.00',
                date: new Date().toLocaleDateString('es-ES'),
                viaticos: 1,
                timestamp: new Date().toISOString()
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
        updateRecentTravels();
        
        alert('🎯 Datos de ejemplo generados exitosamente!');
    }
}

function getCurrentDateTime() {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace(/:/g, '-');
}
