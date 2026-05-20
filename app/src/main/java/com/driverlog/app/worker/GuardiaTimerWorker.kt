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

class GuardiaTimerWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val guardiaId = inputData.getString("guardiaId") ?: return Result.failure()
        val inicio = inputData.getString("inicio") ?: ""

        crearCanalNotificacion()
        mostrarNotificacion(guardiaId, inicio)

        // Broadcast para que la UI muestre el popup
        val intent = Intent("com.driverlog.GUARDIA_8_HORAS").apply {
            putExtra("guardiaId", guardiaId)
            putExtra("inicio", inicio)
        }
        applicationContext.sendBroadcast(intent)

        return Result.success()
    }

    private fun crearCanalNotificacion() {
        val channel = NotificationChannel(
            "guardia_timer",
            "Timer Guardia",
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Alerta de 8 horas de guardia" }
        applicationContext.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun mostrarNotificacion(guardiaId: String, inicio: String) {
        val intent = Intent(applicationContext, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(applicationContext, "guardia_timer")
            .setContentTitle("⏰ Guardia — 8 horas cumplidas")
            .setContentText("Iniciaste a las $inicio. ¿Finalizás o continuás?")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        applicationContext.getSystemService(NotificationManager::class.java)
            .notify(2001, notif)
    }
}