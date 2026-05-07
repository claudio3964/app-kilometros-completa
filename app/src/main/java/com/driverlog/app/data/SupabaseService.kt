package com.driverlog.app.data

import android.content.Context
import android.util.Log
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
    private val SUPABASE_URL = "https://frjeivfpldcigklwepqt.supabase.co"
    private val SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyamVpdmZwbGRjaWdrbHdlcHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTY0NzcsImV4cCI6MjA5MTA5MjQ3N30.EOLZPqcU25vhTk09IbhCYVO6xZhKq_52IOYW0WDP6Jo"

    suspend fun sincronizarJornada(legajo: String): List<Viaje> = withContext(Dispatchers.IO) {
        try {
            Log.d("COT", "Sincronizando legajo: $legajo")
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/viajes?legajo=eq.$legajo&order=fecha.desc")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            Log.d("COT", "Respuesta Supabase: $body")
            parsearViajes(body)
        } catch (e: Exception) {
            Log.e("COT", "Error sync: ${e.message}")
            emptyList()
        }
    }

    suspend fun activarViajeEnSupabase(viajeId: String, inicioReal: Long): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("status", "en_curso")
                    put("inicio_real", inicioReal)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/viajes?id=eq.$viajeId")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .patch(body)
                    .build()
                client.newCall(request).execute().isSuccessful
            } catch (e: Exception) {
                false
            }
        }

    suspend fun guardarFcmToken(legajo: String, token: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply { put("fcm_token", token) }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/choferes?legajo=eq.$legajo")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .patch(body)
                    .build()
                client.newCall(request).execute().isSuccessful
            } catch (e: Exception) {
                false
            }
        }

    private fun parsearViajes(json: String): List<Viaje> {
        val viajes = mutableListOf<Viaje>()
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val v = array.getJSONObject(i)
                viajes.add(
                    Viaje(
                        id = v.optString("id", ""),
                        orderNumber = v.optString("id", ""),
                        origen = v.optString("origen", ""),
                        destino = v.optString("destino", ""),
                        departureTime = v.optString("hora_salida", ""),
                        arrivalTime = v.optString("hora_llegada", ""),
                        status = v.optString("status", "programado"),
                        inicioProgramado = 0L,
                        kmEmpresa = 0,
                        turno = "",
                        tipoServicio = "",
                        acoplado = false,
                        acopladoKm = 0,
                    )
                )
            }
        } catch (e: Exception) {
            Log.e("COT", "Error parsear: ${e.message}")
        }
        return viajes
    }

suspend fun finalizarViajeEnSupabase(viajeId: String, finReal: Long): Boolean =
    withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("status", "finalizado")
                put("fin_real", finReal)
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/viajes?id=eq.$viajeId")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .patch(body)
                .build()
            val response = client.newCall(request).execute()
            Log.d("COT", "Finalizando viaje en Supabase: ${response.code}")
            response.isSuccessful
        } catch (e: Exception) {
            Log.e("COT", "Error finalizando viaje: ${e.message}")
            false
        }
    }
}