package com.driverlog.app.ui

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
import java.time.YearMonth
import java.util.Date
import java.util.Locale

private val MESES_NOMBRES = arrayOf(
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
)

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
    val jornadasPasadas = remember(jornadas) {
        jornadas.filter { it.fecha != hoy || it.status == "cerrada" || it.status == "finalizada" }
    }

    var mesFiltro by remember { mutableStateOf(YearMonth.now()) }

    val jornadasFiltradas = remember(jornadasPasadas, mesFiltro) {
        jornadasPasadas.filter { j ->
            try {
                val parts = j.fecha.split("-")
                parts[0].toInt() == mesFiltro.year && parts[1].toInt() == mesFiltro.monthValue
            } catch (e: Exception) { false }
        }
    }

    var totalesPeriodo by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }
    val totalesPorJornada = remember { mutableStateMapOf<String, LaudoCalculator.Totales>() }

    LaunchedEffect(mesFiltro, jornadasPasadas.size) {
        totalesPorJornada.clear()
        if (jornadasFiltradas.isEmpty()) {
            totalesPeriodo = null
            return@LaunchedEffect
        }
        var kmViajes = 0.0; var kmAcoplados = 0.0; var kmGuardias = 0.0
        var kmTomeCese = 0.0; var kmTotal = 0.0; var monto = 0.0; var viaticos = 0
        for (j in jornadasFiltradas) {
            val t = if (j.status == "cerrada" || j.status == "finalizada") {
                repository.obtenerTotalesSnapshot(j.orderNumber)
                    ?: repository.calcularTotalesJornada(j.orderNumber)
            } else {
                repository.calcularTotalesJornada(j.orderNumber)
            }
            if (t != null) {
                totalesPorJornada[j.orderNumber] = t
                kmViajes += t.kmViajes; kmAcoplados += t.kmAcoplados
                kmGuardias += t.kmGuardias; kmTomeCese += t.kmTomeCese
                kmTotal += t.kmTotal; monto += t.monto; viaticos += t.viaticos
            }
        }
        totalesPeriodo = LaudoCalculator.Totales(
            kmViajes, kmAcoplados, kmGuardias, kmTomeCese, kmTotal, monto, viaticos
        )
    }

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

        // ── Filtro por mes ───────────────────────────────────────────────────
        item {
            val mesLabel = "${MESES_NOMBRES[mesFiltro.monthValue - 1]} ${mesFiltro.year}"
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 8.dp, top = 16.dp, bottom = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Jornadas anteriores",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = Color.Gray
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = { mesFiltro = mesFiltro.minusMonths(1) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("◀", fontSize = 14.sp)
                    }
                    Text(
                        mesLabel,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                    IconButton(
                        onClick = { mesFiltro = mesFiltro.plusMonths(1) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("▶", fontSize = 14.sp)
                    }
                }
            }
        }

        // ── Resumen del período ──────────────────────────────────────────────
        item {
            val tp = totalesPeriodo
            val hayDatos = tp != null && jornadasFiltradas.isNotEmpty()
            var expandidoPeriodo by remember(mesFiltro) { mutableStateOf(false) }
            Card(
                onClick = { if (hayDatos) expandidoPeriodo = !expandidoPeriodo },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    // ── Encabezado siempre visible ───────────────────────────
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Resumen del período",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        if (hayDatos) {
                            Icon(
                                imageVector = if (expandidoPeriodo) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    if (hayDatos && tp != null) {
                        Spacer(Modifier.height(8.dp))
                        // ── Resumen colapsado ────────────────────────────────
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            ResumenColumnaOscura("Jornadas", "${jornadasFiltradas.size}")
                            ResumenColumnaOscura("Km", "%.1f".format(tp.kmTotal))
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Monto", fontSize = 10.sp, color = Color.Gray)
                                Text(
                                    "$ %.2f".format(tp.monto),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF4CAF50)
                                )
                            }
                        }
                        // ── Desglose expandido ───────────────────────────────
                        AnimatedVisibility(visible = expandidoPeriodo) {
                            Column {
                                Spacer(Modifier.height(12.dp))
                                HorizontalDivider()
                                Spacer(Modifier.height(10.dp))
                                DesgloseFila("Km viajes", "%.1f km".format(tp.kmViajes))
                                DesgloseFila("Km guardias", "%.1f km".format(tp.kmGuardias))
                                DesgloseFila("Tome/Cese", "%.1f km".format(tp.kmTomeCese))
                                DesgloseFila("Acoplados", "%.1f km".format(tp.kmAcoplados))
                                Spacer(Modifier.height(8.dp))
                                HorizontalDivider()
                                Spacer(Modifier.height(8.dp))
                                val montoViaticos = tp.viaticos * 455.26
                                val montoKm = tp.monto - montoViaticos
                                val laudoKm = if (tp.kmTotal > 0.0) montoKm / tp.kmTotal else 0.0
                                DesgloseFila(
                                    "Km total",
                                    "%.1f km × $%.4f = $%.2f".format(tp.kmTotal, laudoKm, montoKm)
                                )
                                if (tp.viaticos > 0) {
                                    DesgloseFila(
                                        "Viáticos",
                                        "${tp.viaticos} × $%.2f = $%.2f".format(455.26, montoViaticos)
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                HorizontalDivider(thickness = 2.dp)
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "MONTO TOTAL",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        "$ %.2f".format(tp.monto),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        color = Color(0xFF4CAF50)
                                    )
                                }
                            }
                        }
                    } else {
                        Spacer(Modifier.height(8.dp))
                        Text("Sin jornadas en este período", color = Color.Gray, fontSize = 13.sp)
                    }
                }
            }
        }

        if (jornadasFiltradas.isNotEmpty()) {
            items(jornadasFiltradas) { jornada ->
                JornadaCard(
                    jornada = jornada,
                    repository = repository,
                    totalPrecalculado = totalesPorJornada[jornada.orderNumber]
                )
            }
        }
    }
}

