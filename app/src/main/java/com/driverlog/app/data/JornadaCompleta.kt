package com.driverlog.app.data

data class JornadaCompleta(
    val orderNumber: String,
    val fecha: String,
    val legajo: String = "",
    val baseInicio: String = "Montevideo",
    val travels: List<Viaje> = emptyList(),
    val guards: List<Guardia> = emptyList(),
    val closed: Boolean = false,
    val tomeCeseGenerado: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
    val totalsSnapshot: TotalsSnapshot? = null
)

data class TotalsSnapshot(
    val kmViajes: Double,
    val kmGuardias: Double,
    val kmTomeCese: Double,
    val kmAcoplados: Double,
    val kmTotal: Double,
    val viaticos: Int,
    val monto: Double,
    val cerradoAt: Long
)