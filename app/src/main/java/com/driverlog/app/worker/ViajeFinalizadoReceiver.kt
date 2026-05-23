package com.driverlog.app.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.driverlog.app.data.CotDatabase
import com.driverlog.app.data.SupabaseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ViajeFinalizadoReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val viajeId = intent.getStringExtra("viajeId") ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = CotDatabase.getInstance(context)
                val dao = db.viajeDao()
                val finReal = System.currentTimeMillis()

                dao.finalizarViaje(
                    id = viajeId,
                    status = "finalizado",
                    finReal = finReal
                )

                SupabaseService(context).finalizarViajeEnSupabase(viajeId, finReal)

                Log.d("COT", "ViajeFinalizadoReceiver — viaje $viajeId finalizado")
            } catch (e: Exception) {
                Log.e("COT", "Error finalizando viaje: ${e.message}")
            }
        }
    }
}