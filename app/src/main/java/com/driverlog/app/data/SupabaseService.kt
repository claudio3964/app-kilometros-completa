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
                .url("$SUPABASE_URL/rest/v1/jornadas?legajo=eq.$legajo&order=fecha.desc&limit=5")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            Log.d("COT", "Respuesta Supabase: ${body.take(200)}")
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
                    put("p_viaje_id", viajeId)
                    put("p_status", "en_curso")
                    put("p_inicio_real", inicioReal)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/actualizar_viaje_en_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Activar viaje en jornada: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error activar viaje: ${e.message}")
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
            val jornadas = JSONArray(json)
            for (i in 0 until jornadas.length()) {
                val jornada = jornadas.getJSONObject(i)
                val orderNumber = jornada.optString("order_number", "")
                val data = jornada.optJSONObject("data") ?: continue
                val travels = data.optJSONArray("travels") ?: continue

                for (j in 0 until travels.length()) {
                    val t = travels.getJSONObject(j)
                    val status = t.optString("status", "programado")
                    // Solo traer viajes activos — no cancelados
                    if (status == "cancelado") continue

                    viajes.add(
                        Viaje(
                            id = t.optString("id", ""),
                            orderNumber = jornada.optString("order_number", t.optString("id", "")),
                            origen = t.optString("origen", ""),
                            destino = t.optString("destino", ""),
                            departureTime = t.optString("departureTime", ""),
                            arrivalTime = t.optString("arrivalTime", ""),
                            status = status,
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
            Log.e("COT", "Error parsear: ${e.message}")
        }
        return viajes
    }

    suspend fun finalizarViajeEnSupabase(viajeId: String, finReal: Long): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_viaje_id", viajeId)
                    put("p_status", "finalizado")
                    put("p_fin_real", finReal)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/actualizar_viaje_en_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Finalizar viaje en jornada: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error finalizar viaje: ${e.message}")
                false
            }
        }
    }