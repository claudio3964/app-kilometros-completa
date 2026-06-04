package com.driverlog.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface JornadaDao {

    @Query("SELECT * FROM jornadas_local ORDER BY createdAt DESC")
    fun getTodasLasJornadas(): Flow<List<Jornada>>

    @Query("SELECT * FROM jornadas_local WHERE fecha = :fecha AND legajo = :legajo LIMIT 1")
    suspend fun getJornadaPorFecha(fecha: String, legajo: String): Jornada?

    @Query("SELECT * FROM jornadas_local WHERE status = 'activa' LIMIT 1")
    suspend fun getJornadaActiva(): Jornada?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarJornada(jornada: Jornada)

    @Query("UPDATE jornadas_local SET status = 'cerrada', closedAt = :closedAt, kmTotal = :kmTotal, monto = :monto, syncStatus = 'pending' WHERE orderNumber = :orderNumber")
    suspend fun cerrarJornada(orderNumber: String, closedAt: Long, kmTotal: Double, monto: Double)

    @Query("UPDATE jornadas_local SET syncStatus = 'synced' WHERE orderNumber = :orderNumber")
    suspend fun marcarSynced(orderNumber: String)

    @Query("SELECT * FROM jornadas_local WHERE syncStatus = 'pending'")
    suspend fun getJornadasPendientes(): List<Jornada>

    @Query("SELECT * FROM jornadas_local WHERE orderNumber = :orderNumber LIMIT 1")
    suspend fun getJornada(orderNumber: String): Jornada?
}