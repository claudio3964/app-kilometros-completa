package com.driverlog.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ViajeDao {

    @Query("""
    SELECT * FROM viajes 
    WHERE date(inicioProgramado / 1000, 'unixepoch') >= date('now')
    ORDER BY inicioProgramado ASC
""")
    fun getTodosLosViajes(): Flow<List<Viaje>>

    @Query("SELECT * FROM viajes WHERE status = 'programado' ORDER BY inicioProgramado ASC")
    fun getViajesProgramados(): Flow<List<Viaje>>

    @Query("SELECT * FROM viajes WHERE status = 'en_curso' LIMIT 1")
    suspend fun getViajeEnCurso(): Viaje?

    @Query("SELECT * FROM viajes WHERE id = :id")
    suspend fun getViajeById(id: String): Viaje?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarViaje(viaje: Viaje)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarViajes(viajes: List<Viaje>)

    @Update
    suspend fun actualizarViaje(viaje: Viaje)

    @Query("UPDATE viajes SET status = :status, inicioReal = :inicioReal WHERE id = :id")
    suspend fun activarViaje(id: String, status: String, inicioReal: Long)

    @Query("UPDATE viajes SET status = :status, finReal = :finReal WHERE id = :id")
    suspend fun finalizarViaje(id: String, status: String, finReal: Long)

    @Query("UPDATE viajes SET syncStatus = :syncStatus WHERE id = :id")
    suspend fun actualizarSyncStatus(id: String, syncStatus: String)

    @Query("SELECT * FROM viajes WHERE syncStatus = 'local'")
    suspend fun getViajesPendientesSync(): List<Viaje>

    @Query("DELETE FROM viajes WHERE id = :id")
    suspend fun eliminarViaje(id: String)

    @Query("DELETE FROM viajes")
    suspend fun eliminarTodos()
}
