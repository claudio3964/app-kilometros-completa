package com.driverlog.app.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.driverlog.app.MainActivity
import com.driverlog.app.data.CotDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ActivarViajeWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val viajeId = inputData.getString("viajeId") ?: return@withContext Result.failure()
        val inicioProgramado = inputData.getLong("inicioProgramado", 0L)
        val origen = inputData.getString("origen") ?: ""
        val destino = inputData.getString("destino") ?: ""

        try {
            val db = CotDatabase.getInstance(context)
            val dao = db.viajeDao()

            // Activar el viaje con la hora programada como inicioReal
            val ahora = System.currentTimeMillis()
            val inicioReal = if (ahora - inicioProgramado < 2 * 60 * 60 * 1000) {
                // Menos de 2 horas de diferencia — usar hora programada
                inicioProgramado
            } else {
                // Más de 2 horas — algo falló, usar hora actual
                ahora
            }

            dao.activarViaje(
                id = viajeId,
                status = "en_curso",
                inicioReal = inicioReal
            )

            // Mostrar notificación nativa
            mostrarNotificacionActivacion(origen, destino)

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun mostrarNotificacionActivacion(origen: String, destino: String) {
        val channelId = "cot_viajes"
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            channelId,
            "Viajes COT",
            NotificationManager.IMPORTANCE_HIGH
        )
        notificationManager.createNotificationChannel(channel)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("viajeActivado", true)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🚌 Viaje iniciado")
            .setContentText("$origen → $destino en curso")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(viajeId.hashCode(), notification)
    }

    // hashCode del viajeId para ID único de notificación
    private val viajeId: String
        get() = inputData.getString("viajeId") ?: "unknown"
}