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
import com.driverlog.app.data.Guardia
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.launch

@Composable
fun GuardiasScreen(
    legajo: String,
    repository: ViajeRepository
) {
    val scope = rememberCoroutineScope()
    val guardias by repository.getTodasLasGuardias().collectAsState(initial = emptyList())
    var guardiaEnCurso by remember { mutableStateOf<Guardia?>(null) }

    LaunchedEffect(legajo) {
        guardiaEnCurso = repository.getGuardiaEnCurso()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Guardias", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text("${guardias.size} registros", fontSize = 13.sp, color = Color.Gray)
        }
        HorizontalDivider()

        if (guardias.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No hay guardias registradas", color = Color.Gray)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(guardias) { guardia ->
                    GuardiaListCard(
                        guardia = guardia,
                        onFinalizar = if (guardia.status == "en_curso") {
                            {
                                scope.launch {
                                    repository.finalizarGuardia(guardia.id)
                                    guardiaEnCurso = repository.getGuardiaEnCurso()
                                }
                            }
                        } else null,
                        onCambiarTipo = { descripcion ->
                            scope.launch {
                                repository.cambiarTipoGuardia(guardia, descripcion)
                                guardiaEnCurso = repository.getGuardiaEnCurso()
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun GuardiaListCard(
    guardia: Guardia,
    onFinalizar: (() -> Unit)?,
    onCambiarTipo: (descripcion: String?) -> Unit
) {
    val enCurso = guardia.status == "en_curso"
    var mostrarDialogo by remember { mutableStateOf(false) }
    var descripcionInput by remember { mutableStateOf("") }

    if (mostrarDialogo) {
        AlertDialog(
            onDismissRequest = {
                mostrarDialogo = false
                descripcionInput = ""
            },
            title = { Text("Cambiar a guardia especial") },
            text = {
                Column {
                    Text("La guardia especial requiere una descripción del contrato.", fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = descripcionInput,
                        onValueChange = { descripcionInput = it },
                        label = { Text("Descripción") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onCambiarTipo(descripcionInput.trim())
                        mostrarDialogo = false
                        descripcionInput = ""
                    },
                    enabled = descripcionInput.isNotBlank()
                ) { Text("Confirmar") }
            },
            dismissButton = {
                TextButton(onClick = {
                    mostrarDialogo = false
                    descripcionInput = ""
                }) { Text("Cancelar") }
            }
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (enCurso) Color(0xFF1A237E) else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        guardia.dia,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = if (enCurso) Color.White else Color.Unspecified
                    )
                    Text(
                        "Inicio: ${guardia.inicio}" + if (guardia.fin.isNotEmpty()) "  ·  Fin: ${guardia.fin}" else "",
                        fontSize = 12.sp,
                        color = if (enCurso) Color(0xFFBBBBBB) else Color.Gray
                    )
                    Text(
                        "Tipo: ${guardia.type.replaceFirstChar { it.uppercase() }}" +
                                if (guardia.hours > 0) "  ·  %.1fh".format(guardia.hours) else "",
                        fontSize = 12.sp,
                        color = if (enCurso) Color(0xFFBBBBBB) else Color.Gray
                    )
                    if (enCurso && guardia.descripcion != null) {
                        Text(
                            guardia.descripcion,
                            fontSize = 12.sp,
                            color = Color(0xFFBBBBBB)
                        )
                    }
                }
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = (if (enCurso) Color(0xFF64B5F6) else Color.Gray).copy(alpha = 0.2f)
                ) {
                    Text(
                        if (enCurso) "En curso" else "Finalizada",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontSize = 11.sp,
                        color = if (enCurso) Color(0xFF64B5F6) else Color.Gray
                    )
                }
            }
            if (enCurso) {
                val nuevoTipo = if (guardia.type == "comun") "especial" else "comun"
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        if (nuevoTipo == "especial") mostrarDialogo = true
                        else onCambiarTipo(null)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF64B5F6))
                ) {
                    Text("Cambiar a ${if (nuevoTipo == "especial") "Especial" else "Común"}")
                }
                if (onFinalizar != null) {
                    Spacer(Modifier.height(4.dp))
                    Button(
                        onClick = onFinalizar,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF5350))
                    ) {
                        Text("Finalizar guardia")
                    }
                }
            }
        }
    }
}
