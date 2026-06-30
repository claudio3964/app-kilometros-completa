package com.driverlog.app.data

sealed class CrearViajeResult {
    data class Exito(val viaje: Viaje) : CrearViajeResult()
    data class Solapamiento(val enConflicto: Viaje) : CrearViajeResult()
}

object SolapamientoValidator {

    const val DURACION_VIAJE_DEFAULT_MS = 3L * 60 * 60 * 1000  // 3 horas

    /**
     * Devuelve el primer viaje de la lista que se solapa con la ventana [nuevaInicio, nuevaFin).
     * Solapamiento estricto: a.inicio < b.fin && b.inicio < a.fin  (borde NO solapa).
     * Ignora cancelados. Finalizado usa finReal; fallback existeInicio+3h.
     */
    fun encontrarConflicto(
        nuevaInicio: Long,
        nuevaFin: Long,
        existentes: List<Viaje>
    ): Viaje? = existentes.firstOrNull { viaje ->
        if (viaje.status == "cancelado") return@firstOrNull false
        val existeInicio = viaje.inicioReal ?: viaje.inicioProgramado
        val existeFin = when (viaje.status) {
            "finalizado" -> viaje.finReal ?: (existeInicio + DURACION_VIAJE_DEFAULT_MS)
            else -> existeInicio + DURACION_VIAJE_DEFAULT_MS  // programado | en_curso
        }
        nuevaInicio < existeFin && existeInicio < nuevaFin
    }
}
