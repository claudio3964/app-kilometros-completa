package com.driverlog.app.data

object LaudoCalculator {

    private const val LAUDO_KM = 8.0122
    private const val GUARDIA_COMUN_KM_HORA = 30.0
    private const val GUARDIA_ESPECIAL_KM_HORA = 40.0
    private const val TOME_CESE_KM = 42.5
    private const val ACOPLADO_EXTRA_KM = 30.0
    private const val MONTO_VIATICO = 455.0

    private val TIPOS_CON_TOME_CESE = setOf(
        "TURNO", "SEMIDIRECTO", "DIRECTO", "DIRECTISIMO", "EXPRESO", "CONTRATADO"
    )
    private val TIPOS_CON_ACOPLADO = setOf("DIRECTO", "DIRECTISIMO")

    data class Totales(
        val kmViajes: Double = 0.0,
        val kmAcoplados: Double = 0.0,
        val kmGuardias: Double = 0.0,
        val kmTomeCese: Double = 0.0,
        val kmTotal: Double = 0.0,
        val monto: Double = 0.0,
        val viaticos: Int = 0
    )

    fun calcular(jornada: JornadaCompleta): Totales {
        // Si está cerrada y tiene snapshot, devolver snapshot
        val snap = jornada.totalsSnapshot
        if (jornada.closed && snap != null) {
            return Totales(
                kmViajes = snap.kmViajes,
                kmAcoplados = snap.kmAcoplados,
                kmGuardias = snap.kmGuardias,
                kmTomeCese = snap.kmTomeCese,
                kmTotal = snap.kmTotal,
                monto = snap.monto,
                viaticos = snap.viaticos
            )
        }

        // Viajes válidos (no cancelados, no programados)
        val viajesValidos = jornada.travels.filter {
            it.status != "cancelado" && it.status != "programado"
        }

        // Km viajes
        var kmViajes = 0.0
        viajesValidos.forEach { v ->
            kmViajes += (v.kmEmpresa.takeIf { it > 0 } ?: v.kmAuto).toDouble()
        }

        // Km acoplados
        var kmAcoplados = 0.0
        viajesValidos.forEach { v ->
            if (v.acopladoKm > 0) {
                kmAcoplados += v.acopladoKm.toDouble()
            } else if (v.acoplado) {
                kmAcoplados += calcularAcopladoKm(v.tipoServicio, v.destino)
            }
        }

        // Km guardias
        var kmGuardias = 0.0
        jornada.guards.forEach { g ->
            val kmHora = if (g.type == "especial") GUARDIA_ESPECIAL_KM_HORA else GUARDIA_COMUN_KM_HORA
            kmGuardias += g.hours * kmHora
        }

        // Tome y cese — solo si hay viaje válido con tipo que lo permite
        val kmTomeCese = if (viajesValidos.any {
                TIPOS_CON_TOME_CESE.contains(it.tipoServicio.uppercase().trim())
            }) TOME_CESE_KM else 0.0

        // Total km
        val kmTotal = kmViajes + kmAcoplados + kmGuardias + kmTomeCese

        // Viáticos
        val cantViaticos = determinarViatico(jornada)

        // Monto
        val monto = kmTotal * LAUDO_KM + cantViaticos * MONTO_VIATICO

        return Totales(
            kmViajes = kmViajes,
            kmAcoplados = kmAcoplados,
            kmGuardias = kmGuardias,
            kmTomeCese = kmTomeCese,
            kmTotal = kmTotal,
            monto = monto,
            viaticos = cantViaticos
        )
    }

    private fun calcularAcopladoKm(tipoServicio: String, destino: String): Double {
        val tipo = tipoServicio.uppercase().trim()
        if (!TIPOS_CON_ACOPLADO.contains(tipo)) return 0.0
        val dest = destino.lowercase().trim()
        return when {
            dest == "chuy" -> 0.0
            dest.contains("la pedrera") -> 37.5
            else -> ACOPLADO_EXTRA_KM
        }
    }

    private fun calcularHorasJornada(jornada: JornadaCompleta): Double {
        var totalMinutos = 0L

        jornada.travels.forEach { t ->
            if (t.status == "finalizado" && t.inicioReal != null && t.finReal != null) {
                totalMinutos += (t.finReal - t.inicioReal) / 60000
            }
        }

        jornada.guards.forEach { g ->
            if (g.inicio.isNotEmpty() && g.fin.isNotEmpty()) {
                val ini = horaAMinutos(g.inicio)
                var fin = horaAMinutos(g.fin)
                if (fin < ini) fin += 24 * 60
                totalMinutos += (fin - ini)
            }
        }

        return totalMinutos / 60.0
    }

    private fun determinarViatico(jornada: JornadaCompleta): Int {
        val horasJornada = calcularHorasJornada(jornada)
        if (horasJornada <= 0) return 0

        val fechaBase = try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            sdf.parse(jornada.fecha)?.time ?: return 0
        } catch (e: Exception) { return 0 }

        // Eventos de inicio y fin
        data class Evento(val timestamp: Long, val tomeCese: Boolean)
        val eventosInicio = mutableListOf<Evento>()
        val eventosFin = mutableListOf<Long>()

        jornada.travels.filter { it.status == "finalizado" && it.inicioReal != null && it.finReal != null }
            .forEach { v ->
                eventosInicio.add(Evento(v.inicioReal!!, v.tomeCese))
                eventosFin.add(v.finReal!!)
            }

        jornada.guards.forEach { g ->
            if (g.inicio.isEmpty()) return@forEach
            val ini = horaAMinutos(g.inicio)
            var finMin = if (g.fin.isNotEmpty()) horaAMinutos(g.fin) else {
                val ahora = System.currentTimeMillis()
                ((ahora - fechaBase) / 60000).toInt()
            }
            if (finMin < ini) finMin += 24 * 60
            val inicioMs = fechaBase + ini * 60000L
            val finMs = fechaBase + finMin * 60000L
            eventosInicio.add(Evento(inicioMs, false))
            eventosFin.add(finMs)
        }

        if (eventosInicio.isEmpty()) return 0

        eventosInicio.sortBy { it.timestamp }
        var inicioReal = eventosInicio.first().timestamp
        val finReal = eventosFin.max()

        // Aplicar tome y cese si corresponde
        if (eventosInicio.first().tomeCese) {
            inicioReal -= 45 * 60 * 1000L
        }

        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = inicioReal

        val franja14 = java.util.Calendar.getInstance().apply {
            timeInMillis = inicioReal
            set(java.util.Calendar.HOUR_OF_DAY, 14)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis

        val franja23 = java.util.Calendar.getInstance().apply {
            timeInMillis = inicioReal
            set(java.util.Calendar.HOUR_OF_DAY, 23)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis

        val tresYMedia = 3.5 * 60 * 60 * 1000L
        var viaticos = 0

        if (inicioReal <= franja14 && finReal >= franja14) {
            if (franja14 - inicioReal >= tresYMedia) viaticos++
        }

        if (inicioReal <= franja23 && finReal >= franja23) {
            if (franja23 - inicioReal >= tresYMedia) viaticos++
        }

        if (viaticos == 0 && horasJornada >= 9) viaticos = 1

        return viaticos
    }

    private fun horaAMinutos(hora: String): Int {
        return try {
            val partes = hora.split(":")
            partes[0].toInt() * 60 + partes[1].toInt()
        } catch (e: Exception) { 0 }
    }
}