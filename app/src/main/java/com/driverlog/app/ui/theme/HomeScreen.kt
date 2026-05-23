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
import com.driverlog.app.data.Viaje
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch
import com.driverlog.app.data.Guardia
import com.driverlog.app.data.LaudoCalculator
@Composable
fun HomeScreen(
    legajo: String,
    repository: ViajeRepository,
    onCerrarSesion: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val viajes by repository.getTodosLosViajes().collectAsState(initial = emptyList())
    var viajeEnCurso by remember { mutableStateOf<Viaje?>(null) }
    var isSyncing by remember { mutableStateOf(false) }
    var mensajeGeo by remember { mutableStateOf<String?>(null) }
    val guardias by repository.getTodasLasGuardias().collectAsState(initial = emptyList())
    var guardiaEnCurso by remember { mutableStateOf<Guardia?>(null) }
    var totales by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }

    LaunchedEffect(Unit) {
        guardiaEnCurso = repository.getGuardiaEnCurso()
    }
    LaunchedEffect(legajo) {
        viajeEnCurso = repository.getViajeEnCurso()
        isSyncing = true
        repository.sincronizarDesdeSupabase(legajo)
        viajeEnCurso = repository.getViajeEnCurso()
        isSyncing = false
        totales = repository.calcularTotalesHoy()
    }
    DisposableEffect(Unit) {
        val receiverViaje = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val destino = intent?.getStringExtra("destino") ?: ""
                mensajeGeo = "✅ Llegaste a $destino — viaje cerrado automáticamente"
                scope.launch { viajeEnCurso = repository.getViajeEnCurso() }
            }
        }
        val receiverGuardia = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val inicio = intent?.getStringExtra("inicio") ?: ""
                mensajeGeo = "⏰ Llevás 8 horas de guardia desde las $inicio — ¿finalizás?"
            }
        }
        val receiverCortada = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val motivo = intent?.getStringExtra("motivo") ?: ""
                mensajeGeo = "✂️ Guardia cortada automáticamente — $motivo"
                scope.launch { guardiaEnCurso = repository.getGuardiaEnCurso() }
            }
        }
        val receiverNuevoViaje = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val origen = intent?.getStringExtra("origen") ?: ""
                val destino = intent?.getStringExtra("destino") ?: ""
                mensajeGeo = "🚌 Nuevo viaje asignado: $origen → $destino"
                scope.launch {
                    isSyncing = true
                    repository.sincronizarDesdeSupabase(legajo)
                    isSyncing = false
                }
            }
        }
        val receiverSyncJornada = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                scope.launch {
                    isSyncing = true
                    repository.sincronizarDesdeSupabase(legajo)
                    isSyncing = false
                }
            }
        }

        val filterNuevoViaje = android.content.IntentFilter("com.driverlog.NUEVO_VIAJE_ASIGNADO")
        val filterSyncJornada = android.content.IntentFilter("com.driverlog.SYNC_JORNADA")

        val filterViaje = android.content.IntentFilter("com.driverlog.VIAJE_FINALIZADO")
        val filterGuardia = android.content.IntentFilter("com.driverlog.GUARDIA_8_HORAS")
        val filterCortada = android.content.IntentFilter("com.driverlog.GUARDIA_CORTADA")

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiverViaje, filterViaje, android.content.Context.RECEIVER_NOT_EXPORTED)
            context.registerReceiver(receiverGuardia, filterGuardia, android.content.Context.RECEIVER_NOT_EXPORTED)
            context.registerReceiver(receiverCortada, filterCortada, android.content.Context.RECEIVER_NOT_EXPORTED)
            context.registerReceiver(receiverNuevoViaje, filterNuevoViaje, android.content.Context.RECEIVER_NOT_EXPORTED)
            context.registerReceiver(receiverSyncJornada, filterSyncJornada, android.content.Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiverViaje, filterViaje)
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiverGuardia, filterGuardia)
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiverCortada, filterCortada)
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiverNuevoViaje, filterNuevoViaje)
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiverSyncJornada, filterSyncJornada)
        }

        onDispose {
            context.unregisterReceiver(receiverViaje)
            context.unregisterReceiver(receiverGuardia)
            context.unregisterReceiver(receiverCortada)
            context.unregisterReceiver(receiverNuevoViaje)
            context.unregisterReceiver(receiverSyncJornada)
    }}
    LaunchedEffect(legajo) {
        viajeEnCurso = repository.getViajeEnCurso()
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
            modifier = Modifier.fillMaxWidth().padding(16.dp),
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
                TextButton(onClick = onCerrarSesion) { Text("Salir") }
            }
        }

        HorizontalDivider()
        // Resumen de jornada
        totales?.let { t ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0D1B2A))
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Resumen jornada", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("Km viajes", fontSize = 11.sp, color = Color.Gray)
                            Text("%.1f km".format(t.kmViajes), fontSize = 14.sp, color = Color.White)
                        }
                        Column {
                            Text("Km guardias", fontSize = 11.sp, color = Color.Gray)
                            Text("%.1f km".format(t.kmGuardias), fontSize = 14.sp, color = Color.White)
                        }
                        Column {
                            Text("Tome/Cese", fontSize = 11.sp, color = Color.Gray)
                            Text("%.1f km".format(t.kmTomeCese), fontSize = 14.sp, color = Color.White)
                        }
                        Column {
                            Text("Viáticos", fontSize = 11.sp, color = Color.Gray)
                            Text("${t.viaticos}", fontSize = 14.sp, color = Color.White)
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(color = Color.DarkGray)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total km: %.1f".format(t.kmTotal), fontWeight = FontWeight.Bold, color = Color.White)
                        Text("$ %.2f".format(t.monto), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF4CAF50))
                    }
                }
            }
        }
