package com.driverlog.app.data

data class JornadaCompleta(
    val orderNumber: String,
    val fecha: String,
    val travels: List<Viaje>,
    val guards: List<Guardia>
)