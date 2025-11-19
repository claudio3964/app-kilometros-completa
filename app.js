// VARIABLES GLOBALES
let travels = JSON.parse(localStorage.getItem('bus_travels') || '[]');
let favoriteDestinations = JSON.parse(localStorage.getItem('bus_favorites') || '[]');

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
    } else if (screenId === 'guardScreen') {
        updateGuardList();
    } else if (screenId === 'travelListScreen') {
        updateAllTravelsList();
    } else if (screenId === 'guardListScreen') {
        updateAllGuardsList();
    }
}

// FUNCIONES DE VIAJES
function addTravel(event) {
    event.preventDefault();
    
    const orderNumber = document.getElementById('orderNumberTravels')?.value || '';
    const origin = document.getElementById('originTravels')?.value || '';
    const destination = document.getElementById('destinationTravels')?.value || '';
    const km = parseFloat(document.getElementById('kmTravels')?.value) || 0;
    const departureTime = document.getElementById('departureTimeTravels')?.value || '';
    const arrivalTime = document.getElementById('arrivalTimeTravels')?.value || '';
    
    if (!orderNumber || !origin || !destination || !km || !departureTime || !arrivalTime) {
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
        timestamp: new Date().toISOString()
    };
    
    travels.push(travel);
    localStorage.setItem('bus_travels', JSON.stringify(travels));
    
    // Limpiar formulario
    if (event.target.reset) event.target.reset();
    
    updateSummary();
    updateTravelTable();
    
    alert('✅ Viaje agregado exitosamente!');
    showScreen('mainScreen');
}

// FUNCIONES DE GUARDIAS
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
                origin: 'Depósito Central',
                destination: 'Planta Norte',
                km: 45.5,
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
