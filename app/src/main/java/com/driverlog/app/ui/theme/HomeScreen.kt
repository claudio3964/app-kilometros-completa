package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.data.Viaje
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    legajo: String,
    repository: ViajeRepository,
    onCerrarSesion: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val viajes by repository.getTodosLosViajes().collectAsState(initial = emptyList())
    var viajeEnCurso by remember { mutableStateOf<Viaje?>(null) }
    var isSyncing by remember { mutableStateOf(false) }

    LaunchedEffect(legajo) {
        viajeEnCurso = repository.getViajeEnCurso()
        // Sync automático al abrir
        scope.launch {
            isSyncing = true
            repository.sincronizarDesdeSupabase(legajo)
            viajeEnCurso = repository.getViajeEnCurso()
            isSyncing = false
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {

        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("COT Driver", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text("Legajo: $legajo", fontSize = 12.sp, color = Color.Gray)
            }
            Row {
                if (isSyncing) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                TextButton(onClick = onCerrarSesion) {
                    Text("Salir")
                }
            }
        }

        HorizontalDivider()

        // Viaje en curso
        viajeEnCurso?.let { viaje ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "🚌 VIAJE EN CURSO",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "${viaje.origen} → ${viaje.destino}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text("Salida: ${viaje.departureTime}", fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            scope.launch {
                                repository.finalizarViaje(viaje.id)
                                viajeEnCurso = null
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Finalizar viaje")
                    }
                }
            }
        }

        // Lista de viajes
        if (viajes.isEmpty() && !isSyncing) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No hay viajes programados", color = Color.Gray)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(viajes) { viaje ->
                    ViajeCard(
                        viaje = viaje,
                        onActivar = {
                            scope.launch {
                                repository.activarViaje(viaje)
                                viajeEnCurso = repository.getViajeEnCurso()
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ViajeCard(viaje: Viaje, onActivar: () -> Unit) {
    val colorStatus = when (viaje.status) {
        "en_curso" -> MaterialTheme.colorScheme.primaryContainer
        "finalizado" -> Color.LightGray
        else -> MaterialTheme.colorScheme.surface
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = colorStatus)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "${viaje.origen} → ${viaje.destino}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                StatusBadge(viaje.status)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text("Salida: ${viaje.departureTime}  |  Llegada: ${viaje.arrivalTime}", fontSize = 13.sp)
            Text("Orden: ${viaje.orderNumber}", fontSize = 12.sp, color = Color.Gray)

            if (viaje.status == "programado") {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onActivar,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Iniciar viaje")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val (texto, color) = when (status) {
        "en_curso" -> "En curso" to MaterialTheme.colorScheme.primary
        "finalizado" -> "Finalizado" to Color.Gray
        "programado" -> "Programado" to MaterialTheme.colorScheme.secondary
        else -> status to Color.Gray
    }
    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            texto,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            fontSize = 11.sp,
            color = color
        )
    }
}