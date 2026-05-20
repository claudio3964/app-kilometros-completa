package com.driverlog.app.data

import android.content.Context
import androidx.work.*
import com.driverlog.app.worker.ActivarViajeWorker
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit
import android.util.Log
class ViajeRepository(private val context: Context) {

    private val db = CotDatabase.getInstance(context)
    private val dao = db.viajeDao()
    private val guardiaDao = db.guardiaDao()
    private val jornadaDao = db.jornadaDao()
    private val supabase = SupabaseService(context)

    // ── Observar viajes desde Room (reactivo) ──
    fun getTodosLosViajes(): Flow<List<Viaje>> = dao.getTodosLosViajes()
    fun getViajesProgramados(): Flow<List<Viaje>> = dao.getViajesProgramados()

    suspend fun getViajeEnCurso(): Viaje? = dao.getViajeEnCurso()

    // ── Sync desde Supabase ──
    suspend fun sincronizarDesdeSupabase(legajo: String) {
        val viajes = supabase.sincronizarJornada(legajo)
        if (viajes.isNotEmpty()) {
            dao.insertarViajes(viajes)
            // Programar WorkManager para cada viaje programado
            val ahora = System.currentTimeMillis()
            viajes.forEach { viaje ->
                if (viaje.status == "programado" && viaje.inicioProgramado > ahora) {
                    programarActivacion(viaje)
                }
            }
        }
    }

    // ── Activar viaje ──
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
        dao.finalizarViaje(viajeId, "finalizado", ahora)
        // Sync a Supabase
        supabase.finalizarViajeEnSupabase(viajeId, ahora)
    }

    // ── Programar WorkManager ──
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

    // ── FCM Token ──
    suspend fun guardarFcmToken(legajo: String, token: String) {
        supabase.guardarFcmToken(legajo, token)
        val prefs = context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
    }

    fun getLegajo(): String {
        val prefs = context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
        return prefs.getString("legajo", "") ?: ""
    }

    fun guardarLegajo(legajo: String) {
        val prefs = context.getSharedPreferences("cot_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("legajo", legajo).apply()
    }
    // ── Guardias ──
    fun getTodasLasGuardias() = guardiaDao.getTodasLasGuardias()
    suspend fun getGuardiaEnCurso(): Guardia? = guardiaDao.getGuardiaEnCurso()

    suspend fun iniciarGuardia(type: String = "comun"): Guardia {
        val ahora = System.currentTimeMillis()
        val cal = java.util.Calendar.getInstance()
        val hora = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
        val dia = "${cal.get(java.util.Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}/${(cal.get(java.util.Calendar.MONTH)+1).toString().padStart(2,'0')}/${cal.get(java.util.Calendar.YEAR)}"

        val guardia = Guardia(
            id = "GRD-$ahora",
            dia = dia,
            inicio = hora,
            type = type,
            status = "en_curso",
            createdAt = ahora
        )
        guardiaDao.insertarGuardia(guardia)
        return guardia
    }

    suspend fun finalizarGuardia(guardiaId: String) {
        val guardia = guardiaDao.getGuardiaEnCurso() ?: return
        val ahora = System.currentTimeMillis()
        val cal = java.util.Calendar.getInstance()
        val fin = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
        val hours = (ahora - guardia.createdAt) / 3600000.0
        guardiaDao.finalizarGuardia(guardiaId, "finalizada", fin, hours)
    }
    // ── Jornadas ──
    suspend fun getOCrearJornada(legajo: String): Jornada {
        val cal = java.util.Calendar.getInstance()
        val fecha = "${cal.get(java.util.Calendar.YEAR)}-${(cal.get(java.util.Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(java.util.Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"

        // Buscar jornada activa de hoy
        val existente = jornadaDao.getJornadaPorFecha(fecha, legajo)
        if (existente != null) return existente

        // Crear nueva jornada
        val orderNumber = "$legajo-${fecha.replace("-","")}"
        val jornada = Jornada(
            orderNumber = orderNumber,
            legajo = legajo,
            fecha = fecha,
            status = "activa",
            syncStatus = "pending"
        )
        jornadaDao.insertarJornada(jornada)

        // Intentar sync a Supabase en background
        try {
            supabase.crearJornadaEnSupabase(jornada)
            jornadaDao.marcarSynced(orderNumber)
        } catch (e: Exception) {
            Log.d("COT", "Jornada guardada local, sync pendiente")
        }

        return jornada
    }

    suspend fun getJornadaActiva(): Jornada? = jornadaDao.getJornadaActiva()
}