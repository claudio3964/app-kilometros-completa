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

sealed class DeviceCheckResult {
    object Permitido : DeviceCheckResult()
    object RegistrarYPermitir : DeviceCheckResult()
    data class Bloqueado(val mensaje: String) : DeviceCheckResult()
    object ErrorRed : DeviceCheckResult()
    data object NoEncontrado : DeviceCheckResult()
}

data class PerfilChofer(
    val legajo: String,
    val nombre: String,
    val base: String,
    val tipo: String
)

data class JornadasCerradasResult(
    val jornadas: List<Jornada>,
    val viajes: List<Viaje>
)

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
            parsearViajes(JSONArray(body))
        } catch (e: Exception) {
            Log.e("COT", "Error sync: ${e.message}")
            emptyList()
        }
    }

    suspend fun activarViajeEnSupabase(viajeId: String, inicioReal: Long,llegadaEstimada: Long): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_viaje_id", viajeId)
                    put("p_status", "en_curso")
                    put("p_inicio_real", inicioReal)
                    put("p_llegada_estimada", llegadaEstimada)  // ← NUEVO
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
                    put("p_empresa_id", "cot")
                    put("p_chofer_id", jornada.legajo)
                    put("p_order_number", jornada.orderNumber)
                    put("p_fecha", jornada.fecha)
                    put("p_legajo", jornada.legajo)
                    put("p_data", data)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/crear_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""
                Log.d("COT", "Crear jornada en Supabase: ${response.code} — $responseBody")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error crear jornada: ${e.message}")
                false
            }
        }
    private fun parsearViajes(jornadas: JSONArray): List<Viaje> {
        val viajes = mutableListOf<Viaje>()
        try {
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
                            inicioReal = try {
                                val raw = t.opt("inicioReal")
                                when (raw) {
                                    is Long -> raw.takeIf { it > 0L }
                                    is Int -> raw.toLong().takeIf { it > 0L }
                                    is String -> java.text.SimpleDateFormat(
                                        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                                        java.util.Locale.getDefault()
                                    ).also { it.timeZone = java.util.TimeZone.getTimeZone("UTC") }
                                        .parse(raw)?.time
                                    else -> null
                                }
                            } catch (e: Exception) { null },
                            llegadaEstimada = try {
                                val raw = t.opt("llegadaEstimada")
                                when (raw) {
                                    is Long -> raw.takeIf { it > 0L }
                                    is Int -> raw.toLong().takeIf { it > 0L }
                                    else -> null
                                }
                            } catch (e: Exception) { null },
                            kmEmpresa = t.optInt("kmEmpresa", 0),
                            turno = t.optString("turno", ""),
                            tipoServicio = t.optString("tipoServicio", ""),
                            acoplado = t.optBoolean("acoplado", false),
                            acopladoKm = t.optInt("acopladoKm", 0),
                            finReal = try {
                                val raw = t.opt("finReal")
                                when (raw) {
                                    is Long -> raw.takeIf { it > 0L }
                                    is Int -> raw.toLong().takeIf { it > 0L }
                                    is String -> java.text.SimpleDateFormat(
                                        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                                        java.util.Locale.getDefault()
                                    ).also { it.timeZone = java.util.TimeZone.getTimeZone("UTC") }
                                        .parse(raw)?.time
                                    else -> null
                                }
                            } catch (e: Exception) { null },
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e("COT", "Error parsear: ${e.message}")
        }
        return viajes
    }

    suspend fun finalizarViajeEnSupabase(viajeId: String, finReal: Long, cierreAutomatico: Boolean = false): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_viaje_id", viajeId)
                    put("p_status", "finalizado")
                    put("p_fin_real", finReal)
                    put("p_cierre_automatico", cierreAutomatico)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/actualizar_viaje_en_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Prefer", "resolution=ignore-duplicates,return=minimal")
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
    suspend fun eliminarGuardiaDeJornada(guardia: Guardia): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_guardia_id", guardia.id)
                    put("p_order_number", guardia.orderNumber)
                }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/rpc/eliminar_guardia_de_jornada")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                val response = client.newCall(request).execute()
                Log.d("COT", "Eliminar guardia de jornada: ${response.code}")
                response.isSuccessful
            } catch (e: Exception) {
                Log.e("COT", "Error eliminar guardia: ${e.message}")
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
                    put("inicioReal", viaje.inicioReal ?: 0L)
                    put("llegadaEstimada", viaje.llegadaEstimada ?: 0L)  // ← NUEVO
                    put("kmEmpresa", viaje.kmEmpresa)
                    put("tipoServicio", viaje.tipoServicio)
                    put("coche", viaje.coche ?: "")
                    put("acoplado", viaje.acoplado)
                    put("acopladoKm", viaje.acopladoKm)
                    put("origenCreacion", viaje.origenCreacion)
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
                    put("p_inicio_real", JSONObject.NULL)
                    put("p_fin_real", JSONObject.NULL)
                    put("p_cierre_automatico", JSONObject.NULL)
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

    suspend fun verificarDispositivo(legajo: String, deviceId: String): DeviceCheckResult =
        withContext(Dispatchers.IO) {
            try {
                // 1. Verificar que este device_id no esté registrado con otro legajo
                val reqDevice = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/choferes?device_id=eq.$deviceId&legajo=neq.$legajo&select=legajo&limit=1")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .get().build()
                val respDevice = client.newCall(reqDevice).execute()
                val bodyDevice = respDevice.body?.string() ?: "[]"
                if (JSONArray(bodyDevice).length() > 0) {
                    return@withContext DeviceCheckResult.Bloqueado(
                        "Este dispositivo ya tiene un legajo registrado."
                    )
                }

                // 2. Obtener registro del chofer para este legajo
                val reqChofer = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/choferes?legajo=eq.$legajo&select=legajo,nombre,device_id&limit=1")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .get().build()
                val respChofer = client.newCall(reqChofer).execute()
                val bodyChofer = respChofer.body?.string() ?: "[]"
                val arrChofer = JSONArray(bodyChofer)

                if (arrChofer.length() == 0) {
                    return@withContext DeviceCheckResult.NoEncontrado
                }

                val choferObj = arrChofer.getJSONObject(0)
                val savedDeviceId = choferObj.optString("device_id", "")
                val nombre = choferObj.optString("nombre", "")
                when {
                    savedDeviceId.isEmpty() -> DeviceCheckResult.RegistrarYPermitir
                    savedDeviceId == deviceId -> DeviceCheckResult.Permitido
                    else -> {
                        insertarAlertaAcceso(legajo, nombre, deviceId, savedDeviceId)
                        DeviceCheckResult.Bloqueado(
                            "Este legajo ya está registrado en otro dispositivo. Contactá a administración."
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("COT", "Error verificar dispositivo: ${e.message}")
                DeviceCheckResult.ErrorRed
            }
        }

    private suspend fun insertarAlertaAcceso(
        legajo: String,
        nombre: String,
        deviceIdNuevo: String,
        deviceIdActual: String
    ) = withContext(Dispatchers.IO) {
        try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val timestamp = sdf.format(java.util.Date())

            val json = JSONObject().apply {
                put("empresa_id", "cot")
                put("legajo", legajo)
                put("nombre", nombre)
                put("device_id_nuevo", deviceIdNuevo)
                put("device_id_actual", deviceIdActual)
                put("intentado_at", timestamp)
                put("revisado", false)
                put("resuelto", false)
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/registro_alertas")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .post(body)
                .build()
            val resp = client.newCall(request).execute()
            Log.d("COT", "Alerta acceso no autorizado insertada: ${resp.code} — legajo=$legajo device=$deviceIdNuevo")
        } catch (e: Exception) {
            Log.e("COT", "Error insertar alerta acceso: ${e.message}")
        }
    }

    suspend fun registrarDeviceId(legajo: String, deviceId: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply { put("device_id", deviceId) }
                val body = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$SUPABASE_URL/rest/v1/choferes?legajo=eq.$legajo")
                    .addHeader("apikey", SUPABASE_KEY)
                    .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                    .addHeader("Content-Type", "application/json")
                    .patch(body)
                    .build()
                val ok = client.newCall(request).execute().isSuccessful
                Log.d("COT", "Registrar device_id para $legajo: $ok")
                ok
            } catch (e: Exception) {
                Log.e("COT", "Error registrar device_id: ${e.message}")
                false
            }
        }

    suspend fun obtenerJornadaActiva(legajo: String): Jornada? = withContext(Dispatchers.IO) {
        try {
            val hoy = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                .format(java.util.Date())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/jornadas?legajo=eq.$legajo&fecha=gte.$hoy&select=order_number,fecha,legajo,data&order=fecha.desc&limit=1")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string() ?: return@withContext null
            val arr = JSONArray(body)
            if (arr.length() == 0) return@withContext null
            val obj = arr.getJSONObject(0)
            val dataObj = JSONObject(obj.optString("data", "{}"))
            if (dataObj.optBoolean("closed", false)) return@withContext null
            val orderNumber = obj.optString("order_number", "")
            val fecha = obj.optString("fecha", "")
            if (orderNumber.isEmpty() || fecha.isEmpty()) return@withContext null
            Jornada(
                orderNumber = orderNumber,
                legajo = obj.optString("legajo", legajo),
                fecha = fecha,
                status = "activa",
                syncStatus = "synced"
            )
        } catch (e: Exception) {
            Log.e("COT", "Error obtener jornada activa: ${e.message}")
            null
        }
    }

    suspend fun finalizarGuardiaEnSupabase(guardiaId: String, orderNumber: String, fin: String, hours: Double, kmGuardia: Double): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("p_guardia_id", guardiaId)
                    put("p_order_number", orderNumber)
                    put("p_fin", fin)
                    put("p_hours", hours)
                    put("p_km_guardia", kmGuardia)
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
      suspend fun cerrarJornadaEnSupabase(
    orderNumber: String,
    totales: LaudoCalculator.Totales,
    closedAt: Long
): Boolean = withContext(Dispatchers.IO) {
    try {
        val snapshot = JSONObject().apply {
            put("kmViajes", totales.kmViajes)
            put("kmGuardias", totales.kmGuardias)
            put("kmTomeCese", totales.kmTomeCese)
            put("kmAcoplados", totales.kmAcoplados)
            put("kmTotal", totales.kmTotal)
            put("viaticos", totales.viaticos)
            put("monto", totales.monto)
            put("cerradoAt", closedAt)
        }
        val json = JSONObject().apply {
            put("p_order_number", orderNumber)
            put("p_totals_snapshot", snapshot)
            put("p_closed_at", closedAt)
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$SUPABASE_URL/rest/v1/rpc/cerrar_jornada")
            .addHeader("apikey", SUPABASE_KEY)
            .addHeader("Authorization", "Bearer $SUPABASE_KEY")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        Log.d("COT", "Cerrar jornada Supabase: ${response.code}")
        response.isSuccessful
    } catch (e: Exception) {
        Log.e("COT", "Error cerrar jornada: ${e.message}")
        false
    }
}

    suspend fun obtenerMensajesPendientes(legajo: String): List<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/mensajes?para=eq.$legajo&leido=eq.false&select=id,tipo,data&order=creado_at.asc")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string() ?: return@withContext emptyList()
            val arr = JSONArray(body)
            (0 until arr.length()).map { arr.getJSONObject(it) }
        } catch (e: Exception) {
            Log.e("COT", "Error obtener mensajes pendientes: ${e.message}")
            emptyList()
        }
    }

    suspend fun buscarPerfilPorDeviceId(deviceId: String): PerfilChofer? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/choferes?device_id=eq.$deviceId&select=legajo,nombre,base,tipo&limit=1")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string() ?: return@withContext null
            val arr = JSONArray(body)
            if (arr.length() == 0) return@withContext null
            val obj = arr.getJSONObject(0)
            val legajo = obj.optString("legajo", "")
            if (legajo.isEmpty()) return@withContext null
            PerfilChofer(
                legajo = legajo,
                nombre = obj.optString("nombre", ""),
                base = obj.optString("base", ""),
                tipo = obj.optString("tipo", "efectivo")
            )
        } catch (e: Exception) {
            Log.e("COT", "Error buscar perfil por device_id: ${e.message}")
            null
        }
    }

    suspend fun obtenerTotalesJornadaSupabase(orderNumber: String): LaudoCalculator.Totales? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/jornadas?order_number=eq.$orderNumber&select=data&limit=1")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string()
            Log.d("COT", "obtenerTotalesJornada: orderNumber=$orderNumber body=$body")
            if (body == null) return@withContext null
            val arr = JSONArray(body)
            Log.d("COT", "obtenerTotalesJornada: arr.length=${arr.length()}")
            if (arr.length() == 0) return@withContext null
            val dataObj = arr.getJSONObject(0).optJSONObject("data")
            Log.d("COT", "obtenerTotalesJornada: dataObj=$dataObj")
            if (dataObj == null) return@withContext null
            val snap = dataObj.optJSONObject("totalsSnapshot")
            Log.d("COT", "obtenerTotalesJornada: totalsSnapshot=$snap")
            if (snap == null) return@withContext null
            LaudoCalculator.Totales(
                kmViajes = snap.optDouble("kmViajes", 0.0),
                kmAcoplados = snap.optDouble("kmAcoplados", 0.0),
                kmGuardias = snap.optDouble("kmGuardias", 0.0),
                kmTomeCese = snap.optDouble("kmTomeCese", 0.0),
                kmTotal = snap.optDouble("kmTotal", 0.0),
                monto = snap.optDouble("monto", 0.0),
                viaticos = snap.optInt("viaticos", 0)
            )
        } catch (e: Exception) {
            Log.e("COT", "Error obtener totales desde Supabase: ${e.message}")
            null
        }
    }

    suspend fun obtenerJornadasCerradas(legajo: String): JornadasCerradasResult = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/jornadas?legajo=eq.$legajo&order=fecha.desc&limit=30&select=order_number,fecha,legajo,data")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string()
                ?: return@withContext JornadasCerradasResult(emptyList(), emptyList())
            val arr = JSONArray(body)
            val result = mutableListOf<Jornada>()
            val closedArr = JSONArray()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val dataObj = obj.optJSONObject("data") ?: continue
                if (!dataObj.optBoolean("closed", false)) continue
                val orderNumber = obj.optString("order_number", "")
                val fecha = obj.optString("fecha", "")
                if (orderNumber.isEmpty() || fecha.isEmpty()) continue
                val snapshot = dataObj.optJSONObject("totalsSnapshot")
                val closedAt = snapshot?.optLong("cerradoAt", 0L) ?: 0L
                result.add(
                    Jornada(
                        orderNumber = orderNumber,
                        legajo = obj.optString("legajo", legajo),
                        fecha = fecha,
                        status = "cerrada",
                        syncStatus = "synced",
                        closedAt = if (closedAt > 0L) closedAt else null,
                        horaInicio = dataObj.optString("horaInicio", ""),
                        kmTotal = snapshot?.optDouble("kmTotal", 0.0) ?: 0.0,
                        monto = snapshot?.optDouble("monto", 0.0) ?: 0.0,
                        kmViajes = snapshot?.optDouble("kmViajes", 0.0) ?: 0.0,
                        kmAcoplados = snapshot?.optDouble("kmAcoplados", 0.0) ?: 0.0,
                        kmGuardias = snapshot?.optDouble("kmGuardias", 0.0) ?: 0.0,
                        kmTomeCese = snapshot?.optDouble("kmTomeCese", 0.0) ?: 0.0,
                        viaticos = snapshot?.optInt("viaticos", 0) ?: 0
                    )
                )
                closedArr.put(obj)
            }
            val viajes = parsearViajes(closedArr)
            Log.d("COT", "Jornadas cerradas sincronizadas: ${result.size}, viajes: ${viajes.size}")
            JornadasCerradasResult(result, viajes)
        } catch (e: Exception) {
            Log.e("COT", "Error obtener jornadas cerradas: ${e.message}")
            JornadasCerradasResult(emptyList(), emptyList())
        }
    }

    suspend fun marcarMensajeLeido(mensajeId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply { put("leido", true) }
                .toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/mensajes?id=eq.$mensajeId")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .patch(body)
                .build()
            client.newCall(request).execute().isSuccessful
        } catch (e: Exception) {
            Log.e("COT", "Error marcar mensaje leido: ${e.message}")
            false
        }
    }

    suspend fun registrarChofer(
        legajo: String,
        nombre: String,
        base: String,
        tipo: String,
        deviceId: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("legajo", legajo)
                put("nombre", nombre)
                put("base", base)
                put("tipo", tipo)
                put("device_id", deviceId)
                put("empresa_id", "cot")
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/choferes")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .post(body)
                .build()
            val response = client.newCall(request).execute()
            Log.d("COT", "Registrar chofer: ${response.code}")
            response.code == 201
        } catch (e: Exception) {
            Log.e("COT", "Error registrar chofer: ${e.message}")
            false
        }
    }

    suspend fun getConfiguracion(): Map<String, Double> = withContext(Dispatchers.IO) {
        val cached = configCache
        if (cached != null && (System.currentTimeMillis() - configCacheTimestamp) < CONFIG_TTL_MS) {
            return@withContext cached
        }
        try {
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/configuracion?select=clave,valor")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .get()
                .build()
            val body = client.newCall(request).execute().body?.string()
                ?: return@withContext (cached ?: emptyMap())
            val arr = JSONArray(body)
            val map = mutableMapOf<String, Double>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val clave = obj.optString("clave", "")
                val valor = obj.optDouble("valor", Double.NaN)
                if (clave.isNotEmpty() && !valor.isNaN()) map[clave] = valor
            }
            if (map.isNotEmpty()) {
                configCache = map
                configCacheTimestamp = System.currentTimeMillis()
                map
            } else {
                cached ?: emptyMap()
            }
        } catch (e: Exception) {
            Log.e("COT", "Error getConfiguracion: ${e.message}")
            cached ?: emptyMap()
        }
    }

    companion object {
        @Volatile
        private var configCache: Map<String, Double>? = null
        @Volatile
        private var configCacheTimestamp: Long = 0L
        const val CONFIG_TTL_MS = 5 * 60 * 1000L

        fun invalidarConfigCache() {
            configCache = null
        }
    }
}
