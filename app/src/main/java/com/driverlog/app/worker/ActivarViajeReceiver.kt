package com.driverlog.app.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.*
import java.util.concurrent.TimeUnit

class ActivarViajeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val viajeId = intent.getStringExtra("viajeId") ?: return
        val origen = intent.getStringExtra("origen") ?: ""
        val destino = intent.getStringExtra("destino") ?: ""

        val inputData = workDataOf(
            "viajeId" to viajeId,
            "inicioProgramado" to System.currentTimeMillis(),
            "origen" to origen,
            "destino" to destino
        )

        val workRequest = OneTimeWorkRequestBuilder<ActivarViajeWorker>()
            .setInputData(inputData)
            .addTag("viaje_$viajeId")
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                "activar_viaje_$viajeId",
                ExistingWorkPolicy.REPLACE,
                workRequest
            )
    }
}