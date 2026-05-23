package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material3.MenuAnchorType
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSetupScreen(
    legajo: String,
    repository: ViajeRepository,
    onPerfilGuardado: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var nombre by remember { mutableStateOf("") }
    var base by remember { mutableStateOf("Montevideo") }
    var tipo by remember { mutableStateOf("efectivo") }
    var guardando by remember { mutableStateOf(false) }
    var expandedBase by remember { mutableStateOf(false) }

    val bases = listOf(
        "Montevideo", "Colonia", "Maldonado", "Punta del Este",
        "Piriápolis", "Rocha", "Chuy", "La Paloma", "La Pedrera", "Aguas Dulces"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Configurá tu perfil", fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("Legajo $legajo", fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = nombre,
            onValueChange = { nombre = it },
            label = { Text("Nombre completo") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(Modifier.height(16.dp))

        ExposedDropdownMenuBox(
            expanded = expandedBase,
            onExpandedChange = { expandedBase = it }
        ) {
            OutlinedTextField(
                value = base,
                onValueChange = {},
                readOnly = true,
                label = { Text("Base") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedBase) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryEditable, true)
            )
            ExposedDropdownMenu(
                expanded = expandedBase,
                onDismissRequest = { expandedBase = false }
            ) {
                bases.forEach { b ->
                    DropdownMenuItem(
                        text = { Text(b) },
                        onClick = { base = b; expandedBase = false }
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        Text("Tipo de contrato", fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf("efectivo" to "Efectivo", "contratado" to "Contratado").forEach { (value, label) ->
                FilterChip(
                    selected = tipo == value,
                    onClick = { tipo = value },
                    label = { Text(label) }
                )
            }
        }

        Spacer(Modifier.height(40.dp))

        Button(
            onClick = {
                if (nombre.isNotBlank()) {
                    scope.launch {
                        guardando = true
                        repository.guardarPerfil(nombre.trim(), base, tipo)
                        repository.sincronizarPerfil(legajo)
                        guardando = false
                        onPerfilGuardado()
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            enabled = nombre.isNotBlank() && !guardando
        ) {
            if (guardando) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
            } else {
                Text("Guardar y continuar", fontSize = 16.sp)
            }
        }
    }
}
