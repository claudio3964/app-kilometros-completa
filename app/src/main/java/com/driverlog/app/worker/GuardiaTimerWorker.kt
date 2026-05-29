package com.driverlog.app.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

const val ACTION_EXTENDER          = "com.driverlog.ACTION_EXTENDER"
const val ACTION_FINALIZAR_GUARDIA = "com.driverlog.ACTION_FINALIZAR_GUARDIA"
const val ACTION_CAMBIAR_COMUN     = "com.driverlog.ACTION_CAMBIAR_COMUN"
const val NOTIF_ID_GUARDIA         = 2001

class GuardiaTimerWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val guardiaId   = inputData.getString("guardiaId")   ?: return Result.failure()
        val inicio      = inputData.getString("inicio")      ?: ""
        val tipoGuardia = inputData.getString("tipoGuardia") ?: "comun"
        val descripcion = inputData.getString("descripcion") ?: ""

        crearCanalNotificacion()
        mostrarNotificacion(guardiaId, inicio, tipoGuardia, descripcion)

        return Result.success()
    }

    private fun crearCanalNotificacion() {
        val channel = NotificationChannel(
            "guardia_timer",
            "Timer Guardia",
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Alertas de guardia" }
        applicationContext.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun pendingAction(
        action: String,
        guardiaId: String,
        inicio: String,
        tipoGuardia: String,
        descripcion: String,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(action).apply {
            setPackage(applicationContext.packageName)
            putExtra("guardiaId",   guardiaId)
            putExtra("inicio",      inicio)
            putExtra("tipoGuardia", tipoGuardia)
            putExtra("descripcion", descripcion)
        }
        return PendingIntent.getBroadcast(
            applicationContext, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun mostrarNotificacion(
        guardiaId: String,
        inicio: String,
        tipoGuardia: String,
        descripcion: String
    ) {
        val esContrato = descripcion.trimStart().startsWith("contrato", ignoreCase = true)

        val titulo: String
        val texto: String
        val boton1Label: String; val boton1Action: String
        val boton2Label: String; val boton2Action: String

        when {
            tipoGuardia == "especial" && esContrato -> {
                titulo       = "⏰ Contrato — ¿Seguís o finalizás?"
                texto        = "Llevas 4h en guardia especial (contrato)"
                boton1Label  = "Seguir 1h";   boton1Action = ACTION_EXTENDER
                boton2Label  = "Finalizar";   boton2Action = ACTION_FINALIZAR_GUARDIA
            }
            tipoGuardia == "especial" -> {
                titulo       = "⏰ Guardia especial — ¿Continuás así?"
                texto        = "Llevas 1h en especial. ¿Seguís o cambiás a común?"
                boton1Label  = "Seguir especial 1h"; boton1Action = ACTION_EXTENDER
                boton2Label  = "Cambiar a común";    boton2Action = ACTION_CAMBIAR_COMUN
            }
            else -> {
                titulo       = "⏰ Guardia — 8 horas cumplidas"
                texto        = "Iniciaste a las $inicio. ¿Finalizás o extendés?"
                boton1Label  = "Extender 1h";    boton1Action = ACTION_EXTENDER
                boton2Label  = "Cerrar guardia"; boton2Action = ACTION_FINALIZAR_GUARDIA
            }
        }

        val pi1 = pendingAction(boton1Action, guardiaId, inicio, tipoGuardia, descripcion, 101)
        val pi2 = pendingAction(boton2Action, guardiaId, inicio, tipoGuardia, descripcion, 102)

        val notif = NotificationCompat.Builder(applicationContext, "guardia_timer")
            .setContentTitle(titulo)
            .setContentText(texto)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .addAction(0, boton1Label, pi1)
            .addAction(0, boton2Label, pi2)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        applicationContext.getSystemService(NotificationManager::class.java)
            .notify(NOTIF_ID_GUARDIA, notif)
    }
}
