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
                        } else null
                    )
                }
            }
        }
    }
}

@Composable
private fun GuardiaListCard(guardia: Guardia, onFinalizar: (() -> Unit)?) {
    val enCurso = guardia.status == "en_curso"
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
            if (onFinalizar != null) {
                Spacer(Modifier.height(8.dp))
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
