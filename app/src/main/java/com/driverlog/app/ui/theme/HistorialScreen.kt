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
import com.driverlog.app.data.Jornada
import com.driverlog.app.data.LaudoCalculator
import com.driverlog.app.data.ViajeRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HistorialScreen(
    legajo: String,
    repository: ViajeRepository
) {
    val jornadas by repository.getTodasLasJornadas().collectAsState(initial = emptyList())
    var totalesHoy by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }

    LaunchedEffect(Unit) {
        totalesHoy = repository.calcularTotalesHoy()
    }

    val hoy = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    val jornadasPasadas = remember(jornadas) { jornadas.filter { it.fecha != hoy } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Historial", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            HorizontalDivider()
        }

        // ── Resumen del día actual ──
        item {
            Text(
                "Hoy",
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = Color.Gray,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0D1B2A))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        "Resumen jornada",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color.White
                    )
                    Spacer(Modifier.height(8.dp))
                    val t = totalesHoy
                    if (t != null) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            ResumenColumna("Km viajes", "%.1f".format(t.kmViajes))
                            ResumenColumna("Guardias", "%.1f".format(t.kmGuardias))
                            ResumenColumna("Tome/Cese", "%.1f".format(t.kmTomeCese))
                            ResumenColumna("Viáticos", "${t.viaticos}")
                        }
                        Spacer(Modifier.height(10.dp))
                        HorizontalDivider(color = Color.DarkGray)
                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Total: %.1f km".format(t.kmTotal),
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                "$ %.2f".format(t.monto),
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color(0xFF4CAF50)
                            )
                        }
                    } else {
                        Text("Sin movimientos hoy", color = Color.Gray, fontSize = 13.sp)
                    }
                }
            }
        }

        // ── Jornadas pasadas ──
        if (jornadasPasadas.isNotEmpty()) {
            item {
                Text(
                    "Jornadas anteriores",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp)
                )
            }

            items(jornadasPasadas) { jornada ->
                JornadaCard(jornada = jornada)
            }
        } else if (jornadasPasadas.isEmpty() && jornadas.isNotEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Solo hay jornada de hoy", color = Color.Gray, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun JornadaCard(jornada: Jornada) {
    val cerrada = jornada.status == "cerrada"
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (cerrada) MaterialTheme.colorScheme.surfaceVariant
            else MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    jornada.fecha,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text(
                    jornada.orderNumber,
                    fontSize = 11.sp,
                    color = Color.Gray
                )
            }
            Surface(
                shape = MaterialTheme.shapes.small,
                color = (if (cerrada) Color.Gray else Color(0xFF4CAF50)).copy(alpha = 0.2f)
            ) {
                Text(
                    if (cerrada) "Cerrada" else "Activa",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    fontSize = 11.sp,
                    color = if (cerrada) Color.Gray else Color(0xFF4CAF50)
                )
            }
        }
    }
}

@Composable
private fun ResumenColumna(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 10.sp, color = Color.Gray)
        Text(value, fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.Bold)
    }
}
