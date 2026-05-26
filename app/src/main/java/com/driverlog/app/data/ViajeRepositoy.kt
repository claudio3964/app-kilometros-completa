package com.driverlog.app.data

import android.content.Context
import androidx.work.*
import com.driverlog.app.worker.ActivarViajeWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit
import android.util.Log
import android.content.Intent
import java.util.Calendar

class ViajeRepository(private val context: Context) {

    private val db = CotDatabase.getInstance(context)
    private val dao = db.viajeDao()
    private val guardiaDao = db.guardiaDao()
    private val jornadaDao = db.jornadaDao()
    private val travelStatDao = db.travelStatDao()
    private val supabase = SupabaseService(context)

    fun getTodosLosViajes(): Flow<List<Viaje>> = dao.getTodosLosViajes()
    fun getViajesProgramados(): Flow<List<Viaje>> = dao.getViajesProgramados()
    fun getTodasLasJornadas(): Flow<List<Jornada>> = jornadaDao.getTodasLasJornadas()

    suspend fun getViajeEnCurso(): Viaje? = dao.getViajeEnCurso()

    suspend fun sincronizarDesdeSupabase(legajo: String) {
        val viajes = supabase.sincronizarJornada(legajo)
        if (viajes.isNotEmpty()) {
            dao.insertarViajes(viajes)
            val ahora = System.currentTimeMillis()
            viajes.forEach { viaje ->
                if (viaje.status == "programado" && viaje.inicioProgramado > ahora) {
                    programarActivacion(viaje)
                    val minutosParaViaje = (viaje.inicioProgramado - ahora) / 60000
                    if (minutosParaViaje <= 15) {
                        val guardiaActiva = guardiaDao.getGuardiaEnCurso()
                        if (guardiaActiva != null) {
                            Log.d("COT", "Cortando guardia automáticamente - viaje en $minutosParaViaje min")
                            finalizarGuardia(guardiaActiva.id)
                            val intent = android.content.Intent("com.driverlog.GUARDIA_CORTADA").apply {
                                putExtra("motivo", "Viaje programado en $minutosParaViaje minutos")
                            }
                            context.sendBroadcast(intent)
                        }
                    } else {
                        val demoraCorte = viaje.inicioProgramado - (15 * 60 * 1000L) - ahora
                        if (demoraCorte > 0) {
                            val inputData = workDataOf(
                                "viajeId" to viaje.id,
                                "legajo" to legajo
                            )
                            val workRequest = OneTimeWorkRequestBuilder<com.driverlog.app.worker.CortarGuardiaWorker>()
                                .setInitialDelay(demoraCorte, TimeUnit.MILLISECONDS)
                                .setInputData(inputData)
                                .addTag("cortar_guardia_${viaje.id}")
                                .build()
                            WorkManager.getInstance(context)
                                .enqueueUniqueWork(
                                    "cortar_guardia_${viaje.id}",
                                    ExistingWorkPolicy.REPLACE,
                                    workRequest
                                )
                            Log.d("COT", "Corte de guardia programado para ${demoraCorte / 60000} min")
                        }
                    }
                }
            }
        }

        // Sincronizar jornada activa de Supabase → Room si no existe localmente.
        // Se ejecuta siempre, independiente de si llegaron viajes, para que
        // getJornadaActiva() funcione aunque Room esté vacío.
        Log.d("COT", "Llamando obtenerJornadaActiva")
        val jornadaRemota = supabase.obtenerJornadaActiva(legajo)
        Log.d("COT", "Jornada remota: ${jornadaRemota?.orderNumber ?: "null"}")
        if (jornadaRemota != null) {
            jornadaDao.insertarJornada(jornadaRemota)
            Log.d("COT", "Jornada sincronizada desde Supabase: ${jornadaRemota.orderNumber}")
        }
    }

    suspend fun activarViaje(viaje: Viaje) {
        val ahora = System.currentTimeMillis()
        val inicioReal = if (ahora - viaje.inicioProgramado < 2 * 60 * 60 * 1000) {
            viaje.inicioProgramado
        } else {
            ahora
        }
        dao.activarViaje(viaje.id, "en_curso", inicioReal)
        supabase.activarViajeEnSupabase(viaje.id, inicioReal)
    }

