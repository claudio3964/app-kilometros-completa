package com.driverlog.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "guardias")
data class Guardia(
    @PrimaryKey val id: String,
    val dia: String = "",
    val inicio: String = "",
    val fin: String = "",
    val type: String = "comun",
    val hours: Double = 0.0,
    val status: String = "en_curso",
    val viatico: Boolean = false,
    val kmGuardia: Double = 0.0,
    val asignadoPorAdmin: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)