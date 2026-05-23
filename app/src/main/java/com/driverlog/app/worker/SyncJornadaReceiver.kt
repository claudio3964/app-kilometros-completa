package com.driverlog.app.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.driverlog.app.data.ViajeRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SyncJornadaReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("cot_prefs", Context.MODE_PRIVATE)
        val legajo = prefs.getString("legajo", null) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repo = ViajeRepository(context)
                repo.sincronizarDesdeSupabase(legajo)
                Log.d("COT", "SyncJornadaReceiver — sync completado para $legajo")
            } catch (e: Exception) {
                Log.e("COT", "Error sync jornada: ${e.message}")
            }
        }
    }
}