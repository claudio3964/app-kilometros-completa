package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.driverlog.app.data.GeoTerminalService
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch
import java.util.Calendar

// ── Catálogo ──────────────────────────────────────────────────────────────────

data class RutaCatalogo(val origen: String, val destino: String, val km: Int)

val CATALOGO_RUTAS = listOf(
    RutaCatalogo("Montevideo", "Colonia", 178),
    RutaCatalogo("Montevideo", "Punta del Este", 140),
    RutaCatalogo("Montevideo", "Punta del Este x Piriápolis", 145),
    RutaCatalogo("Montevideo", "Punta del Este x Pan de Azúcar y San Carlos", 155),
    RutaCatalogo("Montevideo", "Punta del Este x Ruta 8 y 9", 165),
    RutaCatalogo("Montevideo", "Piriápolis", 97),
    RutaCatalogo("Montevideo", "Punta Negra", 112),
    RutaCatalogo("Montevideo", "Laguna Garzón", 183),
    RutaCatalogo("Montevideo", "La Paloma", 220),
    RutaCatalogo("Montevideo", "La Pedrera", 250),
    RutaCatalogo("Montevideo", "Rocha", 220),
    RutaCatalogo("Montevideo", "Aguas Dulces", 290),
    RutaCatalogo("Montevideo", "Chuy", 345),
    RutaCatalogo("Colonia", "Montevideo", 178),
    RutaCatalogo("Punta del Este", "Montevideo", 140),
    RutaCatalogo("Punta del Este", "Montevideo x Piriápolis", 145),
    RutaCatalogo("Punta del Este", "Montevideo x Pan de Azúcar y San Carlos", 155),
    RutaCatalogo("Punta del Este", "Montevideo x Ruta 8 y 9", 165),
    RutaCatalogo("Piriápolis", "Montevideo", 97),
    RutaCatalogo("Punta Negra", "Montevideo", 112),
    RutaCatalogo("Laguna Garzón", "Montevideo", 183),
    RutaCatalogo("La Paloma", "Montevideo", 220),
    RutaCatalogo("La Pedrera", "Montevideo", 250),
    RutaCatalogo("Rocha", "Montevideo", 220),
    RutaCatalogo("Aguas Dulces", "Montevideo", 290),
    RutaCatalogo("Chuy", "Montevideo", 345),
    RutaCatalogo("Punta del Este", "Piriápolis", 40),
    RutaCatalogo("Punta del Este", "Punta Negra", 28),
    RutaCatalogo("Punta del Este", "Laguna Garzón", 50),
    RutaCatalogo("Punta del Este", "La Pedrera", 150),
    RutaCatalogo("Punta del Este", "Chuy", 235),
    RutaCatalogo("Punta del Este", "San Carlos", 30),
    RutaCatalogo("Piriápolis", "Punta del Este", 40),
    RutaCatalogo("Punta Negra", "Punta del Este", 28),
    RutaCatalogo("Laguna Garzón", "Punta del Este", 50),
    RutaCatalogo("La Pedrera", "Punta del Este", 150),
    RutaCatalogo("Chuy", "Punta del Este", 245),
    RutaCatalogo("San Carlos", "Punta del Este", 30),
    RutaCatalogo("Piriápolis", "Punta Colorada", 15),
    RutaCatalogo("Piriápolis", "Punta Negra", 12),
    RutaCatalogo("Piriápolis", "Cuchilla Alta", 30),
    RutaCatalogo("Punta Colorada", "Piriápolis", 15),
    RutaCatalogo("Punta Negra", "Piriápolis", 12),
    RutaCatalogo("Cuchilla Alta", "Piriápolis", 30),
    RutaCatalogo("Rocha", "Chuy", 120),
    RutaCatalogo("Rocha", "La Paloma", 35),
    RutaCatalogo("Rocha", "La Pedrera", 40),
    RutaCatalogo("Rocha", "Aguas Dulces", 70),
    RutaCatalogo("Chuy", "Rocha", 120),
    RutaCatalogo("La Paloma", "Rocha", 35),
    RutaCatalogo("La Pedrera", "Rocha", 40),
    RutaCatalogo("Aguas Dulces", "Rocha", 70),
    RutaCatalogo("La Paloma", "Chuy", 120),
    RutaCatalogo("Chuy", "La Paloma", 120)
)

