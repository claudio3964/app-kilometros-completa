package com.driverlog.app.data

object GeoConfig {
    const val RADIO_METROS = 300.0
    const val TIEMPO_QUIETO_MS = 20 * 1000L
    const val MOVIMIENTO_MINIMO_M = 25.0
    const val COUNTDOWN_SEGUNDOS = 30
    const val TIEMPO_MINIMO_VIAJE_MS = 90 * 60 * 1000L
    const val DISTANCIA_MINIMA_ORIGEN_M = 500.0
    const val PRECISION_MINIMA_M  = 50.0
    const val MARGEN_APROX_MS    = 20 * 60 * 1000L   // escala 20 min antes de la estimada
    const val APROX_DISTANCIA_M  = 20_000.0          // o a 20 km de la terminal
    const val INTERVALO_BAJO_MS  = 90_000L           // muestreo en crucero (90s)
    const val CHECKPOINT_RADIO_M = 5_000.0           // radio por defecto de un checkpoint de corredor
    const val GEO_BUILD = "bateria-v1-2026-06-08"
    // Modo prueba
    const val RADIO_PRUEBA = 50.0
    const val TIEMPO_QUIETO_PRUEBA_MS = 15 * 1000L
    const val MOVIMIENTO_MINIMO_PRUEBA_M = 60.0
    const val PRUEBA_LAT = -34.8089
    const val PRUEBA_LNG = -56.1331
}

object TerminalesGPS {
    data class Terminal(val lat: Double, val lng: Double, val nombre: String)

    val catalogo = mapOf(
        "Montevideo"        to Terminal(-34.894149,  -56.167112, "Terminal Tres Cruces"),
        "MVDEO"             to Terminal(-34.894149,  -56.167112, "Terminal Tres Cruces"),
        "Punta del Este"    to Terminal(-34.956996,  -54.939091, "Terminal Punta del Este"),
        "Colonia"           to Terminal(-34.4726414, -57.8425142,"Terminal Colonia"),
        "Piriápolis"        to Terminal(-34.8613073, -55.2746958,"Terminal Piriápolis"),
        "La Paloma"         to Terminal(-34.6565574, -54.159223, "Terminal La Paloma"),
        "La Pedrera"        to Terminal(-34.5920808, -54.1326961,"Terminal La Pedrera"),
        "Chuy"              to Terminal(-33.7012,    -53.453986, "Terminal Chuy"),
        "Rocha"             to Terminal(-34.4833,    -54.3333,   "Terminal Rocha"),
        "Maldonado"         to Terminal(-34.9024,    -54.9576,   "Terminal Maldonado"),
        "San Carlos"        to Terminal(-34.7977,    -54.9154,   "Terminal San Carlos"),
        "Laguna Garzón"     to Terminal(-34.7200,    -54.6500,   "Parada Laguna Garzón"),
        "Aguas Dulces"      to Terminal(-33.9667,    -53.5500,   "Parada Aguas Dulces"),
        "Punta del Diablo"  to Terminal(-33.9167,    -53.5500,   "Parada Punta del Diablo"),
        "Prueba" to Terminal(-34.8089, -56.1331, "Terminal Prueba"),
    )

    object CheckpointsGPS {

        // Punto de APROXIMACIÓN por corredor (ruta × sentido). Solo DESPIERTA el GPS;
        // el cierre lo sigue haciendo la terminal de destino (TerminalesGPS).
        // radioM = cuán cerca del checkpoint hay que estar para escalar a alta precisión.
        // OJO: el punto que elijas define cuánto "runway" de alta precisión queda hasta
        // el destino. Un checkpoint lejos del destino (Juan Lacaze) despierta temprano
        // (más seguro, menos ahorro); uno cerca (barrio El General, en Colonia) despierta
        // tarde (más ahorro, menos margen). Es la perilla para tunear por corredor.
        data class Checkpoint(
            val lat: Double,
            val lng: Double,
            val nombre: String,
            val radioM: Double = GeoConfig.CHECKPOINT_RADIO_M
        )

        // Clave = origen→destino normalizado a 3 letras MAYÚS (igual que el sufijo del id
        // y que ts_cod_lugar en Supabase): "Montevideo"->MON, "Colonia"->COL, etc.
        private val catalogo = mapOf(
            // ── Corredor Colonia ────────────────────────────────────────────────
            // TODO: poné las coords EXACTAS desde Google Maps (click derecho → copiar).
            // Las de abajo son aproximadas, ajustalas antes de confiar en campo.
            "MON-COL" to Checkpoint(-34.4300, -57.4500, "Radial Juan Lacaze"), // ida
            "COL-MON" to Checkpoint(-34.8600, -56.2000, "Plaza Cuba"),         // vuelta

            // ── Este (Punta y alrededores) ──────────────────────────────────────
            // Sin checkpoint a propósito: caen a la terminal de destino, que en la
            // práctica es el embudo de Maldonado. Funciona hoy, no hay que tocar.

            // ── Para agregar más adelante (placeholders, NO activos) ────────────
            // "MON-CHU" to Checkpoint(lat, lng, "Entrada Barra del Chuy"),
            // "CHU-MON" to Checkpoint(lat, lng, "..."),
            // "MON-PAL" to Checkpoint(lat, lng, "Terminal Rocha"),   // La Paloma
            // "MON-PED" to Checkpoint(lat, lng, "Terminal Rocha"),   // La Pedrera
            // "MON-AGU" to Checkpoint(lat, lng, "Cabo Polonio"),     // Aguas Dulces
        )

        private fun cod(s: String) = s.trim().uppercase().take(3)

        fun resolver(origen: String, destino: String): Checkpoint? {
            if (origen.isBlank() || destino.isBlank()) return null
            return catalogo["${cod(origen)}-${cod(destino)}"]
        }
    }

    fun resolver(destino: String): Terminal? {
        val d = destino.trim().lowercase()
        if (d.isEmpty()) return null
        return catalogo.entries.find { (key, _) ->
            val k = key.lowercase()
            d.contains(k) || k.contains(d)
        }?.value
    }
}