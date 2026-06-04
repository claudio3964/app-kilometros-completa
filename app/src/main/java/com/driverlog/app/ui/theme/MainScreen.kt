package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.data.GeoTerminalService
import com.driverlog.app.data.Jornada
import com.driverlog.app.data.Viaje
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Calendar
import com.driverlog.app.data.LaudoCalculator
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
@Composable
fun MainScreen(
    legajo: String,
    nombre: String,
    base: String,
    tipo: String,
    repository: ViajeRepository,
    onNuevoViaje: () -> Unit,
    onVerViajes: () -> Unit,
    onNuevaGuardia: () -> Unit,
    onVerGuardias: () -> Unit,
    onHistorial: () -> Unit,
    onCerrarSesion: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val viajes by repository.getTodosLosViajes().collectAsState(initial = emptyList())
    var viajeEnCurso by remember { mutableStateOf<Viaje?>(null) }
    var jornadaActiva by remember { mutableStateOf<Jornada?>(null) }
    var isSyncing by remember { mutableStateOf(false) }
    var mensajeGeo by remember { mutableStateOf<String?>(null) }
    var tickMs by remember { mutableStateOf(System.currentTimeMillis()) }
    var llegadaEstimada by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            tickMs = System.currentTimeMillis()
        }
    }

    LaunchedEffect(legajo) {
        viajeEnCurso = repository.getViajeEnCurso()
        jornadaActiva = repository.getJornadaActiva()
        isSyncing = true
        repository.sincronizarDesdeSupabase(legajo)
        viajeEnCurso = repository.getViajeEnCurso()
        isSyncing = false
    }

    LaunchedEffect(viajeEnCurso) {
        val viaje = viajeEnCurso
        if (viaje != null) {
            if (viaje.status == "en_curso" && !isServiceRunning(context, GeoTerminalService::class.java)) {
                val prueba = viaje.origen == "Prueba" && viaje.destino == "Prueba"
                GeoTerminalService.iniciar(context, viaje, modoPrueba = prueba)
            }
            val ruta = "${viaje.origen}→${viaje.destino}"
            val promedioMin = repository.getDuracionPromedio(ruta)
            val duracionMs = when {
                promedioMin != null -> promedioMin * 60_000L
                viaje.kmEmpresa > 0 -> viaje.kmEmpresa * 60_000L
                else -> null
            }
            if (duracionMs != null) {
                val inicio = viaje.inicioReal ?: viaje.inicioProgramado
                val llegadaMs = inicio + duracionMs
                val cal = Calendar.getInstance().apply { timeInMillis = llegadaMs }
                llegadaEstimada = "%02d:%02d".format(
                    cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE)
                )
            } else {
                llegadaEstimada = viaje.arrivalTime.takeIf { it.isNotEmpty() }
            }
        } else {
            llegadaEstimada = null
        }
    }

    DisposableEffect(Unit) {
        val rxViaje = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val destino = intent?.getStringExtra("destino") ?: ""
                mensajeGeo = "Llegaste a $destino — viaje cerrado automáticamente"
                Log.d("COT", "Broadcast VIAJE_FINALIZADO recibido")
                scope.launch {
                    viajeEnCurso = repository.getViajeEnCurso()
                    jornadaActiva = repository.getJornadaActiva()
                }
            }
        }
        val rxGuardia8h = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val inicio = intent?.getStringExtra("inicio") ?: ""
                mensajeGeo = "Llevas 8 horas de guardia desde las $inicio"
            }
        }
        val rxGuardiaCortada = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val motivo = intent?.getStringExtra("motivo") ?: ""
                mensajeGeo = "Guardia cortada automáticamente — $motivo"
            }
        }
        val rxNuevoViaje = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val origen = intent?.getStringExtra("origen") ?: ""
                val destino = intent?.getStringExtra("destino") ?: ""
                mensajeGeo = "Nuevo viaje asignado: $origen → $destino"
                scope.launch {
                    isSyncing = true
                    repository.sincronizarDesdeSupabase(legajo)
                    isSyncing = false
                }
            }
        }
        val rxSync = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                scope.launch {
                    isSyncing = true
                    repository.sincronizarDesdeSupabase(legajo)
                    isSyncing = false
                }
            }
        }

        fun register(rx: android.content.BroadcastReceiver, action: String) {
            val filter = android.content.IntentFilter(action)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(rx, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.registerReceiver(rx, filter)
            }
        }

        register(rxViaje, "com.driverlog.VIAJE_FINALIZADO")
        register(rxGuardia8h, "com.driverlog.GUARDIA_8_HORAS")
        register(rxGuardiaCortada, "com.driverlog.GUARDIA_CORTADA")
        register(rxNuevoViaje, "com.driverlog.NUEVO_VIAJE_ASIGNADO")
        register(rxSync, "com.driverlog.SYNC_JORNADA")

        onDispose {
            context.unregisterReceiver(rxViaje)
            context.unregisterReceiver(rxGuardia8h)
            context.unregisterReceiver(rxGuardiaCortada)
            context.unregisterReceiver(rxNuevoViaje)
            context.unregisterReceiver(rxSync)
        }
    }

    val proximoViaje = remember(viajes) {
        viajes.filter { it.status == "programado" }.minByOrNull { it.inicioProgramado }
    }
    val countdownText = remember(proximoViaje, tickMs) {
        proximoViaje?.let {
            val diff = it.inicioProgramado - tickMs
            if (diff <= 0) "¡Ahora!" else formatCountdown(diff)
        } ?: ""
    }
    val elapsedText = remember(viajeEnCurso, tickMs) {
        viajeEnCurso?.inicioReal?.let { formatElapsed(tickMs - it) } ?: ""
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // ── Header ──
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        nombre.ifEmpty { "COT Driver" },
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                    Text(
                        "$legajo · $base · ${tipo.replaceFirstChar { it.uppercase() }}",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    jornadaActiva?.let {
                        Text("Orden: ${it.orderNumber}", fontSize = 11.sp, color = Color(0xFF4CAF50))
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    TextButton(onClick = onCerrarSesion) { Text("Salir") }
                }
            }
        }

        item { HorizontalDivider() }

        // ── Notificación geo ──
        mensajeGeo?.let { msg ->
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1B5E20))
                ) {
                    Row(
                        modifier = Modifier
                            .padding(12.dp)
                            .fillMaxWidth(),
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
        }

        // ── Card viaje PROGRAMADO ──
        if (proximoViaje != null && viajeEnCurso == null) {
            item {
                val partes = proximoViaje.destino.split(" x ", limit = 2)
                val destinoPrincipal = partes[0]
                val via = if (partes.size > 1) "x ${partes[1]}" else null

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "PRÓXIMO VIAJE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE65100)
                            )
                            Text(
                                countdownText,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE65100)
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "${proximoViaje.origen} → $destinoPrincipal",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color(0xFF212121)
                        )
                        via?.let {
                            Text(it, fontSize = 12.sp, color = Color(0xFF757575))
                        }
                        Spacer(Modifier.height(2.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                "Salida: ${proximoViaje.departureTime}",
                                fontSize = 12.sp,
                                color = Color(0xFF616161)
                            )
                            if (proximoViaje.kmEmpresa > 0) {
                                Text(
                                    "${proximoViaje.kmEmpresa} km",
                                    fontSize = 12.sp,
                                    color = Color(0xFF616161)
                                )
                            }
                            if (proximoViaje.tipoServicio.isNotEmpty()) {
                                Text(
                                    proximoViaje.tipoServicio,
                                    fontSize = 12.sp,
                                    color = Color(0xFF616161)
                                )
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        repository.activarViaje(proximoViaje)
                                        viajeEnCurso = repository.getViajeEnCurso()
                                        jornadaActiva = repository.getJornadaActiva()
                                        GeoTerminalService.iniciar(context, proximoViaje)
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE65100))
                            ) {
                                Text("Iniciar ahora")
                            }
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        repository.cancelarViaje(proximoViaje.id)
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Cancelar")
                            }
                        }
                    }
                }
            }
        }

        // ── Card viaje EN CURSO ──
        viajeEnCurso?.let { viaje ->
            item {
                val partes = viaje.destino.split(" x ", limit = 2)
                val destinoPrincipal = partes[0]
                val via = if (partes.size > 1) "x ${partes[1]}" else null
                val horaSalidaReal = viaje.inicioReal?.let {
                    val cal = Calendar.getInstance().apply { timeInMillis = it }
                    "%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
                } ?: viaje.departureTime
                val kmPorMinuto = viaje.kmEmpresa /
                    (viaje.duracionMinutos?.takeIf { it > 0 } ?: 120).toDouble()
                val minutosTranscurridos = (tickMs - (viaje.inicioReal ?: tickMs)) / 60000.0
                val kmRecorridos = (kmPorMinuto * minutosTranscurridos)
                    .coerceAtMost(viaje.kmEmpresa.toDouble())

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0D1B2A))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            "EN CURSO",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF4CAF50)
                        )
                        if (elapsedText.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    "⏱ $elapsedText",
                                    fontSize = 13.sp,
                                    color = Color(0xFF4CAF50),
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "📍 ${"%.1f".format(kmRecorridos)} / ${viaje.kmEmpresa} km",
                                    fontSize = 13.sp,
                                    color = Color(0xFF4CAF50),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "${viaje.origen} → $destinoPrincipal",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        via?.let {
                            Text(it, fontSize = 12.sp, color = Color(0xFF90A4AE))
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("Salida", fontSize = 10.sp, color = Color(0xFF78909C))
                                Text(horaSalidaReal, fontSize = 13.sp, color = Color.White)
                            }
                            llegadaEstimada?.let {
                                Column {
                                    Text("Llegada est.", fontSize = 10.sp, color = Color(0xFF78909C))
                                    Text(it, fontSize = 13.sp, color = Color(0xFF80CBC4))
                                }
                            }
                            if (viaje.kmEmpresa > 0) {
                                Column {
                                    Text("Km", fontSize = 10.sp, color = Color(0xFF78909C))
                                    Text("${viaje.kmEmpresa}", fontSize = 13.sp, color = Color.White)
                                }
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = {
                                scope.launch {
                                    repository.finalizarViaje(viaje.id)
                                    GeoTerminalService.detener(context)
                                    viajeEnCurso = null
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF5350))
                        ) {
                            Text("Finalizar viaje")
                        }
                    }
                }
            }
        }

        // ── Sin viaje activo ──
        if (proximoViaje == null && viajeEnCurso == null) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Sin viajes asignados", color = Color.Gray, fontSize = 14.sp)
                    }
                }
            }
        }

        // ── Grid operaciones ──
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Operaciones", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Color.Gray)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OperacionCard("Nuevo viaje", Icons.Filled.Add, Modifier.weight(1f), onClick = onNuevoViaje)
                    OperacionCard("Ver viajes", Icons.Filled.DirectionsBus, Modifier.weight(1f), onClick = onVerViajes)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OperacionCard("Nueva guardia", Icons.Filled.Add, Modifier.weight(1f), onClick = onNuevaGuardia)
                    OperacionCard("Ver guardias", Icons.Filled.Lock, Modifier.weight(1f), onClick = onVerGuardias)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OperacionCard("Historial", Icons.Filled.DateRange, Modifier.weight(1f), onClick = onHistorial)
                    Spacer(Modifier.weight(1f))
                }
            }
        }
        // ── Modo prueba GPS ──
        if (viajeEnCurso == null && proximoViaje == null) {
            item {
                TextButton(
                    onClick = {
                        scope.launch {
                            val ahora = System.currentTimeMillis()
                            val viaje = repository.crearViaje(
                                legajo = legajo,
                                origen = "Prueba",
                                destino = "Prueba",
                                km = 1,
                                tipoServicio = "TURNO",
                                coche = "TEST",
                                horaSalida = "%02d:%02d".format(
                                    java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY),
                                    java.util.Calendar.getInstance().get(java.util.Calendar.MINUTE)
                                ),
                                horaLlegada = "",
                                inicioProgramadoMs = ahora
                            )
                            viajeEnCurso = repository.getViajeEnCurso()
                            GeoTerminalService.iniciar(context, viaje, modoPrueba = true)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                ) {
                    Text("[ modo prueba GPS ]", fontSize = 11.sp, color = Color.Gray)
                }
            }
        }

        if (jornadaActiva != null && viajeEnCurso == null) {
            item {
                var showConfirm by remember { mutableStateOf(false) }
                var totalesPreview by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }
                var cerrando by remember { mutableStateOf(false) }

                if (showConfirm && totalesPreview != null) {
                    AlertDialog(
                        onDismissRequest = { showConfirm = false },
                        title = { Text("Finalizar jornada") },
                        text = {
                            val t = totalesPreview!!
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Km viajes: %.1f".format(t.kmViajes))
                                Text("Km guardias: %.1f".format(t.kmGuardias))
                                Text("Tome/cese: %.1f".format(t.kmTomeCese))
                                Text("Acoplados: %.1f".format(t.kmAcoplados))
                                HorizontalDivider()
                                Text("Total km: %.1f".format(t.kmTotal), fontWeight = FontWeight.Bold)
                                Text("Viáticos: ${t.viaticos}")
                                Text(
                                    "Monto: $ %.2f".format(t.monto),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF4CAF50)
                                )
                            }
                        },
                        confirmButton = {
                            Button(
                                onClick = {
                                    cerrando = true
                                    scope.launch {
                                        val pdf = repository.cerrarJornada(legajo)
                                        jornadaActiva = repository.getJornadaActiva()
                                        showConfirm = false
                                        cerrando = false
                                        pdf?.let { compartirPdf(context, it) }
                                    }
                                },
                                enabled = !cerrando,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6A1B9A))
                            ) {
                                Text("Confirmar cierre")
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { showConfirm = false }) {
                                Text("Cancelar")
                            }
                        }
                    )
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            totalesPreview = jornadaActiva?.orderNumber?.let {
                                repository.calcularTotalesJornada(it)
                            }
                            showConfirm = true
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF6A1B9A))
                ) {
                    Text("Finalizar jornada")
                }
            }
        }

    }  // cierre LazyColumn
}      // cierre MainScreen
@Composable
private fun OperacionCard(
    texto: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier.height(72.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp))
            Spacer(Modifier.height(4.dp))
            Text(
                texto,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2
            )
        }
    }
}

private fun isServiceRunning(context: Context, serviceClass: Class<*>): Boolean {
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return manager.getRunningServices(Int.MAX_VALUE)
        .any { it.service.className == serviceClass.name }
}

private fun compartirPdf(context: android.content.Context, file: File) {
    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        file
    )
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Compartir planilla de jornada"))
}

private fun formatCountdown(diffMs: Long): String {
    val h = diffMs / 3600000
    val m = (diffMs % 3600000) / 60000
    val s = (diffMs % 60000) / 1000
    return if (h > 0) "En ${h}h ${m}m" else "En ${m}m ${s}s"
}

private fun formatElapsed(diffMs: Long): String {
    if (diffMs <= 0) return ""
    val h = diffMs / 3600000
    val m = (diffMs % 3600000) / 60000
    return if (h > 0) "${h}h ${m}m" else "${m}m"
}
