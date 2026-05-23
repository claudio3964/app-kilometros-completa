package com.driverlog.app.data

import androidx.room.*

@Entity(tableName = "travel_stats")
data class TravelStat(
    @PrimaryKey val ruta: String,
    val totalViajes: Int = 0,
    val totalMinutos: Long = 0,
    val velocidadPromedio: Double = 0.0
)

@Dao
interface TravelStatDao {
    @Query("SELECT * FROM travel_stats WHERE ruta = :ruta LIMIT 1")
    suspend fun getStat(ruta: String): TravelStat?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarStat(stat: TravelStat)
}
