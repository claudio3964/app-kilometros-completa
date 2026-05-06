package com.driverlog.app.data

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*

class GeoTerminalService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    private var viajeId: String = ""
    private var destino: String = ""
    private var inicioReal: Long = 0L
    private var terminal: TerminalesGPS.Terminal? = null

    // Estado interno
    private var posicionOrigen: Location? = null
    private var maxDistanciaOrigen = 0.0
    private var ultimaPosicion: Location? = null
    private var tiempoQuieto: Long? = null
    private var cierreEnCurso = false

    // Modo prueba
    private var modoPrueba = false
    private var radioActivo = GeoConfig.RADIO_METROS
    private var tiempoQuietoActivo = GeoConfig.TIEMPO_QUIETO_MS

    companion object {
        const val CHANNEL_ID = "geo_terminal_channel"
        const val NOTIF_ID = 1001
        const val TAG = "COT_GEO"

        const val EXTRA_VIAJE_ID = "viaje_id"
        const val EXTRA_DESTINO = "destino"
        const val EXTRA_INICIO_REAL = "inicio_real"
        const val EXTRA_MODO_PRUEBA = "modo_prueba"

        fun iniciar(context: Context, viaje: Viaje, modoPrueba: Boolean = false) {
            val intent = Intent(context, GeoTerminalService::class.java).apply {
                putExtra(EXTRA_VIAJE_ID, viaje.id)
                putExtra(EXTRA_DESTINO, viaje.destino)
                putExtra(EXTRA_INICIO_REAL, viaje.inicioProgramado)
                putExtra(EXTRA_MODO_PRUEBA, modoPrueba)
            }
            context.startForegroundService(intent)
        }

        fun detener(context: Context) {
            context.stopService(Intent(context, GeoTerminalService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        crearCanalNotificacion()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        viajeId    = intent?.getStringExtra(EXTRA_VIAJE_ID) ?: ""
        destino    = intent?.getStringExtra(EXTRA_DESTINO) ?: ""
        inicioReal = intent?.getLongExtra(EXTRA_INICIO_REAL, 0L) ?: 0L
        modoPrueba = intent?.getBooleanExtra(EXTRA_MODO_PRUEBA, false) ?: false

        radioActivo       = if (modoPrueba) GeoConfig.RADIO_PRUEBA else GeoConfig.RADIO_METROS
        tiempoQuietoActivo = if (modoPrueba) GeoConfig.TIEMPO_QUIETO_PRUEBA_MS else GeoConfig.TIEMPO_QUIETO_MS

        terminal = TerminalesGPS.resolver(destino)
        if (terminal == null) {
            Log.w(TAG, "Terminal no encontrada para: $destino")
            stopSelf()
            return START_NOT_STICKY
        }

        Log.d(TAG, "Iniciando geo → ${terminal!!.nombre} | prueba=$modoPrueba")
        startForeground(NOTIF_ID, crearNotificacion("Monitoreando llegada a ${terminal!!.nombre}"))
        iniciarGPS()
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun iniciarGPS() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 30_000L)
            .setMinUpdateDistanceMeters(10f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { procesarPosicion(it) }
            }
        }

        fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    private fun procesarPosicion(loc: Location) {
        val ahora = System.currentTimeMillis()
        val term = terminal ?: return

        // Registrar origen
        if (posicionOrigen == null) {
            posicionOrigen = loc
            Log.d(TAG, "Origen registrado: ${loc.latitude}, ${loc.longitude}")
        }

        // Distancia al origen
        val distOrigen = posicionOrigen!!.distanceTo(loc).toDouble()
        if (distOrigen > maxDistanciaOrigen) maxDistanciaOrigen = distOrigen

        // Distancia a terminal destino
        val termLoc = Location("").apply { latitude = term.lat; longitude = term.lng }
        val distTerminal = loc.distanceTo(termLoc).toDouble()
        val tiempoViaje = ahora - inicioReal

        Log.d(TAG, "terminal:${distTerminal.toInt()}m | origen_max:${maxDistanciaOrigen.toInt()}m | viaje:${tiempoViaje/60000}min")

        // REGLA 1: dentro del radio
        if (distTerminal > radioActivo) {
            tiempoQuieto = null
            ultimaPosicion = loc
            return
        }

        // REGLA 2: viaje lleva mínimo 90 min (salteada en modo prueba)
        if (!modoPrueba && tiempoViaje < GeoConfig.TIEMPO_MINIMO_VIAJE_MS) {
            val faltan = ((GeoConfig.TIEMPO_MINIMO_VIAJE_MS - tiempoViaje) / 60000)
            Log.d(TAG, "Regla 2: faltan ${faltan}min")
            ultimaPosicion = loc
            return
        }

        // REGLA 3: se alejó mínimo 500m del origen (salteada en modo prueba)
        if (!modoPrueba && maxDistanciaOrigen < GeoConfig.DISTANCIA_MINIMA_ORIGEN_M) {
            Log.d(TAG, "Regla 3: max alejamiento ${maxDistanciaOrigen.toInt()}m")
            ultimaPosicion = loc
            return
        }

        // REGLA 4: quieto 5 minutos dentro del radio
        if (ultimaPosicion == null) {
            ultimaPosicion = loc
            tiempoQuieto = ahora
            Log.d(TAG, "En radio — iniciando timer quieto")
            return
        }

        val movimiento = ultimaPosicion!!.distanceTo(loc).toDouble()
        ultimaPosicion = loc

        if (movimiento > GeoConfig.MOVIMIENTO_MINIMO_M) {
            tiempoQuieto = ahora
            Log.d(TAG, "Movimiento ${movimiento.toInt()}m — timer reseteado")
            return
        }

        if (tiempoQuieto == null) tiempoQuieto = ahora
        val quietoMs = ahora - tiempoQuieto!!
        Log.d(TAG, "Quieto: ${quietoMs/60000}min ${(quietoMs%60000)/1000}s")

        // 4 REGLAS CUMPLIDAS
        if (quietoMs >= tiempoQuietoActivo && !cierreEnCurso) {
            cierreEnCurso = true
            Log.d(TAG, "✅ 4/4 reglas — disparando cierre")
            dispararCierre()
        }
    }

    private fun dispararCierre() {
        scope.launch {
            val repo = ViajeRepository(applicationContext)
            repo.finalizarViaje(viajeId)
            Log.d(TAG, "Viaje $viajeId finalizado automáticamente")

            // Notificar a la UI
            val intent = Intent("com.driverlog.VIAJE_FINALIZADO").apply {
                putExtra("viaje_id", viajeId)
                putExtra("destino", destino)
            }
            sendBroadcast(intent)
            stopSelf()
        }
    }

    private fun crearCanalNotificacion() {
        val channel = NotificationChannel(
            CHANNEL_ID, "GPS Monitoreo", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Monitoreo de llegada a terminal" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun crearNotificacion(texto: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("COT Driver")
            .setContentText(texto)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        fusedClient.removeLocationUpdates(locationCallback)
        scope.cancel()
        Log.d(TAG, "GeoTerminalService detenido")
    }
}
