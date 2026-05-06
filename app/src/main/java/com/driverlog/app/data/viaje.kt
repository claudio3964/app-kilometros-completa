package com.driverlog.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "viajes")
data class Viaje(
    @PrimaryKey
    val id: String,
    val orderNumber: String,
    val origen: String,
    val destino: String,
    val departureTime: String,
    val arrivalTime: String,
    val status: String,          // programado | en_curso | finalizado
    val inicioProgramado: Long,  // timestamp ms
    val inicioReal: Long? = null,
    val finReal: Long? = null,
    val kmEmpresa: Int = 0,
    val kmAuto: Int = 0,
    val turno: String = "",
    val tipoServicio: String = "",
    val acoplado: Boolean = false,
    val acopladoKm: Int = 0,
    val coche: String? = null,
    val tomeCese: Boolean = false,
    val syncStatus: String = "local",  // local | synced | error
    val asignadoPorAdmin: Boolean = false,
    val notificado: Boolean = false
)
