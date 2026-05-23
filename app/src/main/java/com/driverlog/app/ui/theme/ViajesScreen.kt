package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.data.GeoTerminalService
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch

@Composable
fun ViajesScreen(
    legajo: String,
    repository: ViajeRepository
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val viajes by repository.getTodosLosViajes().collectAsState(initial = emptyList())
    var viajeEnCurso by remember { mutableStateOf(viajes.firstOrNull { it.status == "en_curso" }) }

    LaunchedEffect(legajo) {
        viajeEnCurso = repository.getViajeEnCurso()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Viajes del día", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text("${viajes.size} viajes", fontSize = 13.sp, color = Color.Gray)
        }
        HorizontalDivider()

        if (viajes.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No hay viajes para hoy", color = Color.Gray)
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
                                GeoTerminalService.iniciar(context, viaje)
                            }
                        }
                    )
                }
            }
        }
    }
}