    suspend fun finalizarViaje(viajeId: String) {
        val ahora = System.currentTimeMillis()
        val viaje = dao.getViajeById(viajeId)
        dao.finalizarViaje(viajeId, "finalizado", ahora)
        supabase.finalizarViajeEnSupabase(viajeId, ahora)
        if (viaje?.inicioReal != null && viaje.inicioReal > 0) {
            val duracion = (ahora - viaje.inicioReal) / 60000
            if (duracion > 0) registrarDuracion("${viaje.origen}→${viaje.destino}", duracion)
        }
    }

    suspend fun cancelarViaje(viajeId: String) {
        dao.cancelarViaje(viajeId)
        supabase.cancelarViajeEnSupabase(viajeId)
    }

    suspend fun crearViaje(
        legajo: String,
        origen: String,
        destino: String,
        km: Int,
        tipoServicio: String,
        coche: String,
        horaSalida: String,
        horaLlegada: String,
        inicioProgramadoMs: Long
    ): Viaje {
        val jornada = getOCrearJornada(legajo)
        val ahora = System.currentTimeMillis()
        val status = if (inicioProgramadoMs <= ahora) "en_curso" else "programado"
        val viaje = Viaje(
            id = "VJL-${ahora}-${origen.take(3).uppercase()}",
            orderNumber = jornada.orderNumber,
            origen = origen,
            destino = destino,
            departureTime = horaSalida,
            arrivalTime = horaLlegada,
            status = status,
            inicioProgramado = inicioProgramadoMs,
            inicioReal = if (status == "en_curso") inicioProgramadoMs else null,
            kmEmpresa = km,
            tipoServicio = tipoServicio,
            coche = coche,
            syncStatus = "local"
        )
        dao.insertarViaje(viaje)
        if (status == "programado") programarActivacion(viaje)
        try {
            supabase.agregarViajeAJornada(jornada.orderNumber, viaje)
        } catch (e: Exception) {
            Log.e("COT", "Error sync nuevo viaje: ${e.message}")
        }
        return viaje
    }

    private suspend fun registrarDuracion(ruta: String, duracionMinutos: Long) {
        val stat = travelStatDao.getStat(ruta)
        val nuevo = if (stat == null) {
            TravelStat(ruta = ruta, totalViajes = 1, totalMinutos = duracionMinutos)
        } else {
            stat.copy(
                totalViajes = stat.totalViajes + 1,
                totalMinutos = stat.totalMinutos + duracionMinutos
            )
        }
        travelStatDao.insertarStat(nuevo)
    }

    suspend fun getDuracionPromedio(ruta: String): Long? {
        val stat = travelStatDao.getStat(ruta) ?: return null
        if (stat.totalViajes == 0) return null
        return stat.totalMinutos / stat.totalViajes
    }

