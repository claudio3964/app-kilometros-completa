package com.driverlog.app.worker

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class GuardiaActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val guardiaId   = intent.getStringExtra("guardiaId")   ?: return
        val inicio      = intent.getStringExtra("inicio")      ?: ""
        val tipoGuardia = intent.getStringExtra("tipoGuardia") ?: "comun"
        val descripcion = intent.getStringExtra("descripcion") ?: ""

        context.getSystemService(NotificationManager::class.java)
            .cancel(NOTIF_ID_GUARDIA)

        when (intent.action) {
            ACTION_EXTENDER -> {
                val inputData = workDataOf(
                    "guardiaId"   to guardiaId,
                    "inicio"      to inicio,
                    "tipoGuardia" to tipoGuardia,
                    "descripcion" to descripcion
                )
                val workRequest = OneTimeWorkRequestBuilder<GuardiaTimerWorker>()
                    .setInitialDelay(1 * 3600_000L, TimeUnit.MILLISECONDS)
                    .setInputData(inputData)
                    .addTag("guardia_timer_$guardiaId")
                    .build()
                WorkManager.getInstance(context)
                    .enqueueUniqueWork(
                        "guardia_timer_$guardiaId",
                        ExistingWorkPolicy.REPLACE,
                        workRequest
                    )
            }

            ACTION_FINALIZAR_GUARDIA -> {
                CoroutineScope(Dispatchers.IO).launch {
                    ViajeRepository(context).finalizarGuardia(guardiaId)
                }
                context.sendBroadcast(Intent("com.driverlog.GUARDIA_CERRADA"))
            }

            ACTION_CAMBIAR_COMUN -> {
                CoroutineScope(Dispatchers.IO).launch {
                    val repo = ViajeRepository(context)
                    val guardia = repo.getGuardiaEnCurso() ?: return@launch
                    repo.cambiarTipoGuardia(guardia)
                }
                context.sendBroadcast(Intent("com.driverlog.SYNC_JORNADA"))
            }
        }
    }
}
