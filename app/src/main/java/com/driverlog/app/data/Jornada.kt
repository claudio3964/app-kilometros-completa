package com.driverlog.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "jornadas_local")
data class Jornada(
    @PrimaryKey val orderNumber: String,
    val legajo: String,
    val fecha: String,
    val status: String = "activa",
    val syncStatus: String = "pending",
    val createdAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
    val horaInicio: String = "",
    val kmTotal: Double = 0.0,
    val monto: Double = 0.0,
    val kmViajes: Double = 0.0,
    val kmAcoplados: Double = 0.0,
    val kmGuardias: Double = 0.0,
    val kmTomeCese: Double = 0.0,
    val viaticos: Int = 0
)