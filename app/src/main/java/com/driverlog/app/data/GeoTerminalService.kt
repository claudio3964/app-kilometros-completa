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
    private var origen: String = ""                 // NUEVO
    private var destino: String = ""
    private var inicioReal: Long = 0L
    private var llegadaEstimada: Long = 0L          // NUEVO: ms epoch, 0 = sin estimada
    private var terminal: TerminalesGPS.Terminal? = null
    private var puntoAprox: Location? = null        // NUEVO: checkpoint o terminal para escalar

    // Estado interno
    private var posicionOrigen: Location? = null
    private var maxDistanciaOrigen = 0.0
    private var ultimaPosicion: Location? = null
    private var tiempoQuieto: Long? = null
    private var cierreEnCurso = false

    // NUEVO: modo de potencia del GPS. false = bajo consumo (crucero),
    // true = alta precisión (aproximación + cierre).
    private var modoAlta = false

    // Modo prueba
    private var modoPrueba = false
    private var radioActivo = GeoConfig.RADIO_METROS
    private var tiempoQuietoActivo = GeoConfig.TIEMPO_QUIETO_MS

    companion object {
        const val CHANNEL_ID = "geo_terminal_channel"
        const val NOTIF_ID = 1001
        const val TAG = "COT_GEO"

        const val EXTRA_VIAJE_ID = "viaje_id"
        const val EXTRA_ORIGEN = "origen"                       // NUEVO
        const val EXTRA_DESTINO = "destino"
        const val EXTRA_INICIO_REAL = "inicio_real"
        const val EXTRA_LLEGADA_ESTIMADA = "llegada_estimada"   // NUEVO
        const val EXTRA_MODO_PRUEBA = "modo_prueba"

        // Versión con objeto Viaje — la que ya usabas, ahora delega
        fun iniciar(context: Context, viaje: Viaje, modoPrueba: Boolean = false) {
            iniciar(
                context,
                viaje.id,
                viaje.origen,                          // NUEVO
                viaje.destino,
                viaje.inicioReal ?: viaje.inicioProgramado,
                viaje.llegadaEstimada ?: 0L,           // NUEVO
                modoPrueba
            )
        }

        // Versión nueva con campos sueltos — la que usa el ActivarViajeWorker
        fun iniciar(
            context: Context,
            viajeId: String,
            origen: String,                            // NUEVO
            destino: String,
            inicioReal: Long,
            llegadaEstimada: Long = 0L,                // NUEVO
            modoPrueba: Boolean = false
        ) {
            val intent = Intent(context, GeoTerminalService::class.java).apply {
                putExtra(EXTRA_VIAJE_ID, viajeId)
                putExtra(EXTRA_ORIGEN, origen)                      // NUEVO
                putExtra(EXTRA_DESTINO, destino)
                putExtra(EXTRA_INICIO_REAL, inicioReal)
                putExtra(EXTRA_LLEGADA_ESTIMADA, llegadaEstimada)   // NUEVO
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
        // Notificación inmediata en onCreate — antes de que Honor pueda matar el servicio
        startForeground(NOTIF_ID, crearNotificacion("COT Driver — GPS activo"))
        // Marcador de versión: si ves esto en el logcat, el APK tiene los cambios.
        Log.d(TAG, "GeoTerminalService build=${GeoConfig.GEO_BUILD}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            Log.w(TAG, "onStartCommand con intent null — sin datos de viaje")
            return START_REDELIVER_INTENT
        }
        viajeId         = intent?.getStringExtra(EXTRA_VIAJE_ID) ?: ""
        origen          = intent?.getStringExtra(EXTRA_ORIGEN) ?: ""              // NUEVO
        destino         = intent?.getStringExtra(EXTRA_DESTINO) ?: ""
        inicioReal      = intent?.getLongExtra(EXTRA_INICIO_REAL, 0L) ?: 0L
        llegadaEstimada = intent?.getLongExtra(EXTRA_LLEGADA_ESTIMADA, 0L) ?: 0L  // NUEVO
        modoPrueba      = intent?.getBooleanExtra(EXTRA_MODO_PRUEBA, false) ?: false

        radioActivo        = if (modoPrueba) GeoConfig.RADIO_PRUEBA else GeoConfig.RADIO_METROS
        tiempoQuietoActivo = if (modoPrueba) GeoConfig.TIEMPO_QUIETO_PRUEBA_MS else GeoConfig.TIEMPO_QUIETO_MS

        terminal = TerminalesGPS.resolver(destino)
        if (terminal == null) {
            Log.w(TAG, "Terminal no encontrada para: $destino")
            stopSelf()
            return START_NOT_STICKY
        }

        // NUEVO: punto para la escalada por distancia.
        // Checkpoint del corredor si existe; si no, la terminal de destino (como hoy).
        val cp = TerminalesGPS.CheckpointsGPS.resolver(origen, destino)
        puntoAprox = if (cp != null) {
            Log.d(TAG, "Checkpoint de corredor: ${cp.nombre}")
            Location("").apply { latitude = cp.lat; longitude = cp.lng }
        } else {
            Log.d(TAG, "Sin checkpoint — uso terminal ${terminal!!.nombre} para aproximación")
            Location("").apply { latitude = terminal!!.lat; longitude = terminal!!.lng }
        }

        // NUEVO: modo inicial. Prueba o estimada inminente -> alta; si no, crucero.
        modoAlta = modoPrueba ||
                (llegadaEstimada > 0 &&
                        System.currentTimeMillis() >= llegadaEstimada - GeoConfig.MARGEN_APROX_MS)

        Log.d(TAG, "Iniciando geo -> ${terminal!!.nombre} | prueba=$modoPrueba | " +
                "estimada=${if (llegadaEstimada > 0) llegadaEstimada.toString() else "-"} | " +
                "modoInicial=${if (modoAlta) "ALTA" else "BAJO"}")

        // Actualizar notificación con el estado real
        val notifManager = getSystemService(NotificationManager::class.java)
        notifManager.notify(NOTIF_ID, crearNotificacion(textoNotif()))

        iniciarGPS(modoAlta)
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun iniciarGPS(alta: Boolean) {
        if (::locationCallback.isInitialized) {
            fusedClient.removeLocationUpdates(locationCallback)
        }

        val request = if (alta) {
            // ALTA PRECISIÓN — para detectar el cierre (igual que antes)
            val intervalo = if (modoPrueba) 5_000L else 30_000L
            val minDistancia = if (modoPrueba) 0f else 10f
            LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalo)
                .setMinUpdateDistanceMeters(minDistancia)
                .build()
        } else {
            // BAJO CONSUMO — crucero. Barato, no prende el chip GPS a full.
            LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, GeoConfig.INTERVALO_BAJO_MS)
                .setMinUpdateDistanceMeters(0f)
                .build()
        }

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { procesarPosicion(it) }
            }
        }

        fusedClient.requestLocationUpdates(request, locationCallback, Looper.myLooper() ?: Looper.getMainLooper())
        Log.d(TAG, "GPS en modo ${if (alta) "ALTA" else "BAJO"}")
    }

    private fun procesarPosicion(loc: Location) {
        val ahora = System.currentTimeMillis()
        val term = terminal ?: return

        // CAPA 1/2/3: ESCALADA (solo modo bajo, antes del filtro de precisión)
        if (!modoAlta) {
            val ancla = puntoAprox ?: Location("").apply { latitude = term.lat; longitude = term.lng }
            val distAprox = loc.distanceTo(ancla).toDouble()

            val cercaPorTiempo = llegadaEstimada > 0 &&
                    ahora >= llegadaEstimada - GeoConfig.MARGEN_APROX_MS
            val cercaPorDistancia = distAprox <= GeoConfig.APROX_DISTANCIA_M

            if (cercaPorTiempo || cercaPorDistancia) {
                Log.d(TAG, "Escalando a ALTA - tiempo=$cercaPorTiempo distancia=${distAprox.toInt()}m")
                modoAlta = true
                getSystemService(NotificationManager::class.java)
                    .notify(NOTIF_ID, crearNotificacion(textoNotif()))
                iniciarGPS(alta = true)
            } else {
                Log.d(TAG, "Crucero - aproximacion a ${distAprox.toInt()}m, sin escalar")
            }
            return  // en modo bajo NO se evalúa el cierre
        }
        // MODO ALTA: lógica de cierre original, intacta

        if (loc.accuracy > GeoConfig.PRECISION_MINIMA_M) {
            Log.d(TAG, "Lectura descartada - precisión ${loc.accuracy}m")
            return
        }

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

        // REGLA 4: quieto dentro del radio
        if (ultimaPosicion == null) {
            ultimaPosicion = loc
            tiempoQuieto = ahora
            Log.d(TAG, "En radio - iniciando timer quieto")
            return
        }

        val movimiento = ultimaPosicion!!.distanceTo(loc).toDouble()
        ultimaPosicion = loc

        val umbralMovimiento = if (modoPrueba) GeoConfig.MOVIMIENTO_MINIMO_PRUEBA_M else GeoConfig.MOVIMIENTO_MINIMO_M
        if (movimiento > umbralMovimiento) {
            tiempoQuieto = ahora
            Log.d(TAG, "Movimiento ${movimiento.toInt()}m - timer reseteado")
            return
        }

        if (tiempoQuieto == null) tiempoQuieto = ahora
        val quietoMs = ahora - tiempoQuieto!!
        Log.d(TAG, "Quieto: ${quietoMs/60000}min ${(quietoMs%60000)/1000}s")

        // 4 REGLAS CUMPLIDAS
        if (quietoMs >= tiempoQuietoActivo && !cierreEnCurso) {
            cierreEnCurso = true
            Log.d(TAG, "4/4 reglas - disparando cierre")
            dispararCierre()
        }
    }

    private fun dispararCierre() {
        scope.launch {
            val repo = ViajeRepository(applicationContext)
            repo.finalizarViaje(viajeId, cierreAutomatico = true)
            Log.d(TAG, "Viaje $viajeId finalizado automáticamente")

            // Notificar a la UI
            val intent = Intent("com.driverlog.VIAJE_FINALIZADO").apply {
                putExtra("viaje_id", viajeId)
                putExtra("destino", destino)
                setPackage(packageName)
            }
            sendBroadcast(intent)
            stopSelf()
        }
    }

    // NUEVO: texto de notificación según el modo (se ve sin ADB, sin logcat)
    private fun textoNotif(): String {
        val term = terminal?.nombre ?: destino
        return if (modoAlta) "Monitoreando llegada a $term"
        else "En ruta a $term - GPS en ahorro"
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
        if (::locationCallback.isInitialized) {
            fusedClient.removeLocationUpdates(locationCallback)
        }
        scope.cancel()
        Log.d(TAG, "GeoTerminalService detenido")
    }
}