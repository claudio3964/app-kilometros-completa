package com.driverlog.app.data

import org.junit.Assert.*
import org.junit.Test

class SolapamientoValidatorTest {

    private val D = SolapamientoValidator.DURACION_VIAJE_DEFAULT_MS

    private fun t(h: Int, m: Int): Long = (h * 60L + m) * 60_000L

    private fun viaje(
        inicio: Long,
        status: String,
        inicioReal: Long? = null,
        finReal: Long? = null
    ) = Viaje(
        id = "V-$inicio-$status",
        orderNumber = "ON-1",
        origen = "Montevideo",
        destino = "Colonia",
        departureTime = "00:00",
        arrivalTime = "",
        status = status,
        inicioProgramado = inicio,
        inicioReal = inicioReal,
        finReal = finReal
    )

    // Caso 1: en_curso 22:10, nuevo 22:30 → ventanas [22:10, 01:10] y [22:30, 01:30] se pisan
    @Test
    fun `en_curso 22h10 solapa con nuevo a las 22h30`() {
        val existente = viaje(inicio = t(22, 10), status = "en_curso", inicioReal = t(22, 10))
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = t(22, 30),
            nuevaFin    = t(22, 30) + D,
            existentes  = listOf(existente)
        )
        assertNotNull("Debería detectar solapamiento", conflicto)
    }

    // Caso 2: en_curso 22:10, nuevo 01:30 día siguiente → ventanas [22:10, 01:10] y [25:30, 28:30] no se pisan
    @Test
    fun `en_curso 22h10 no solapa con nuevo a las 01h30 del dia siguiente`() {
        val inicio22h10 = t(22, 10)
        val inicio01h30 = t(25, 30)  // 01:30 siguiente día como ms relativos
        val existente = viaje(inicio = inicio22h10, status = "en_curso", inicioReal = inicio22h10)
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = inicio01h30,
            nuevaFin    = inicio01h30 + D,
            existentes  = listOf(existente)
        )
        assertNull("No debería detectar solapamiento", conflicto)
    }

    // Caso 3: nuevo.inicio == existente.fin exacto → borde NO solapa (estricto)
    @Test
    fun `borde exacto no solapa`() {
        val inicioExistente = t(22, 10)
        val finExistente = inicioExistente + D
        val existente = viaje(inicio = inicioExistente, status = "en_curso", inicioReal = inicioExistente)
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = finExistente,
            nuevaFin    = finExistente + D,
            existentes  = listOf(existente)
        )
        assertNull("El borde exacto no debería solapar", conflicto)
    }

    // Caso 4: cancelado se ignora aunque el horario choque
    @Test
    fun `cancelado se ignora aunque el horario choque`() {
        val inicio = t(22, 10)
        val cancelado = viaje(inicio = inicio, status = "cancelado", inicioReal = inicio)
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = t(22, 30),
            nuevaFin    = t(22, 30) + D,
            existentes  = listOf(cancelado)
        )
        assertNull("Cancelado no debe producir conflicto", conflicto)
    }

    // Caso 6: reproducción exacta del caso de campo 29/06
    // en_curso existente: inicioReal=inicioProgramado=1782773100000
    // nuevo programado: inicioProgramado=1782774000000 (+15 min), inicioReal=null
    // Debe detectar solapamiento
    @Test
    fun `caso campo 29jun en_curso solapa con nuevo programado 15min despues`() {
        val existente = viaje(
            inicio     = 1782773100000L,
            status     = "en_curso",
            inicioReal = 1782773100000L
        )
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = 1782774000000L,
            nuevaFin    = 1782774000000L + D,
            existentes  = listOf(existente)
        )
        assertNotNull("En_curso +15 min debe detectar solapamiento", conflicto)
    }

    // Caso 5: finalizado usa finReal, no inicioProgramado+3h
    // programado 20:00, finReal 21:00 → ventana real [20:00, 21:00]; nuevo [22:10, 01:10] → no choca
    // Sin finReal usaría inicio+3h=23:00, que sí chocaría con 22:10 — valida que usamos finReal
    @Test
    fun `finalizado usa finReal para determinar el fin de ventana`() {
        val inicioExistente = t(20, 0)
        val finRealExistente = t(21, 0)
        val finalizado = viaje(
            inicio     = inicioExistente,
            status     = "finalizado",
            inicioReal = inicioExistente,
            finReal    = finRealExistente
        )
        val conflicto = SolapamientoValidator.encontrarConflicto(
            nuevaInicio = t(22, 10),
            nuevaFin    = t(22, 10) + D,
            existentes  = listOf(finalizado)
        )
        assertNull("Finalizado con finReal antes del nuevo no debe solapar", conflicto)
    }
}
