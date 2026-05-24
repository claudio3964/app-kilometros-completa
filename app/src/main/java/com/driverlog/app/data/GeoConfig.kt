
package com.driverlog.app.data

object GeoConfig {
    const val RADIO_METROS = 150.0
    const val TIEMPO_QUIETO_MS = 5 * 60 * 1000L
    const val MOVIMIENTO_MINIMO_M = 15.0
    const val COUNTDOWN_SEGUNDOS = 30
    const val TIEMPO_MINIMO_VIAJE_MS = 90 * 60 * 1000L
    const val DISTANCIA_MINIMA_ORIGEN_M = 500.0

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
        "Punta del Este"    to Terminal(-34.95738,   -54.938867, "Terminal Punta del Este"),
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

    fun resolver(destino: String): Terminal? {
        val d = destino.lowercase()
        return catalogo.entries.find { (key, _) ->
            d.contains(key.lowercase()) || key.lowercase().contains(d)
        }?.value
    }
}