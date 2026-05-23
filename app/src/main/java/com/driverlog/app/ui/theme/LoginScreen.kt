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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
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
                            // Guardar FCM token si está disponible
                            val token = CotApplication.getCachedFcmToken(
                                context.applicationContext as Application
                            )
                            if (token != null) {
                                repository.guardarFcmToken(legajo.trim(), token)
                            }
                            onLoginSuccess(legajo.trim())
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
