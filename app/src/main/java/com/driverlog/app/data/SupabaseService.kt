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
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val hoy = sdf.format(java.util.Date())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/jornadas?legajo=eq.$legajo&fecha=gte.$hoy&order=fecha.desc&limit=5")                .addHeader("apikey", SUPABASE_KEY)
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
    suspend fun crearJornadaEnSupabase(jornada: Jornada): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val data = JSONObject().apply {
                    put("date", jornada.fecha)
                    put("closed", false)
                    put("guards", org.json.JSONArray())
                    put("legajo", jornada.legajo)
                    put("status", "activa")
                    put("travels", org.json.JSONArray())
                    put("syncStatus", "synced")
                    put("orderNumber", jornada.orderNumber)
                    put("horaInicio", jornada.horaInicio)
                }
                val json = JSONObject().apply {
                    put("legajo", jornada.legajo)
                    put("empresa_id", "cot")
                    put("chofer_id", jornada.legajo)
                    put("order_number", jornada.orderNumber)
                    put("fecha", jornada.fecha)
                    put("hora_inicio", jornada.horaInicio)
                    put("data", data)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/jornadas")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Prefer", "return=minimal")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Crear jornada en Supabase: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error crear jornada: ${e.message}")
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
                Log.d("COT", "Travels en jornada ${jornada.optString("order_number")}: ${travels.length()}")

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

suspend fun agregarGuardiaAJornada(orderNumber: String, guardia: Guardia): Boolean =
    withContext(Dispatchers.IO) {
        try {
            val guardiaJson = JSONObject().apply {
                put("id", guardia.id)
                put("dia", guardia.dia)
                put("inicio", guardia.inicio)
                put("fin", guardia.fin)
                put("type", guardia.type)
                put("hours", guardia.hours)
                put("status", guardia.status)
                put("viatico", guardia.viatico)
                put("kmGuardia", guardia.kmGuardia)
                put("createdAt", guardia.createdAt)
                put("asignadoPorAdmin", guardia.asignadoPorAdmin)
            }
            val json = JSONObject().apply {
                put("p_order_number", orderNumber)
                put("p_guardia", guardiaJson)
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/rpc/agregar_guardia_a_jornada")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()
            val response = client.newCall(request).execute()
            Log.d("COT", "Agregar guardia a jornada: ${response.code}")
            response.isSuccessful
        } catch (e: Exception) {
            Log.e("COT", "Error agregar guardia: ${e.message}")
            false
        }
    }
    suspend fun sincronizarPerfil(legajo: String, nombre: String, base: String, tipo: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("nombre", nombre)
                    put("base", base)
                    put("tipo", tipo)
                }
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
                Log.e("COT", "Error sync perfil: ${e.message}")
                false
            }
        }

    suspend fun agregarViajeAJornada(orderNumber: String, viaje: Viaje): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val viajeJson = JSONObject().apply {
                    put("id", viaje.id)
                    put("origen", viaje.origen)
                    put("destino", viaje.destino)
                    put("departureTime", viaje.departureTime)
                    put("arrivalTime", viaje.arrivalTime)
                    put("status", viaje.status)
                    put("inicioProgramado", viaje.inicioProgramado)
                    put("kmEmpresa", viaje.kmEmpresa)
                    put("tipoServicio", viaje.tipoServicio)
                    put("coche", viaje.coche ?: "")
                    put("acoplado", viaje.acoplado)
                    put("acopladoKm", viaje.acopladoKm)
                }
                val json = JSONObject().apply {
                    put("p_order_number", orderNumber)
                    put("p_viaje", viajeJson)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/agregar_viaje_a_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Agregar viaje a jornada: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error agregar viaje: ${e.message}")
                false
            }
        }

    suspend fun cancelarViajeEnSupabase(viajeId: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_viaje_id", viajeId)
                    put("p_status", "cancelado")
                    put("p_inicio_real", 0L)
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
                Log.d("COT", "Cancelar viaje: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error cancelar viaje: ${e.message}")
                false
            }
        }

    suspend fun finalizarGuardiaEnSupabase(guardiaId: String, orderNumber: String, fin: String, hours: Double): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_guardia_id", guardiaId)
                    put("p_order_number", orderNumber)
                    put("p_fin", fin)
                    put("p_hours", hours)
                    put("p_status", "finalizada")
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/finalizar_guardia_en_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Finalizar guardia en Supabase: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error finalizar guardia: ${e.message}")
                false
            }
        }
}