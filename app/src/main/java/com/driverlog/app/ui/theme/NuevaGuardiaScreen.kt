package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NuevaGuardiaScreen(
    legajo: String,
    repository: ViajeRepository,
    onGuardada: () -> Unit,
    onCancel: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var tipo by remember { mutableStateOf("comun") }
    var descripcion by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }

    // Hora actual como default
    val cal = Calendar.getInstance()
    var horaSeleccionada by remember {
        mutableStateOf("%02d:%02d".format(
            cal.get(Calendar.HOUR_OF_DAY),
            cal.get(Calendar.MINUTE)
        ))
    }

    // Date picker — día de hoy como default
    val hoy = remember {
        "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }
    val diaFormateado = remember {
        "%02d/%02d/%04d".format(
            cal.get(Calendar.DAY_OF_MONTH),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.YEAR)
        )
    }

    // Time picker state
    var showTimePicker by remember { mutableStateOf(false) }
    val timePickerState = rememberTimePickerState(
        initialHour = cal.get(Calendar.HOUR_OF_DAY),
        initialMinute = cal.get(Calendar.MINUTE)
    )

    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    horaSeleccionada = "%02d:%02d".format(
                        timePickerState.hour,
                        timePickerState.minute
                    )
                    showTimePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancelar") }
            },
            text = { TimePicker(state = timePickerState) }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nueva guardia") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Día
            OutlinedTextField(
                value = diaFormateado,
                onValueChange = {},
                label = { Text("Día") },
                modifier = Modifier.fillMaxWidth(),
                readOnly = true,
                enabled = false
            )

            // Hora inicio
            OutlinedTextField(
                value = horaSeleccionada,
                onValueChange = {},
                label = { Text("Hora inicio") },
                modifier = Modifier.fillMaxWidth(),
                readOnly = true,
                trailingIcon = {
                    TextButton(onClick = { showTimePicker = true }) {
                        Text("Cambiar")
                    }
                }
            )

            // Tipo de guardia
            Text("Tipo de guardia", fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                FilterChip(
                    selected = tipo == "comun",
                    onClick = { tipo = "comun"; errorMsg = null },
                    label = { Text("Común") }
                )
                FilterChip(
                    selected = tipo == "especial",
                    onClick = { tipo = "especial"; errorMsg = null },
                    label = { Text("Especial") }
                )
            }

            // Descripción — solo si es especial
            if (tipo == "especial") {
                OutlinedTextField(
                    value = descripcion,
                    onValueChange = { descripcion = it; errorMsg = null },
                    label = { Text("Descripción (obligatorio)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = false,
                    minLines = 2
                )
            }

            // Error
            errorMsg?.let {
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            Spacer(Modifier.weight(1f))

            // Botón registrar
            Button(
                onClick = {
                    if (guardando) return@Button
                    errorMsg = null

                    // Validaciones
                    if (tipo == "especial" && descripcion.isBlank()) {
                        errorMsg = "La guardia especial requiere descripción"
                        return@Button
                    }

                    guardando = true
                    scope.launch {
                        try {
                            // Validar hora vs último viaje finalizado
                            val ultimoViaje = repository.getUltimoViajeFinalizado()
                            if (ultimoViaje != null && ultimoViaje.arrivalTime.isNotEmpty()) {
                                val horaGuardia = horaAMinutos(horaSeleccionada)
                                val horaViaje = horaAMinutos(ultimoViaje.arrivalTime)
                                if (horaGuardia < horaViaje) {
                                    errorMsg = "La guardia no puede iniciar antes del fin del último viaje (${ultimoViaje.arrivalTime})"
                                    guardando = false
                                    return@launch
                                }
                            }

                            val jornada = repository.getOCrearJornada(legajo)
                            repository.iniciarGuardia(
                                orderNumber = jornada.orderNumber,
                                type = tipo,
                                inicio = horaSeleccionada,
                                dia = diaFormateado,
                                descripcion = descripcion.trim().takeIf { it.isNotEmpty() }
                            )
                            onGuardada()
                        } catch (e: Exception) {
                            errorMsg = "Error al registrar guardia: ${e.message}"
                            guardando = false
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = !guardando
            ) {
                if (guardando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                } else {
                    Text("Registrar guardia", fontSize = 16.sp)
                }
            }
        }
    }
}

private fun horaAMinutos(hora: String): Int {
    return try {
        val partes = hora.split(":")
        partes[0].toInt() * 60 + partes[1].toInt()
    } catch (e: Exception) { 0 }
}