    private fun programarActivacion(viaje: Viaje) {
        val demora = (viaje.inicioProgramado - System.currentTimeMillis()).coerceAtLeast(0L)
        val inputData = workDataOf(
            "viajeId" to viaje.id,
            "inicioProgramado" to viaje.inicioProgramado,
            "origen" to viaje.origen,
            "destino" to viaje.destino
        )
        val workRequest = OneTimeWorkRequestBuilder<ActivarViajeWorker>()
            .setInitialDelay(demora, TimeUnit.MILLISECONDS)
            .setInputData(inputData)
            .addTag("viaje_${viaje.id}")
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                "activar_viaje_${viaje.id}",
                ExistingWorkPolicy.REPLACE,
                workRequest
            )
    }

    suspend fun guardarFcmToken(legajo: String, token: String) {
        supabase.guardarFcmToken(legajo, token)
        val prefs = context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
    }

    fun getLegajo(): String =
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .getString("legajo", "") ?: ""

    fun guardarLegajo(legajo: String) {
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putString("legajo", legajo).apply()
    }

    fun getTodasLasGuardias() = guardiaDao.getTodasLasGuardias()
    suspend fun getGuardiaEnCurso(): Guardia? = guardiaDao.getGuardiaEnCurso()

    suspend fun iniciarGuardia(
        orderNumber: String,
        type: String = "comun",
        inicio: String? = null,
        dia: String? = null,
        descripcion: String? = null
    ): Guardia {
        val ahora = System.currentTimeMillis()
        val cal = java.util.Calendar.getInstance()
        val horaFinal = inicio ?: String.format(
            "%02d:%02d",
            cal.get(java.util.Calendar.HOUR_OF_DAY),
            cal.get(java.util.Calendar.MINUTE)
        )
        val diaFinal = dia ?: "${cal.get(java.util.Calendar.DAY_OF_MONTH).toString().padStart(2, '0')}/${(cal.get(java.util.Calendar.MONTH) + 1).toString().padStart(2, '0')}/${cal.get(java.util.Calendar.YEAR)}"
        val guardia = Guardia(
            id = "GRD-$ahora",
            dia = diaFinal,
            inicio = horaFinal,
            type = type,
            status = "en_curso",
            createdAt = ahora,
            orderNumber = orderNumber,
            descripcion = descripcion
        )
        guardiaDao.insertarGuardia(guardia)
        try {
            supabase.agregarGuardiaAJornada(orderNumber, guardia)
        } catch (e: Exception) {
            Log.e("COT", "Error sync guardia: ${e.message}")
        }
        // Timer 8h
        val demora = 8 * 60 * 60 * 1000L
        val inputData = workDataOf("guardiaId" to guardia.id, "inicio" to guardia.inicio)
        val workRequest = OneTimeWorkRequestBuilder<com.driverlog.app.worker.GuardiaTimerWorker>()
            .setInitialDelay(demora, TimeUnit.MILLISECONDS)
            .setInputData(inputData)
            .addTag("guardia_timer_${guardia.id}")
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("guardia_timer_${guardia.id}", ExistingWorkPolicy.REPLACE, workRequest)
        return guardia
    }

    suspend fun finalizarGuardia(guardiaId: String) {
        val guardia = guardiaDao.getGuardiaEnCurso() ?: return
        val ahora = System.currentTimeMillis()
        val cal = java.util.Calendar.getInstance()
        val fin = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
        val hours = (ahora - guardia.createdAt) / 3600000.0
        val kmGuardia = hours * if (guardia.type == "especial") 40.0 else 30.0
        guardiaDao.finalizarGuardia(guardiaId, "finalizada", fin, hours, kmGuardia)
        try {
            supabase.finalizarGuardiaEnSupabase(guardiaId, guardia.orderNumber, fin, hours, kmGuardia)
        } catch (e: Exception) {
            Log.e("COT", "Error finalizar guardia Supabase: ${e.message}")
        }
    }

    suspend fun getOCrearJornada(legajo: String): Jornada {
        val cal = java.util.Calendar.getInstance()
        val hora = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
        val fecha = "${cal.get(java.util.Calendar.YEAR)}-${(cal.get(java.util.Calendar.MONTH) + 1).toString().padStart(2, '0')}-${cal.get(java.util.Calendar.DAY_OF_MONTH).toString().padStart(2, '0')}"
        val existente = jornadaDao.getJornadaPorFecha(fecha, legajo)
        if (existente != null) return existente
        val orderNumber = "$legajo-${fecha.replace("-", "")}"
        val jornada = Jornada(
            orderNumber = orderNumber,
            legajo = legajo,
            fecha = fecha,
            horaInicio = hora,
            status = "activa",
            syncStatus = "pending"
        )
        jornadaDao.insertarJornada(jornada)
        Log.d("COT", "Intentando crear jornada en Supabase: $orderNumber")
        try {
            val ok = supabase.crearJornadaEnSupabase(jornada)
            Log.d("COT", "Resultado crear jornada: $ok")
            if (ok) jornadaDao.marcarSynced(orderNumber)
        } catch (e: Exception) {
            Log.e("COT", "Error crear jornada Supabase: ${e.message}")
        }
        return jornada
    }

    suspend fun getJornadaActiva(): Jornada? = jornadaDao.getJornadaActiva()

    // ── Device ID ──
    fun getCurrentDeviceId(): String =
        android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: ""

    fun getSavedDeviceId(): String =
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .getString("device_id", "") ?: ""

    fun saveDeviceId(deviceId: String) {
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putString("device_id", deviceId).apply()
    }

    suspend fun verificarDispositivo(legajo: String): DeviceCheckResult {
        val deviceId = getCurrentDeviceId()
        val result = supabase.verificarDispositivo(legajo, deviceId)
        when (result) {
            is DeviceCheckResult.Permitido,
            is DeviceCheckResult.RegistrarYPermitir -> {
                if (result is DeviceCheckResult.RegistrarYPermitir) {
                    supabase.registrarDeviceId(legajo, deviceId)
                }
                saveDeviceId(deviceId)
            }
            else -> { /* no guardar */ }
        }
        return result
    }

    fun getNombre(): String =
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .getString("nombre", "") ?: ""

    fun getBase(): String =
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .getString("base", "") ?: ""

    fun getTipo(): String =
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .getString("tipo", "efectivo") ?: "efectivo"

    fun perfilCompleto(): Boolean = getNombre().isNotEmpty() && getBase().isNotEmpty()

    fun guardarPerfil(nombre: String, base: String, tipo: String) {
        context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
            .edit()
            .putString("nombre", nombre)
            .putString("base", base)
            .putString("tipo", tipo)
            .apply()
    }

    suspend fun sincronizarPerfil(legajo: String) {
        try {
            supabase.sincronizarPerfil(legajo, getNombre(), getBase(), getTipo())
        } catch (e: Exception) {
            Log.e("COT", "Error sync perfil: ${e.message}")
        }
    }

    suspend fun calcularTotalesJornada(orderNumber: String): LaudoCalculator.Totales {
        val viajes = dao.getViajesPorJornada(orderNumber)
        val guardias = guardiaDao.getGuardiasPorJornada(orderNumber)
        val jornada = jornadaDao.getJornada(orderNumber)
        val jornadaCompleta = JornadaCompleta(
            orderNumber = orderNumber,
            fecha = jornada?.fecha ?: "",
            travels = viajes,
            guards = guardias
        )
        return LaudoCalculator.calcular(jornadaCompleta)
    }

    suspend fun getUltimoViajeFinalizado(): Viaje? {
        return dao.getViajesFinalizado().lastOrNull()
    }

    suspend fun getViajesDeLaJornada(orderNumber: String): List<Viaje> =
        dao.getViajesPorJornada(orderNumber)

    suspend fun getGuardiasDeLaJornada(orderNumber: String): List<Guardia> =
        guardiaDao.getGuardiasPorJornada(orderNumber)

