package com.driverlog.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface GuardiaDao {

    @Query("SELECT * FROM guardias ORDER BY createdAt DESC")
    fun getTodasLasGuardias(): Flow<List<Guardia>>

    @Query("SELECT * FROM guardias WHERE status = 'en_curso' LIMIT 1")
    suspend fun getGuardiaEnCurso(): Guardia?

    @Query("SELECT * FROM guardias WHERE dia = :dia ORDER BY createdAt ASC")
    suspend fun getGuardiasPorDia(dia: String): List<Guardia>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarGuardia(guardia: Guardia)

    @Query("UPDATE guardias SET status = :status, fin = :fin, hours = :hours, kmGuardia = :kmGuardia WHERE id = :id")
    suspend fun finalizarGuardia(id: String, status: String, fin: String, hours: Double, kmGuardia: Double)

    @Query("SELECT * FROM guardias WHERE id = :id")
    suspend fun getGuardiaById(id: String): Guardia?

    @Query("SELECT * FROM guardias WHERE orderNumber = :orderNumber ORDER BY createdAt ASC")
    suspend fun getGuardiasPorJornada(orderNumber: String): List<Guardia>


}