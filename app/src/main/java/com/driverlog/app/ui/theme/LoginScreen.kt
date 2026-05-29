package com.driverlog.app.ui.theme

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.CotApplication
import com.driverlog.app.data.DeviceCheckResult
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    repository: ViajeRepository,
    onLoginSuccess: (String) -> Unit
) {
    var legajo by remember { mutableStateOf("") }
    var verificando by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var mostrarRegistro by remember { mutableStateOf(false) }
    var nombreReg by remember { mutableStateOf("") }
    var baseReg by remember { mutableStateOf("Montevideo") }
    var tipoReg by remember { mutableStateOf("contratado") }
    var registrando by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (mostrarRegistro) {
            // ── Formulario de registro ───────────────────────────────────────
            Text("Nuevo chofer", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text(
                "Legajo $legajo no está registrado.",
                fontSize = 13.sp,
                color = Color.Gray
            )

            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = nombreReg,
                onValueChange = { nombreReg = it },
                label = { Text("Nombre completo") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(12.dp))

            val bases = listOf(
                "Montevideo", "Colonia", "Punta del Este",
                "Piriápolis", "Rocha", "Chuy"
            )
            var expandedBase by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = expandedBase,
                onExpandedChange = { expandedBase = it }
            ) {
                OutlinedTextField(
                    value = baseReg,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Base") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expandedBase) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(
                    expanded = expandedBase,
                    onDismissRequest = { expandedBase = false }
                ) {
                    bases.forEach { b ->
                        DropdownMenuItem(
                            text = { Text(b) },
                            onClick = { baseReg = b; expandedBase = false }
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                listOf("efectivo", "contratado").forEach { t ->
                    FilterChip(
                        selected = tipoReg == t,
                        onClick = { tipoReg = t },
                        label = { Text(t.replaceFirstChar { it.uppercase() }) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    if (nombreReg.isBlank()) return@Button
                    registrando = true
                    scope.launch {
                        val ok = repository.registrarChofer(
                            legajo = legajo.trim(),
                            nombre = nombreReg.trim(),
                            base = baseReg,
                            tipo = tipoReg
                        )
                        if (ok) {
                            repository.guardarPerfil(nombreReg.trim(), baseReg, tipoReg)
                            repository.guardarLegajo(legajo.trim())
                            repository.saveDeviceId(repository.getCurrentDeviceId())
                            val token = CotApplication.getCachedFcmToken(
                                context.applicationContext as Application
                            )
                            if (token != null) {
                                repository.guardarFcmToken(legajo.trim(), token)
                            }
                            onLoginSuccess(legajo.trim())
                        } else {
                            errorMsg = "Error al registrar. Intentá de nuevo."
                            mostrarRegistro = false
                        }
                        registrando = false
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = nombreReg.isNotBlank() && !registrando
            ) {
                if (registrando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Registrando...")
                } else {
                    Text("Registrarme")
                }
            }

            Spacer(Modifier.height(12.dp))

            TextButton(onClick = { mostrarRegistro = false }) {
                Text("← Volver", color = Color.Gray)
            }

            errorMsg?.let { msg ->
                Spacer(Modifier.height(8.dp))
                Text(
                    text = msg,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        } else {
            // ── Formulario de login ──────────────────────────────────────────
            Text("COT Driver", fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text("Sistema de registro de kilómetros", fontSize = 14.sp, color = Color.Gray)

            Spacer(Modifier.height(48.dp))

            OutlinedTextField(
                value = legajo,
                onValueChange = {
                    legajo = it
                    errorMsg = null
                },
                label = { Text("Legajo") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = errorMsg != null,
                enabled = !verificando
            )

            errorMsg?.let { msg ->
                Spacer(Modifier.height(8.dp))
                Text(
                    text = msg,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    if (legajo.isBlank() || verificando) return@Button
                    verificando = true
                    errorMsg = null
                    scope.launch {
                        val result = repository.verificarDispositivo(legajo.trim())
                        verificando = false
                        when (result) {
                            is DeviceCheckResult.Permitido,
                            is DeviceCheckResult.RegistrarYPermitir -> {
                                val token = CotApplication.getCachedFcmToken(
                                    context.applicationContext as Application
                                )
                                if (token != null) {
                                    repository.guardarFcmToken(legajo.trim(), token)
                                }
                                onLoginSuccess(legajo.trim())
                            }
                            is DeviceCheckResult.NoEncontrado -> {
                                mostrarRegistro = true
                            }
                            is DeviceCheckResult.Bloqueado -> {
                                errorMsg = result.mensaje
                            }
                            is DeviceCheckResult.ErrorRed -> {
                                errorMsg = "Sin conexión. Verificá tu internet e intentá de nuevo."
                            }
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = legajo.isNotBlank() && !verificando
            ) {
                if (verificando) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Text("Verificando…", fontSize = 16.sp)
                    }
                } else {
                    Text("Ingresar", fontSize = 16.sp)
                }
            }
        }
    }
}
