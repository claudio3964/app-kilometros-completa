package com.driverlog.app.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.driverlog.app.MainActivity
import com.driverlog.app.worker.ActivarViajeWorker
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.util.concurrent.TimeUnit

class CotFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val tipo = data["tipo"] ?: return

        when (tipo) {
            "viaje_programado" -> {
                val viajeId = data["viajeId"] ?: return
                val inicioProgramado = data["inicioProgramado"]?.toLongOrNull() ?: return
                val origen = data["origen"] ?: ""
                val destino = data["destino"] ?: ""

                programarActivacionViaje(viajeId, inicioProgramado, origen, destino)
            }
            "sync_jornada" -> {
                // Notificar a la app que sincronice
                mostrarNotificacion(
                    titulo = "Nueva jornada disponible",
                    cuerpo = "Abrí la app para ver tus viajes programados"
                )
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Guardar el nuevo token en Supabase
        val prefs = getSharedPreferences("cot_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
    }

    private fun programarActivacionViaje(
        viajeId: String,
        inicioProgramado: Long,
        origen: String,
        destino: String
    ) {
        val ahora = System.currentTimeMillis()
        val demora = (inicioProgramado - ahora).coerceAtLeast(0L)

        val inputData = workDataOf(
            "viajeId" to viajeId,
            "inicioProgramado" to inicioProgramado,
            "origen" to origen,
            "destino" to destino
        )

        val workRequest = OneTimeWorkRequestBuilder<ActivarViajeWorker>()
            .setInitialDelay(demora, TimeUnit.MILLISECONDS)
            .setInputData(inputData)
            .addTag("viaje_$viajeId")
            .build()

        WorkManager.getInstance(applicationContext)
            .enqueueUniqueWork(
                "activar_viaje_$viajeId",
                ExistingWorkPolicy.REPLACE,
                workRequest
            )

        mostrarNotificacion(
            titulo = "Viaje programado",
            cuerpo = "Tu viaje $origen → $destino está programado"
        )
    }

    private fun mostrarNotificacion(titulo: String, cuerpo: String) {
        val channelId = "cot_viajes"
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            channelId,
            "Viajes COT",
            NotificationManager.IMPORTANCE_HIGH
        )
        notificationManager.createNotificationChannel(channel)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(titulo)
            .setContentText(cuerpo)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}