package com.driverlog.app.data

object LaudoCalculator {

    private const val LAUDO_KM = 8.0122
    private const val GUARDIA_COMUN_KM_HORA = 30.0
    private const val GUARDIA_ESPECIAL_KM_HORA = 40.0
    private const val TOME_CESE_KM = 42.5
    private const val ACOPLADO_EXTRA_KM = 30.0
    private const val MONTO_VIATICO = 455.0

    data class Totales(
        val kmViajes: Double,
        val kmAcoplados: Double,
        val kmGuardias: Double,
        val kmTomeCese: Double,
        val kmTotal: Double,
        val monto: Double,
        val viaticos: Int
    )

    fun calcular(jornada: JornadaCompleta): Totales {
        var kmViajes = 0.0
        var kmAcoplados = 0.0
        var kmGuardias = 0.0

        jornada.travels.forEach { t ->
            if (t.status == "cancelado" || t.status == "programado") return@forEach
            kmViajes += t.kmEmpresa.toDouble()
            kmAcoplados += t.acopladoKm.toDouble()
        }

        jornada.guards.forEach { g ->
            val kmHora = if (g.type == "especial")
                GUARDIA_ESPECIAL_KM_HORA else GUARDIA_COMUN_KM_HORA
            kmGuardias += g.hours * kmHora
        }

        val kmTomeCese = if (jornada.travels.any {
                it.status != "cancelado" && it.status != "programado"
            }) TOME_CESE_KM else 0.0

        val kmTotal = kmViajes + kmAcoplados + kmGuardias + kmTomeCese
        val montoKm = kmTotal * LAUDO_KM
        val cantViaticos = determinarViatico(jornada)
        val montoViaticos = cantViaticos * MONTO_VIATICO

        return Totales(
            kmViajes = kmViajes,
            kmAcoplados = kmAcoplados,
            kmGuardias = kmGuardias,
            kmTomeCese = kmTomeCese,
            kmTotal = kmTotal,
            monto = montoKm + montoViaticos,
            viaticos = cantViaticos
        )
    }

    private fun calcularHorasJornada(jornada: JornadaCompleta): Double {
        var totalMinutos = 0L

        jornada.travels.forEach { t ->
            if (t.status == "finalizado") {
                totalMinutos += t.duracionMinutos ?: 0L
            }
        }

        jornada.guards.forEach { g ->
            if (g.inicio.isNotEmpty() && g.fin.isNotEmpty()) {
                val inicioMin = horaAMinutos(g.inicio)
                var finMin = horaAMinutos(g.fin)
                if (finMin < inicioMin) finMin += 24 * 60
                totalMinutos += (finMin - inicioMin)
            }
        }

        return totalMinutos / 60.0
    }

    private fun determinarViatico(jornada: JornadaCompleta): Int {
        val horasJornada = calcularHorasJornada(jornada)
        if (horasJornada <= 0) return 0

        val baseMs = java.text.SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()
        ).parse(jornada.fecha + "T00:00:00")?.time ?: return 0

        val eventosInicio = mutableListOf<Pair<Long, Boolean>>()
        val eventosFin = mutableListOf<Long>()

        jornada.travels.filter {
            it.status == "finalizado" && it.inicioReal != null && it.llegadaReal != null
        }.forEach { v ->
            eventosInicio.add(Pair(v.inicioReal!!, v.tomeCese))
            eventosFin.add(v.llegadaReal!!)
        }

        jornada.guards.forEach { g ->
            if (g.inicio.isEmpty()) return@forEach
            val inicioMin = horaAMinutos(g.inicio)
            val inicioMs = baseMs + inicioMin * 60 * 1000L
            val finMs = if (g.fin.isNotEmpty()) {
                var finMin = horaAMinutos(g.fin)
                if (finMin < inicioMin) finMin += 24 * 60
                baseMs + finMin * 60 * 1000L
            } else {
                System.currentTimeMillis()
            }
            eventosInicio.add(Pair(inicioMs, false))
            eventosFin.add(finMs)
        }

        if (eventosInicio.isEmpty()) return 0

        eventosInicio.sortBy { it.first }
        var inicioReal = eventosInicio[0].first
        val finReal = eventosFin.max()

        if (eventosInicio[0].second) inicioReal -= 45 * 60 * 1000L

        val cal = java.util.Calendar.getInstance().apply { timeInMillis = inicioReal }
        val anio = cal.get(java.util.Calendar.YEAR)
        val mes = cal.get(java.util.Calendar.MONTH)
        val dia = cal.get(java.util.Calendar.DAY_OF_MONTH)

        val franja14 = java.util.Calendar.getInstance().apply {
            set(anio, mes, dia, 14, 0, 0)
        }.timeInMillis

        val franja23 = java.util.Calendar.getInstance().apply {
            set(anio, mes, dia, 23, 0, 0)
        }.timeInMillis

        val tresYMedia = (3.5 * 60 * 60 * 1000).toLong()
        var viaticos = 0

        if (inicioReal <= franja14 && finReal >= franja14)
            if (franja14 - inicioReal >= tresYMedia) viaticos++

        if (inicioReal <= franja23 && finReal >= franja23)
            if (franja23 - inicioReal >= tresYMedia) viaticos++

        if (viaticos == 0 && horasJornada >= 9) viaticos = 1

        return viaticos
    }

    private fun horaAMinutos(hora: String): Int {
        val partes = hora.split(":")
        if (partes.size < 2) return 0
        return partes[0].toInt() * 60 + partes[1].toInt()
    }
}