@Composable
private fun JornadaCard(
    jornada: Jornada,
    repository: ViajeRepository,
    totalPrecalculado: LaudoCalculator.Totales? = null
) {
    val cerrada = jornada.status == "cerrada" || jornada.status == "finalizada"
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var expanded       by remember { mutableStateOf(false) }
    var detailLoaded   by remember { mutableStateOf(false) }
    var viajes         by remember { mutableStateOf<List<Viaje>>(emptyList()) }
    var guardias       by remember { mutableStateOf<List<Guardia>>(emptyList()) }
    var totales        by remember { mutableStateOf<LaudoCalculator.Totales?>(null) }
    var generandoPdf   by remember { mutableStateOf(false) }

    // Cargar totales al crear la card — aparecen en el encabezado sin expandir
    LaunchedEffect(jornada.orderNumber, totalPrecalculado) {
        if (totalPrecalculado != null) {
            totales = totalPrecalculado
            return@LaunchedEffect
        }
        totales = if (cerrada) {
            repository.obtenerTotalesSnapshot(jornada.orderNumber)
                ?: repository.calcularTotalesJornada(jornada.orderNumber)
        } else {
            repository.calcularTotalesJornada(jornada.orderNumber)
        }
    }

    // Cargar viajes y guardias solo al expandir
    LaunchedEffect(expanded) {
        if (expanded && !detailLoaded) {
            viajes       = repository.getViajesDeLaJornada(jornada.orderNumber)
            guardias     = repository.getGuardiasDeLaJornada(jornada.orderNumber)
            detailLoaded = true
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
                    val t = totales
                    if (cerrada && t != null && t.kmTotal > 0.0) {
                        Text(
                            "%.1f km · $ %.2f".format(t.kmTotal, t.monto),
                            fontSize = 11.sp,
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
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
                                    if (g.descripcion?.contains("tome de guardia", ignoreCase = true) == true) {
                                        SmallBadge("Tome de guardia", Color(0xFFF59E0B))
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
                        // Desglose km (solo cuando hay valores parciales)
                        if (t.kmViajes > 0.0 || t.kmGuardias > 0.0 || t.kmTomeCese > 0.0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                ResumenColumnaOscura("Viajes", "%.1f".format(t.kmViajes))
                                ResumenColumnaOscura("Guardias", "%.1f".format(t.kmGuardias))
                                ResumenColumnaOscura("T/C", "%.1f".format(t.kmTomeCese))
                                ResumenColumnaOscura("Acoplados", "%.1f".format(t.kmAcoplados))
                            }
                            Spacer(Modifier.height(6.dp))
                        }
                        // Viáticos
                        if (t.viaticos > 0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Viáticos", fontSize = 12.sp, color = Color.Gray)
                                SmallBadge("${t.viaticos}", Color(0xFF388E3C))
                            }
                            Spacer(Modifier.height(4.dp))
                        }
                        // Total km y monto
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
private fun DesgloseFila(label: String, valor: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 12.sp, color = Color.Gray)
        Text(valor, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
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

@Composable
private fun ResumenColumnaOscura(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 10.sp, color = Color.Gray)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
