package com.driverlog.app.worker

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.driverlog.app.data.ViajeRepository

class CortarGuardiaWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val legajo = inputData.getString("legajo") ?: return Result.failure()
        val repo = ViajeRepository(applicationContext)

        val guardiaActiva = repo.getGuardiaEnCurso()
        if (guardiaActiva != null) {
            Log.d("COT", "CortarGuardiaWorker — cortando guardia ${guardiaActiva.id}")
            repo.finalizarGuardia(guardiaActiva.id)

            val intent = Intent("com.driverlog.GUARDIA_CORTADA").apply {
                putExtra("motivo", "Viaje programado en 15 minutos")
            }
            applicationContext.sendBroadcast(intent)
        }
        return Result.success()
    }
}