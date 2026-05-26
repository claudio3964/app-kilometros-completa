package com.driverlog.app.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.driverlog.app.MainActivity
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MensajesPollingWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val repo = ViajeRepository(context)
        val legajo = repo.getLegajo()

        if (legajo.isNotEmpty()) {
            try {
                val mensajes = repo.obtenerMensajesPendientes(legajo)
                for (msg in mensajes) {
                    procesarMensaje(repo, legajo, msg)
                }
            } catch (e: Exception) {
                Log.e("COT_POLLING", "Error en ciclo de polling: ${e.message}")
            }
        }

        reencolar()
        Result.success()
    }

    private suspend fun procesarMensaje(repo: ViajeRepository, legajo: String, msg: JSONObject) {
        val id = msg.optString("id", "")
        val tipo = msg.optString("tipo", "")
        val dataRaw = msg.opt("data")
        val data: JSONObject = when (dataRaw) {
            is JSONObject -> dataRaw
            is String -> runCatching { JSONObject(dataRaw) }.getOrDefault(JSONObject())
            else -> JSONObject()
        }

        try {
            when (tipo) {
                "asignacion" -> {
                    val viajeData = data.optJSONObject("viaje") ?: data
                    repo.crearViaje(
                        legajo = legajo,
                        origen = viajeData.optString("origen", ""),
                        destino = viajeData.optString("destino", ""),
                        km = viajeData.optInt("km", 0),
                        tipoServicio = viajeData.optString("tipoServicio", ""),
                        coche = viajeData.optString("coche", ""),
                        horaSalida = viajeData.optString("horaSalida", ""),
                        horaLlegada = viajeData.optString("horaLlegada", ""),
                        inicioProgramadoMs = viajeData.optLong("inicioProgramadoMs", System.currentTimeMillis())
                    )
                    Log.d("COT_POLLING", "Viaje creado desde asignacion id=$id")
                }
                "guardia" -> {
                    val jornada = repo.getJornadaActiva() ?: repo.getOCrearJornada(legajo)
                    val descripcion = data.optString("descripcion", "")
                        .ifEmpty { data.optString("motivo", "") }
                        .takeIf { it.isNotEmpty() }
                    repo.iniciarGuardia(
                        orderNumber = jornada.orderNumber,
                        type = data.optString("tipo", "comun"),
                        inicio = data.optString("inicio", "").takeIf { it.isNotEmpty() },
                        descripcion = descripcion
                    )
                    Log.d("COT_POLLING", "Guardia creada desde mensaje id=$id")
                }
                "cancelar_viaje" -> {
                    val viajeId = data.optString("viajeId", "")
                    if (viajeId.isNotEmpty()) {
                        repo.cancelarViaje(viajeId)
                        Log.d("COT_POLLING", "Viaje $viajeId cancelado desde mensaje id=$id")
                    }
                }
                "mensaje", "urgente" -> {
                    val texto = data.optString("texto", "")
                        .ifEmpty { data.optString("mensaje", "Mensaje del despacho") }
                    mostrarNotificacion(tipo, texto, id.hashCode())
                    Log.d("COT_POLLING", "Notificacion mostrada tipo=$tipo id=$id")
                }
                else -> Log.w("COT_POLLING", "Tipo desconocido: $tipo id=$id")
            }
            repo.marcarMensajeLeido(id)
        } catch (e: Exception) {
            Log.e("COT_POLLING", "Error procesando mensaje $id tipo=$tipo: ${e.message}")
            // No marca como leído si falla — el próximo ciclo lo reintenta
        }
    }

    private fun mostrarNotificacion(tipo: String, texto: String, notifId: Int) {
        val channelId = "cot_mensajes"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(channelId, "Mensajes COT", NotificationManager.IMPORTANCE_HIGH)
        )
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pi = PendingIntent.getActivity(
            context, notifId, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val titulo = if (tipo == "urgente") "Urgente — Despacho COT" else "Mensaje — Despacho COT"
        val prioridad = if (tipo == "urgente") NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH
        nm.notify(
            notifId,
            NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setPriority(prioridad)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build()
        )
    }

    private fun reencolar() {
        WorkManager.getInstance(context).enqueueUniqueWork(
            WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<MensajesPollingWorker>()
                .setInitialDelay(INTERVALO_SEGUNDOS, TimeUnit.SECONDS)
                .addTag(TAG)
                .build()
        )
    }

    companion object {
        const val WORK_NAME = "mensajes_polling"
        const val TAG = "mensajes_polling"
        private const val INTERVALO_SEGUNDOS = 30L

        fun iniciar(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<MensajesPollingWorker>()
                    .addTag(TAG)
                    .build()
            )
        }
    }
}
