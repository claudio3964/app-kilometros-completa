package com.driverlog.app.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class SupabaseService(private val context: Context) {

    private val client = OkHttpClient()

    // Estas constantes las sacás del proyecto JS (sync.js)
    private val SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co"
    private val SUPABASE_KEY = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ"

    suspend fun sincronizarJornada(legajo: String): List<Viaje> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$SUPABASE_URL/rest/v1/jornadas?legajo=eq.$legajo&order=fecha.desc&limit=1")
            .addHeader("apikey", SUPABASE_KEY)
            .addHeader("Authorization", "Bearer $SUPABASE_KEY")
            .addHeader("Content-Type", "application/json")
            .get()
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: return@withContext emptyList()

        parsearViajes(body)
    }

    suspend fun activarViajeEnSupabase(viajeId: String, inicioReal: Long): Boolean =
        withContext(Dispatchers.IO) {
            val json = JSONObject().apply {
                put("status", "en_curso")
                put("inicioReal", inicioReal)
            }

            val body = json.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/viajes?id=eq.$viajeId")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .patch(body)
                .build()

            val response = client.newCall(request).execute()
            response.isSuccessful
        }

    suspend fun guardarFcmToken(legajo: String, token: String): Boolean =
        withContext(Dispatchers.IO) {
            val json = JSONObject().apply {
                put("fcm_token", token)
            }

            val body = json.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/choferes?legajo=eq.$legajo")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .patch(body)
                .build()

            val response = client.newCall(request).execute()
            response.isSuccessful
        }

    private fun parsearViajes(json: String): List<Viaje> {
        val viajes = mutableListOf<Viaje>()
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val jornada = array.getJSONObject(i)
                val travels = jornada.optJSONArray("data")
                    ?.optJSONObject(0)
                    ?.optJSONArray("travels") ?: continue

                for (j in 0 until travels.length()) {
                    val t = travels.getJSONObject(j)
                    viajes.add(
                        Viaje(
                            id = t.optString("id", ""),
                            orderNumber = t.optString("order_number", ""),
                            origen = t.optString("origen", ""),
                            destino = t.optString("destino", ""),
                            departureTime = t.optString("departureTime", ""),
                            arrivalTime = t.optString("arrivalTime", ""),
                            status = t.optString("status", "programado"),
                            inicioProgramado = t.optLong("inicioProgramado", 0L),
                            kmEmpresa = t.optInt("kmEmpresa", 0),
                            turno = t.optString("turno", ""),
                            tipoServicio = t.optString("tipoServicio", ""),
                            acoplado = t.optBoolean("acoplado", false),
                            acopladoKm = t.optInt("acopladoKm", 0),
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return viajes
    }
}