// Guardia
        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (guardiaEnCurso != null) Color(0xFF1A237E) else MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        if (guardiaEnCurso != null) "🛡 GUARDIA EN CURSO" else "Sin guardia activa",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = if (guardiaEnCurso != null) Color.White else Color.Gray
                    )
                    if (guardiaEnCurso != null) {
                        Text("Inicio: ${guardiaEnCurso!!.inicio}", fontSize = 12.sp, color = Color(0xFFBBBBBB))
                    }
                }
                if (guardiaEnCurso == null) {
                    Button(onClick = {
                        scope.launch {
                            val jornada = repository.getOCrearJornada(legajo)
                            guardiaEnCurso = repository.iniciarGuardia(jornada.orderNumber)
                        }
                    }) {
                        Text("Iniciar guardia")
                    }
                } else {
                    Button(
                        onClick = {
                            scope.launch {
                                repository.finalizarGuardia(guardiaEnCurso!!.id)
                                guardiaEnCurso = null
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF5350))
                    ) {
                        Text("Finalizar")
                    }
                }
            }
        }
        // Mensaje geo automático
        mensajeGeo?.let { msg ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1B5E20))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(msg, color = Color.White, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { mensajeGeo = null }) {
                        Text("✕", color = Color.White)
                    }
                }
            }
        }

        // Viaje en curso
        viajeEnCurso?.let { viaje ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("🚌 VIAJE EN CURSO", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("${viaje.origen} → ${viaje.destino}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text("Salida: ${viaje.departureTime}", fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            scope.launch {
                                repository.finalizarViaje(viaje.id)
                                GeoTerminalService.detener(context)
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
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No hay viajes programados", color = Color.Gray)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(viajes.filter { it.status != "en_curso" }) { viaje ->
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
@Composable
fun ViajeCard(viaje: Viaje, onActivar: () -> Unit) {
    val colorStatus = when (viaje.status) {
        "en_curso" -> MaterialTheme.colorScheme.primaryContainer
        "finalizado" -> Color.LightGray
        else -> MaterialTheme.colorScheme.surface
    }
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = colorStatus)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    "${viaje.origen} → ${viaje.destino}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f).padding(end = 8.dp)
                )
                StatusBadge(viaje.status)
            }
            Spacer(modifier = Modifier.height(4.dp))
            val llegadaTexto = if (viaje.status == "finalizado" && viaje.finReal != null) {
                val cal = java.util.Calendar.getInstance().apply { timeInMillis = viaje.finReal }
                "Llegada real: %02d:%02d".format(
                    cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE)
                )
            } else if (viaje.arrivalTime.isNotEmpty()) {
                "Llegada est.: ${viaje.arrivalTime}"
            } else ""
            Text(
                "Salida: ${viaje.departureTime}" + if (llegadaTexto.isNotEmpty()) "  |  $llegadaTexto" else "",
                fontSize = 13.sp,
                color = if (viaje.status == "finalizado" && viaje.finReal != null) Color(0xFF4CAF50) else Color.Unspecified
            )
            Text("Orden: ${viaje.orderNumber}", fontSize = 12.sp, color = Color.Gray)
            if (viaje.status == "programado") {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = onActivar, modifier = Modifier.fillMaxWidth()) {
                    Text("Iniciar viaje")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val (texto, color) = when (status) {
        "en_curso"   -> "En curso"   to MaterialTheme.colorScheme.primary
        "finalizado" -> "Finalizado" to Color.Gray
        "programado" -> "Programado" to MaterialTheme.colorScheme.secondary
        else         -> status       to Color.Gray
    }
    Surface(shape = MaterialTheme.shapes.small, color = color.copy(alpha = 0.2f)) {
        Text(texto, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp, color = color)
    }
}