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
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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
                val orderNumber = data["orderNumber"] ?: ""

                programarActivacionViaje(viajeId, inicioProgramado, origen, destino)

                // Notificar a la UI para que sincronice
                val intent = Intent("com.driverlog.NUEVO_VIAJE_ASIGNADO").apply {
                    putExtra("viajeId", viajeId)
                    putExtra("origen", origen)
                    putExtra("destino", destino)
                    putExtra("orderNumber", orderNumber)
                }
                sendBroadcast(intent)
            }
            "guardia_asignada" -> {
                val orderNumber = data["orderNumber"] ?: ""
                val tipo_guardia = data["tipo_guardia"] ?: "comun"

                mostrarNotificacion(
                    titulo = "🛡 Guardia asignada",
                    cuerpo = "Tenés una guardia asignada — abrí la app para iniciarla"
                )
                val intent = Intent("com.driverlog.GUARDIA_ASIGNADA").apply {
                    putExtra("orderNumber", orderNumber)
                    putExtra("tipo_guardia", tipo_guardia)
                }
                sendBroadcast(intent)
            }
            "sync_jornada" -> {
                mostrarNotificacion(
                    titulo = "Nueva jornada disponible",
                    cuerpo = "Abrí la app para ver tus viajes programados"
                )
                val intent = Intent("com.driverlog.SYNC_JORNADA")
                sendBroadcast(intent)
            }
            "mensaje_despacho" -> {
                val mensaje = data["mensaje"] ?: ""
                val remitente = data["remitente"] ?: "Despacho"
                mostrarNotificacion(
                    titulo = "💬 Mensaje de $remitente",
                    cuerpo = mensaje
                )
            }
            "activar_viaje" -> {
                val viajeId = data["viajeId"] ?: return
                val origen = data["origen"] ?: ""
                val destino = data["destino"] ?: ""

                mostrarNotificacion(
                    titulo = "Iniciando viaje",
                    cuerpo = "$origen → $destino"
                )
                val intent = Intent("com.driverlog.ACTIVAR_VIAJE").apply {
                    putExtra("viajeId", viajeId)
                    putExtra("origen", origen)
                    putExtra("destino", destino)
                }
                sendBroadcast(intent)
            }

            "finalizar_viaje" -> {
                val viajeId = data["viajeId"] ?: return
                val destino = data["destino"] ?: ""

                mostrarNotificacion(
                    titulo = "Llegando a destino",
                    cuerpo = "Verificá llegada a $destino"
                )
                val intent = Intent("com.driverlog.FINALIZAR_VIAJE").apply {
                    putExtra("viajeId", viajeId)
                }
                sendBroadcast(intent)
            }

            "aviso_guardia" -> {
                val guardiaId = data["guardiaId"] ?: return
                val umbralHoras = data["umbralHoras"] ?: ""
                val horaCorte = data["horaCorte"] ?: ""

                mostrarNotificacion(
                    titulo = "Guardia por cumplir $umbralHoras horas",
                    cuerpo = "Faltan 5 min. Auto-cierre a las $horaCorte"
                )
                val intent = Intent("com.driverlog.AVISO_GUARDIA").apply {
                    putExtra("guardiaId", guardiaId)
                    putExtra("umbralHoras", umbralHoras)
                    putExtra("horaCorte", horaCorte)
                }
                sendBroadcast(intent)
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("COT", "FCM Token nuevo: $token")
        val prefs = getSharedPreferences("cot_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()

        val legajo = prefs.getString("legajo", null) ?: return
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            com.driverlog.app.data.SupabaseService(applicationContext)
                .guardarFcmToken(legajo, token)
        }
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

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Viajes COT",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

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