package com.driverlog.app.ui.theme

import android.content.Intent
import android.os.Environment
import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.driverlog.app.data.Guardia
import com.driverlog.app.data.Jornada
import com.driverlog.app.data.JornadaCompleta
import com.driverlog.app.data.LaudoCalculator
import com.driverlog.app.data.PdfGenerator
import com.driverlog.app.data.Viaje
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
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
                JornadaCard(jornada = jornada, repository = repository)
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
private fun JornadaCard(jornada: Jornada, repository: ViajeRepository) {
    val cerrada = jornada.status == "cerrada"
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var expanded     by remember { mutableStateOf(false) }
    var loaded       by remember { mutableStateOf(false) }
    var viajes       by remember { mutableStateOf<List<Viaje>>(emptyList()) }
    var guardias     by remember { mutableStateOf<List<Guardia>>(emptyList()) }
    var totales      by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }
    var generandoPdf by remember { mutableStateOf(false) }

    LaunchedEffect(expanded) {
        if (expanded && !loaded) {
            viajes   = repository.getViajesDeLaJornada(jornada.orderNumber)
            guardias = repository.getGuardiasDeLaJornada(jornada.orderNumber)
            totales  = repository.calcularTotalesJornada(jornada.orderNumber)
            loaded   = true
        }
    }

    Card(
        onClick = { expanded = !expanded },
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (cerrada) MaterialTheme.colorScheme.surfaceVariant
                             else MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column {
            // ── Encabezado ──────────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(jornada.fecha, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(jornada.orderNumber, fontSize = 11.sp, color = Color.Gray)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
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
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // ── Detalle expandible ───────────────────────────────────────────
            AnimatedVisibility(visible = expanded) {
                Column(
                    modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    // Viajes
                    val viajesValidos = viajes.filter {
                        it.status != "cancelado" && it.origen != "Prueba" && it.destino != "Prueba"
                    }
                    if (viajesValidos.isNotEmpty()) {
                        Text(
                            "Viajes",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = Color.Gray,
                            modifier = Modifier.padding(top = 2.dp, bottom = 4.dp)
                        )
                        viajesValidos.forEach { v ->
                            val km = v.kmEmpresa.takeIf { it > 0 } ?: v.kmAuto
                            Column(modifier = Modifier.padding(bottom = 6.dp)) {
                                // Fila 1: origen → destino / km / badge T/C
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "${v.origen} → ${v.destino}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text("$km km", fontSize = 12.sp, color = Color.Gray)
                                        if (v.tomeCese) {
                                            SmallBadge("T/C", Color(0xFF1976D2))
                                        }
                                    }
                                }
                                // Fila 2: tipoServicio · salida → llegada
                                val llegada = v.arrivalTime.takeIf { it.isNotEmpty() } ?: "—"
                                val salida  = v.departureTime.takeIf { it.isNotEmpty() } ?: "—"
                                val tipo    = v.tipoServicio.takeIf { it.isNotEmpty() } ?: "—"
                                Text(
                                    "$tipo  ·  $salida → $llegada",
                                    fontSize = 11.sp,
                                    color = Color.Gray
                                )
                            }
                        }
                    }

                    // Guardias
                    if (guardias.isNotEmpty()) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "Guardias",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = Color.Gray,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        guardias.forEach { g ->
                            val tipo  = if (g.type == "especial") "Especial" else "Común"
                            val rango = "${g.inicio}–${g.fin.ifEmpty { "?" }}"
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "$tipo · $rango",
                                    fontSize = 12.sp,
                                    modifier = Modifier.weight(1f)
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text("%.1f h".format(g.hours), fontSize = 12.sp, color = Color.Gray)
                                    if (g.viatico) {
                                        SmallBadge("Viático", Color(0xFF388E3C))
                                    }
                                }
                            }
                        }
                    }

                    // Totales
                    totales?.let { t ->
                        Spacer(Modifier.height(6.dp))
                        HorizontalDivider()
                        Spacer(Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Total: %.1f km".format(t.kmTotal),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                "$ %.2f".format(t.monto),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = Color(0xFF4CAF50)
                            )
                        }
                    }

                    // ── Botón Ver PDF (solo jornada cerrada) ─────────────────
                    if (cerrada) {
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    generandoPdf = true
                                    try {
                                        val pdfFile = File(
                                            context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),
                                            "jornada_${jornada.orderNumber}.pdf"
                                        )
                                        val target = if (pdfFile.exists()) {
                                            pdfFile
                                        } else {
                                            val jornadaCompleta = JornadaCompleta(
                                                orderNumber = jornada.orderNumber,
                                                fecha       = jornada.fecha,
                                                legajo      = jornada.legajo,
                                                travels     = viajes,
                                                guards      = guardias,
                                                closed      = true,
                                                closedAt    = jornada.closedAt
                                            )
                                            withContext(Dispatchers.IO) {
                                                PdfGenerator.generarPdf(context, jornadaCompleta)
                                            }
                                        }
                                        abrirPdf(context, target)
                                    } catch (e: Exception) {
                                        Log.e("COT", "Error PDF historial: ${e.message}")
                                    } finally {
                                        generandoPdf = false
                                    }
                                }
                            },
                            enabled = !generandoPdf,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (generandoPdf) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(14.dp),
                                    strokeWidth = 2.dp
                                )
                                Spacer(Modifier.width(8.dp))
                                Text("Generando...", fontSize = 13.sp)
                            } else {
                                Text("Ver PDF", fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun abrirPdf(context: android.content.Context, file: File) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/pdf")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Abrir planilla"))
}

@Composable
private fun SmallBadge(text: String, color: Color) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.15f)
    ) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp),
            fontSize = 10.sp,
            color = color,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun ResumenColumna(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 10.sp, color = Color.Gray)
        Text(value, fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.Bold)
    }
}
