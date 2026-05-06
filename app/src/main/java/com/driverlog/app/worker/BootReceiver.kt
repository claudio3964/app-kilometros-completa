package com.driverlog.app.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.*
import com.driverlog.app.data.CotDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Reprogramar todos los viajes programados que quedaron pendientes
        CoroutineScope(Dispatchers.IO).launch {
            val db = CotDatabase.getInstance(context)
            val dao = db.viajeDao()
            val ahora = System.currentTimeMillis()

            // Obtener viajes programados desde Room
            val viajes = dao.getViajesPendientesSync()

            viajes.forEach { viaje ->
                if (viaje.status == "programado" && viaje.inicioProgramado > ahora) {
                    val demora = viaje.inicioProgramado - ahora

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
            }
        }
    }
}