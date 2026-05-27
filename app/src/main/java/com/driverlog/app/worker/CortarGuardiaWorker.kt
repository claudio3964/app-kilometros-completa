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
        val guardiaIdEsperada = inputData.getString("guardiaId") ?: ""
        val repo = ViajeRepository(applicationContext)

        if (guardiaIdEsperada.isEmpty()) {
            Log.d("COT", "CortarGuardiaWorker — sin guardiaId, nada que cortar")
            return Result.success()
        }

        val guardiaActual = repo.getGuardiaEnCurso()
        if (guardiaActual == null || guardiaActual.id != guardiaIdEsperada) {
            Log.d("COT", "CortarGuardiaWorker — guardia $guardiaIdEsperada ya no activa, omitiendo")
            return Result.success()
        }

        Log.d("COT", "CortarGuardiaWorker — cortando guardia ${guardiaActual.id}")
        repo.finalizarGuardia(guardiaActual.id)

        val intent = Intent("com.driverlog.GUARDIA_CORTADA").apply {
            putExtra("motivo", "Viaje programado en 15 minutos")
        }
        applicationContext.sendBroadcast(intent)

        return Result.success()
    }
}