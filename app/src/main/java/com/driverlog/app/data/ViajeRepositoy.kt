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
                            val guardiaActivaAhora = guardiaDao.getGuardiaEnCurso()
                            val inputData = workDataOf(
                                "viajeId" to viaje.id,
                                "legajo" to legajo,
                                "guardiaId" to (guardiaActivaAhora?.id ?: "")
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

        // Sincronizar las últimas 30 jornadas cerradas para poblar el historial.
        val jornadasCerradas = supabase.obtenerJornadasCerradas(legajo)
        jornadasCerradas.forEach { jornadaDao.insertarJornada(it) }
        if (jornadasCerradas.isNotEmpty()) {
            Log.d("COT", "Jornadas cerradas guardadas en Room: ${jornadasCerradas.size}")
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
        val esContrato = guardia.descripcion
            ?.trimStart()
            ?.startsWith("contrato", ignoreCase = true) ?: false
        val delayMs = when {
            guardia.type == "especial" && esContrato -> 4 * 3600_000L
            guardia.type == "especial"               -> 1 * 3600_000L
            else                                     -> 8 * 3600_000L
        }
        val inputData = workDataOf(
            "guardiaId"   to guardia.id,
            "inicio"      to guardia.inicio,
            "tipoGuardia" to guardia.type,
            "descripcion" to (guardia.descripcion ?: "")
        )
        val workRequest = OneTimeWorkRequestBuilder<com.driverlog.app.worker.GuardiaTimerWorker>()
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .setInputData(inputData)
            .addTag("guardia_timer_${guardia.id}")
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("guardia_timer_${guardia.id}", ExistingWorkPolicy.REPLACE, workRequest)
        return guardia
    }

    suspend fun finalizarGuardia(guardiaId: String) {
        val guardia = guardiaDao.getGuardiaById(guardiaId) ?: return
        if (guardia.status != "en_curso") return
        val ahora = System.currentTimeMillis()
        val cal = java.util.Calendar.getInstance()
        val fin = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
        Log.d("COT", "Finalizando guardia $guardiaId tipo=${guardia.type} createdAt=${guardia.createdAt}")
        val hours = (ahora - guardia.createdAt) / 3600000.0
        val kmGuardia = hours * if (guardia.type == "especial") 40.0 else 30.0
        guardiaDao.finalizarGuardia(guardiaId, "finalizada", fin, hours, kmGuardia)
        try {
            supabase.finalizarGuardiaEnSupabase(guardiaId, guardia.orderNumber, fin, hours, kmGuardia)
        } catch (e: Exception) {
            Log.e("COT", "Error finalizar guardia Supabase: ${e.message}")
        }
    }

    suspend fun cambiarTipoGuardia(guardia: Guardia, descripcion: String? = null) {
        val nuevoTipo = if (guardia.type == "comun") "especial" else "comun"

        // Cancela el timer del tramo que se cierra para evitar que dispare sobre una guardia ya finalizada
        WorkManager.getInstance(context).cancelUniqueWork("guardia_timer_${guardia.id}")

        finalizarGuardia(guardia.id)

        // iniciarGuardia programa internamente un timer de 8h; lo reemplazamos a continuación
        val nuevaGuardia = iniciarGuardia(
            orderNumber = guardia.orderNumber,
            type = nuevoTipo,
            descripcion = descripcion
        )

        // Timer del nuevo tramo: comun hereda el reloj original; especial reinicia con su propio delay
        val ahora = System.currentTimeMillis()
        val esContratoNuevo = nuevaGuardia.descripcion?.trimStart()?.startsWith("contrato", ignoreCase = true) ?: false
        val delayNuevoMs = when {
            nuevoTipo == "comun"                               -> (guardia.createdAt + 8 * 3600_000L) - ahora
            nuevoTipo == "especial" && esContratoNuevo         -> 4 * 3600_000L
            else                                               -> 1 * 3600_000L
        }
        if (delayNuevoMs > 0) {
            val nuevoInputData = workDataOf(
                "guardiaId"   to nuevaGuardia.id,
                "inicio"      to nuevaGuardia.inicio,
                "tipoGuardia" to nuevaGuardia.type,
                "descripcion" to (nuevaGuardia.descripcion ?: "")
            )
            val workRequest = OneTimeWorkRequestBuilder<com.driverlog.app.worker.GuardiaTimerWorker>()
                .setInitialDelay(delayNuevoMs, TimeUnit.MILLISECONDS)
                .setInputData(nuevoInputData)
                .addTag("guardia_timer_${nuevaGuardia.id}")
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("guardia_timer_${nuevaGuardia.id}", ExistingWorkPolicy.REPLACE, workRequest)
        } else {
            WorkManager.getInstance(context).cancelUniqueWork("guardia_timer_${nuevaGuardia.id}")
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

    suspend fun buscarLegajoPorDeviceId(): PerfilChofer? =
        supabase.buscarPerfilPorDeviceId(getCurrentDeviceId())

    suspend fun sincronizarPerfil(legajo: String) {
        try {
            supabase.sincronizarPerfil(legajo, getNombre(), getBase(), getTipo())
        } catch (e: Exception) {
            Log.e("COT", "Error sync perfil: ${e.message}")
        }
    }

    suspend fun calcularTotalesJornada(orderNumber: String): LaudoCalculator.Totales {
        val jornada = jornadaDao.getJornada(orderNumber)

        // 1. Snapshot guardado en Room (de sync o cierre local)
        if (jornada != null && jornada.kmTotal > 0.0) {
            return LaudoCalculator.Totales(kmTotal = jornada.kmTotal, monto = jornada.monto)
        }

        // 2. Calcular desde datos en Room
        val viajes = dao.getViajesPorJornada(orderNumber)
        val guardias = guardiaDao.getGuardiasPorJornada(orderNumber)
        if (viajes.isNotEmpty() || guardias.isNotEmpty()) {
            val jornadaCompleta = JornadaCompleta(
                orderNumber = orderNumber,
                fecha = jornada?.fecha ?: "",
                travels = viajes,
                guards = guardias
            )
            val config = supabase.getConfiguracion()
            val laudoKm = config["precio_km_conductor"] ?: 8.0122
            val montoViatico = config["viatico_comida"] ?: 455.26
            return LaudoCalculator.calcular(jornadaCompleta, laudoKm, montoViatico)
        }

        // 3. Fallback: buscar snapshot en Supabase
        return supabase.obtenerTotalesJornadaSupabase(orderNumber) ?: LaudoCalculator.Totales()
    }

    suspend fun obtenerTotalesSnapshot(orderNumber: String): LaudoCalculator.Totales? {
        Log.d("COT", "obtenerTotalesSnapshot: orderNumber=$orderNumber")
        val resultado = supabase.obtenerTotalesJornadaSupabase(orderNumber)
        Log.d("COT", "obtenerTotalesSnapshot: resultado=$resultado")
        return resultado
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
    jornadaDao.cerrarJornada(jornada.orderNumber, ahora, totales.kmTotal, totales.monto)

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

    // Catálogo de km por ruta. Completar/verificar contra routes_catalog.js
    // (repo claudio3964/app-kilometros-completa branch dev-rebuild-core).
    fun getKmDesdeRuta(origen: String, destino: String): Int {
        val key = "${origen.lowercase().trim()}→${destino.lowercase().trim()}"
        return CATALOGO_KM_RUTAS[key] ?: 0
    }

    suspend fun obtenerMensajesPendientes(legajo: String): List<org.json.JSONObject> =
        supabase.obtenerMensajesPendientes(legajo)

    suspend fun marcarMensajeLeido(mensajeId: String) =
        supabase.marcarMensajeLeido(mensajeId)

    companion object {
        // Verificado contra routes_catalog.js (repo claudio3964/app-kilometros-completa branch dev-rebuild-core)
        // Ignorar campos carteles — se implementan en una fase posterior
        private val CATALOGO_KM_RUTAS = mapOf(
            // Montevideo → destinos
            "montevideo→colonia"                                      to 178,
            "montevideo→punta del este"                               to 140,
            "montevideo→punta del este x piriápolis"                  to 145,
            "montevideo→punta del este x pan de azúcar y san carlos"  to 155,
            "montevideo→punta del este x ruta 8 y 9"                  to 165,
            "montevideo→piriápolis"                                    to 97,
            "montevideo→punta negra"                                   to 112,
            "montevideo→laguna garzón"                                 to 183,
            "montevideo→la paloma"                                     to 220,
            "montevideo→la pedrera"                                    to 250,
            "montevideo→rocha"                                         to 220,
            "montevideo→aguas dulces"                                  to 290,
            "montevideo→chuy"                                          to 345,
            // Regresos a Montevideo
            "colonia→montevideo"                                       to 178,
            "punta del este→montevideo"                                to 140,
            "punta del este→montevideo x piriápolis"                  to 145,
            "punta del este→montevideo x pan de azúcar y san carlos"  to 155,
            "punta del este→montevideo x ruta 8 y 9"                  to 165,
            "piriápolis→montevideo"                                    to 97,
            "punta negra→montevideo"                                   to 112,
            "laguna garzón→montevideo"                                 to 183,
            "la paloma→montevideo"                                     to 220,
            "la pedrera→montevideo"                                    to 250,
            "rocha→montevideo"                                         to 220,
            "aguas dulces→montevideo"                                  to 290,
            "chuy→montevideo"                                          to 345,
            // Intermedios Punta del Este
            "punta del este→piriápolis"                                to 40,
            "punta del este→punta negra"                               to 28,
            "punta del este→laguna garzón"                             to 50,
            "punta del este→la pedrera"                                to 150,
            "punta del este→chuy"                                      to 235,
            "punta del este→san carlos"                                to 30,
            // Regresos desde Punta del Este
            "piriápolis→punta del este"                                to 40,
            "punta negra→punta del este"                               to 28,
            "laguna garzón→punta del este"                             to 50,
            "la pedrera→punta del este"                                to 150,
            "chuy→punta del este"                                      to 245,
            "san carlos→punta del este"                                to 30,
            // Intermedios Piriápolis
            "piriápolis→punta colorada"                                to 15,
            "piriápolis→punta negra"                                   to 12,
            "piriápolis→cuchilla alta"                                 to 30,
            "punta colorada→piriápolis"                                to 15,
            "punta negra→piriápolis"                                   to 12,
            "cuchilla alta→piriápolis"                                 to 30,
            // Intermedios Rocha
            "rocha→chuy"                                               to 120,
            "rocha→la paloma"                                          to 35,
            "rocha→la pedrera"                                         to 40,
            "rocha→aguas dulces"                                       to 70,
            "chuy→rocha"                                               to 120,
            "la paloma→rocha"                                          to 35,
            "la pedrera→rocha"                                         to 40,
            "aguas dulces→rocha"                                       to 70,
            "la paloma→chuy"                                           to 120,
            "chuy→la paloma"                                           to 120,
        )
    }

    suspend fun registrarChofer(legajo: String, nombre: String, base: String, tipo: String): Boolean =
        supabase.registrarChofer(legajo, nombre, base, tipo, getCurrentDeviceId())

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
        val config = supabase.getConfiguracion()
        val laudoKm = config["precio_km_conductor"] ?: 8.0122
        val montoViatico = config["viatico_comida"] ?: 455.26
        return LaudoCalculator.calcular(jornadaCompleta, laudoKm, montoViatico)
    }
}
