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
    @Query("UPDATE viajes SET status = :status, inicioReal = :inicioReal, llegadaEstimada = :llegadaEstimada WHERE id = :id")
    suspend fun activarViajeConEstimacion(id: String, status: String, inicioReal: Long, llegadaEstimada: Long)

    @Query("UPDATE viajes SET status = :status, finReal = :finReal, cierreAutomatico = :cierreAutomatico WHERE id = :id")
    suspend fun finalizarViaje(id: String, status: String, finReal: Long, cierreAutomatico: Boolean)

    @Query("UPDATE viajes SET syncStatus = :syncStatus WHERE id = :id")
    suspend fun actualizarSyncStatus(id: String, syncStatus: String)

    @Query("SELECT * FROM viajes WHERE syncStatus = 'local'")
    suspend fun getViajesPendientesSync(): List<Viaje>

    @Query("DELETE FROM viajes WHERE id = :id")
    suspend fun eliminarViaje(id: String)

    @Query("DELETE FROM viajes")
    suspend fun eliminarTodos()

    @Query("UPDATE viajes SET status = 'cancelado' WHERE id = :id")
    suspend fun cancelarViaje(id: String)

    @Query("SELECT * FROM viajes WHERE orderNumber = :orderNumber ORDER BY inicioProgramado ASC")
    suspend fun getViajesPorJornada(orderNumber: String): List<Viaje>

    @Query("SELECT * FROM viajes WHERE inicioProgramado >= :desdeMs ORDER BY inicioProgramado ASC")
    suspend fun getViajesDesde(desdeMs: Long): List<Viaje>
    @Query("SELECT * FROM viajes WHERE status = 'finalizado' ORDER BY finReal ASC")
    suspend fun getViajesFinalizado(): List<Viaje>

}