val BASES = listOf(
    "Montevideo", "Colonia", "Maldonado", "Punta del Este",
    "Piriápolis", "Rocha", "Chuy", "La Paloma", "La Pedrera", "Aguas Dulces"
)

val TIPOS_SERVICIO = listOf("TURNO", "SEMIDIRECTO", "DIRECTO", "EXPRESO", "CONTRATADO", "PASAJERO")

// ── Pantalla ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NuevoViajeScreen(
    legajo: String,
    base: String,
    repository: ViajeRepository,
    initialOrigen: String? = null,
    initialDestino: String? = null,
    initialKm: Int? = null,
    initialTipo: String? = null,
    onSaved: () -> Unit,
    onSavedConVuelta: (origen: String, destino: String, km: Int, tipo: String) -> Unit,
    onCancel: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val defaultBase = initialOrigen ?: base.ifEmpty { "Montevideo" }
    var origenSeleccionado by remember { mutableStateOf(defaultBase) }
    var destinoQuery by remember { mutableStateOf(initialDestino ?: "") }
    var rutaSeleccionada by remember {
        mutableStateOf(
            if (initialDestino != null && initialKm != null)
                RutaCatalogo(initialOrigen ?: base, initialDestino, initialKm)
            else null
        )
    }
    var kmManual by remember { mutableStateOf(initialKm?.toString() ?: "") }
    var tipoServicio by remember { mutableStateOf(initialTipo ?: "TURNO") }
    var coche by remember { mutableStateOf("") }
    var generarVuelta by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }

    val cal = remember { Calendar.getInstance() }
    var horaSalidaH by remember { mutableStateOf(cal.get(Calendar.HOUR_OF_DAY)) }
    var horaSalidaM by remember { mutableStateOf(cal.get(Calendar.MINUTE)) }
    var horaLlegadaH by remember { mutableStateOf(cal.get(Calendar.HOUR_OF_DAY) + 2) }
    var horaLlegadaM by remember { mutableStateOf(cal.get(Calendar.MINUTE)) }
    var tieneHoraLlegada by remember { mutableStateOf(false) }

    var showPickerSalida by remember { mutableStateOf(false) }
    var showPickerLlegada by remember { mutableStateOf(false) }

    var origenExpanded by remember { mutableStateOf(false) }
    var destinoExpanded by remember { mutableStateOf(false) }
    var tipoExpanded by remember { mutableStateOf(false) }

    val destinosFiltrados = remember(origenSeleccionado, destinoQuery) {
        CATALOGO_RUTAS
            .filter { it.origen == origenSeleccionado }
            .filter { destinoQuery.isBlank() || it.destino.contains(destinoQuery, ignoreCase = true) }
    }

    // Cuando cambia el origen, limpiar destino si ya no aplica
    LaunchedEffect(origenSeleccionado) {
        val actual = rutaSeleccionada
        if (actual != null && actual.origen != origenSeleccionado) {
            rutaSeleccionada = null
            destinoQuery = ""
            kmManual = ""
        }
    }

    if (showPickerSalida) {
        TimePickerDialog(
            title = "Hora de salida",
            initialHour = horaSalidaH,
            initialMinute = horaSalidaM,
            onDismiss = { showPickerSalida = false },
            onConfirm = { h, m ->
                horaSalidaH = h
                horaSalidaM = m
                showPickerSalida = false
            }
        )
    }

    if (showPickerLlegada) {
        TimePickerDialog(
            title = "Hora de llegada",
            initialHour = horaLlegadaH,
            initialMinute = horaLlegadaM,
            onDismiss = { showPickerLlegada = false },
            onConfirm = { h, m ->
                horaLlegadaH = h
                horaLlegadaM = m
                tieneHoraLlegada = true
                showPickerLlegada = false
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (initialOrigen != null) "Vuelta automática" else "Nuevo viaje") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // ── Origen ──
            item {
                ExposedDropdownMenuBox(
                    expanded = origenExpanded,
                    onExpandedChange = { origenExpanded = it }
                ) {
                    OutlinedTextField(
                        value = origenSeleccionado,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Origen") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = origenExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable, true)
                    )
                    ExposedDropdownMenu(
                        expanded = origenExpanded,
                        onDismissRequest = { origenExpanded = false }
                    ) {
                        BASES.forEach { b ->
                            DropdownMenuItem(
                                text = { Text(b) },
                                onClick = {
                                    origenSeleccionado = b
                                    origenExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // ── Destino (autocomplete) ──
            item {
                ExposedDropdownMenuBox(
                    expanded = destinoExpanded && destinosFiltrados.isNotEmpty(),
                    onExpandedChange = { destinoExpanded = it }
                ) {
                    OutlinedTextField(
                        value = destinoQuery,
                        onValueChange = {
                            destinoQuery = it
                            rutaSeleccionada = null
                            kmManual = ""
                            destinoExpanded = true
                        },
                        label = { Text("Destino") },
                        placeholder = { Text("Buscar destino…") },
                        trailingIcon = {
                            if (rutaSeleccionada != null) {
                                Text(
                                    "${rutaSeleccionada!!.km} km",
                                    fontSize = 12.sp,
                                    color = Color(0xFF4CAF50),
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryEditable, true)
                    )
                    ExposedDropdownMenu(
                        expanded = destinoExpanded && destinosFiltrados.isNotEmpty(),
                        onDismissRequest = { destinoExpanded = false }
                    ) {
                        destinosFiltrados.forEach { ruta ->
                            DropdownMenuItem(
                                text = {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(ruta.destino, modifier = Modifier.weight(1f))
                                        Text(
                                            "${ruta.km} km",
                                            fontSize = 12.sp,
                                            color = Color.Gray
                                        )
                                    }
                                },
                                onClick = {
                                    rutaSeleccionada = ruta
                                    destinoQuery = ruta.destino
                                    kmManual = ruta.km.toString()
                                    destinoExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // ── Km (editable si no hay ruta del catálogo) ──
            item {
                OutlinedTextField(
                    value = kmManual,
                    onValueChange = { if (rutaSeleccionada == null) kmManual = it },
                    label = { Text("Kilómetros") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    readOnly = rutaSeleccionada != null,
                    supportingText = if (rutaSeleccionada != null) {
                        { Text("Calculado automáticamente", color = Color(0xFF4CAF50), fontSize = 11.sp) }
                    } else null,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // ── Tipo de servicio ──
            item {
                ExposedDropdownMenuBox(
                    expanded = tipoExpanded,
                    onExpandedChange = { tipoExpanded = it }
                ) {
                    OutlinedTextField(
                        value = tipoServicio,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Tipo de servicio") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = tipoExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable, true)
                    )
                    ExposedDropdownMenu(
                        expanded = tipoExpanded,
                        onDismissRequest = { tipoExpanded = false }
                    ) {
                        TIPOS_SERVICIO.forEach { tipo ->
                            DropdownMenuItem(
                                text = { Text(tipo) },
                                onClick = {
                                    tipoServicio = tipo
                                    tipoExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // ── Número de coche ──
            item {
                OutlinedTextField(
                    value = coche,
                    onValueChange = { coche = it },
                    label = { Text("Número de coche") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // ── Hora salida ──
            item {
                OutlinedTextField(
                    value = "%02d:%02d".format(horaSalidaH, horaSalidaM),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Hora de salida") },
                    trailingIcon = {
                        TextButton(onClick = { showPickerSalida = true }) { Text("Cambiar") }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // ── Hora llegada (opcional) ──
            item {
                OutlinedTextField(
                    value = if (tieneHoraLlegada) "%02d:%02d".format(horaLlegadaH, horaLlegadaM) else "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Hora de llegada estimada (opcional)") },
                    placeholder = { Text("Sin hora de llegada") },
                    trailingIcon = {
                        TextButton(onClick = { showPickerLlegada = true }) { Text("Fijar") }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // ── Vuelta automática ──
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = generarVuelta,
                        onCheckedChange = { generarVuelta = it }
                    )
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text("Generar vuelta automática", fontWeight = FontWeight.Medium)
                        Text(
                            "Al guardar, abre el formulario con el viaje de regreso pre-cargado",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                    }
                }
            }

            // ── Botón guardar ──
            item {
                val kmFinal = rutaSeleccionada?.km ?: kmManual.toIntOrNull() ?: 0
                val destinoFinal = if (rutaSeleccionada != null) destinoQuery
                else destinoQuery.trim()
                val habilitado = destinoFinal.isNotEmpty() && !guardando

                Button(
                    onClick = {
                        if (!habilitado) return@Button
                        guardando = true
                        scope.launch {
                            try {
                                val horaSalidaStr = "%02d:%02d".format(horaSalidaH, horaSalidaM)
                                val horaLlegadaStr = if (tieneHoraLlegada)
                                    "%02d:%02d".format(horaLlegadaH, horaLlegadaM) else ""
                                val inicioProgramadoMs = calcularInicioMs(horaSalidaH, horaSalidaM)

                                val viaje = repository.crearViaje(
                                    legajo = legajo,
                                    origen = origenSeleccionado,
                                    destino = destinoFinal,
                                    km = kmFinal,
                                    tipoServicio = tipoServicio,
                                    coche = coche,
                                    horaSalida = horaSalidaStr,
                                    horaLlegada = horaLlegadaStr,
                                    inicioProgramadoMs = inicioProgramadoMs
                                )

                                if (viaje.status == "en_curso") {
                                    GeoTerminalService.iniciar(context, viaje)
                                }

                                if (generarVuelta) {
                                    val origenVuelta = destinoFinal.split(" x ")[0]
                                    val destinoVuelta = origenSeleccionado
                                    val kmVuelta = CATALOGO_RUTAS
                                        .find { it.origen == origenVuelta && it.destino == destinoVuelta }
                                        ?.km ?: kmFinal
                                    onSavedConVuelta(origenVuelta, destinoVuelta, kmVuelta, tipoServicio)
                                } else {
                                    onSaved()
                                }
                            } finally {
                                guardando = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = habilitado
                ) {
                    if (guardando) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                    } else {
                        Text(if (generarVuelta) "Guardar y cargar vuelta" else "Guardar viaje")
                    }
                }
            }
        }
    }
}

// ── Time Picker simple ────────────────────────────────────────────────────────

@Composable
private fun TimePickerDialog(
    title: String,
    initialHour: Int,
    initialMinute: Int,
    onDismiss: () -> Unit,
    onConfirm: (Int, Int) -> Unit
) {
    var hour by remember { mutableStateOf(initialHour.coerceIn(0, 23)) }
    var minute by remember { mutableStateOf((initialMinute / 5) * 5) }

    Dialog(onDismissRequest = onDismiss) {
        Card(shape = MaterialTheme.shapes.large) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.height(16.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    // Horas
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        IconButton(onClick = { hour = (hour + 1) % 24 }) {
                            Icon(Icons.Filled.KeyboardArrowUp, contentDescription = null)
                        }
                        Text(
                            "%02d".format(hour),
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { hour = (hour - 1 + 24) % 24 }) {
                            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null)
                        }
                    }
                    Text(":", fontSize = 36.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp))
                    // Minutos (paso 5)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        IconButton(onClick = { minute = (minute + 5) % 60 }) {
                            Icon(Icons.Filled.KeyboardArrowUp, contentDescription = null)
                        }
                        Text(
                            "%02d".format(minute),
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { minute = (minute - 5 + 60) % 60 }) {
                            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Cancelar") }
                    Spacer(Modifier.width(8.dp))
                    Button(onClick = { onConfirm(hour, minute) }) { Text("OK") }
                }
            }
        }
    }
}

private fun calcularInicioMs(hora: Int, minuto: Int): Long {
    val cal = Calendar.getInstance()
    cal.set(Calendar.HOUR_OF_DAY, hora)
    cal.set(Calendar.MINUTE, minuto)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}