suspend fun cerrarJornada(legajo: String): File? {
    val jornada = jornadaDao.getJornadaActiva() ?: return null

    val viajeEnCurso = dao.getViajeEnCurso()
    if (viajeEnCurso != null) return null

    val guardiaEnCurso = guardiaDao.getGuardiaEnCurso()
    if (guardiaEnCurso != null) finalizarGuardia(guardiaEnCurso.id)

    val totales = calcularTotalesJornada(jornada.orderNumber)
    val ahora = System.currentTimeMillis()
    jornadaDao.cerrarJornada(jornada.orderNumber, ahora)

    try {
        supabase.cerrarJornadaEnSupabase(jornada.orderNumber, totales, ahora)
    } catch (e: Exception) {
        Log.e("COT", "Error cerrar jornada Supabase: ${e.message}")
    }

    return try {
        val viajes = dao.getViajesPorJornada(jornada.orderNumber)
        val guardias = guardiaDao.getGuardiasPorJornada(jornada.orderNumber)
        val jornadaCompleta = JornadaCompleta(
            orderNumber = jornada.orderNumber,
            fecha = jornada.fecha,
            legajo = jornada.legajo,
            travels = viajes,
            guards = guardias,
            closed = true,
            closedAt = ahora,
            totalsSnapshot = TotalsSnapshot(
                kmViajes = totales.kmViajes,
                kmGuardias = totales.kmGuardias,
                kmTomeCese = totales.kmTomeCese,
                kmAcoplados = totales.kmAcoplados,
                kmTotal = totales.kmTotal,
                viaticos = totales.viaticos,
                monto = totales.monto,
                cerradoAt = ahora
            )
        )
        withContext(Dispatchers.IO) {
            PdfGenerator.generarPdf(context, jornadaCompleta)
        }
    } catch (e: Exception) {
        Log.e("COT", "Error generar PDF: ${e.message}")
        null
    }
}

    suspend fun obtenerMensajesPendientes(legajo: String): List<org.json.JSONObject> =
        supabase.obtenerMensajesPendientes(legajo)

    suspend fun marcarMensajeLeido(mensajeId: String) =
        supabase.marcarMensajeLeido(mensajeId)

    suspend fun calcularTotalesHoy(): LaudoCalculator.Totales {
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val inicioHoy = cal.timeInMillis
        val viajes = dao.getViajesDesde(inicioHoy)
        val dia = "${cal.get(java.util.Calendar.DAY_OF_MONTH).toString().padStart(2, '0')}/" +
                "${(cal.get(java.util.Calendar.MONTH) + 1).toString().padStart(2, '0')}/" +
                "${cal.get(java.util.Calendar.YEAR)}"
        val guardias = guardiaDao.getGuardiasPorDia(dia)
        val jornadaCompleta = JornadaCompleta(
            orderNumber = "",
            fecha = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date()),
            travels = viajes,
            guards = guardias
        )
        return LaudoCalculator.calcular(jornadaCompleta)
    }
}
