package com.driverlog.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [Viaje::class, Guardia::class, Jornada::class, TravelStat::class],
    version = 12,
    exportSchema = false
)

abstract class CotDatabase : RoomDatabase() {

    abstract fun viajeDao(): ViajeDao
    abstract fun guardiaDao(): GuardiaDao
    abstract fun jornadaDao(): JornadaDao
    abstract fun travelStatDao(): TravelStatDao

    companion object {
        @Volatile
        private var INSTANCE: CotDatabase? = null

        fun getInstance(context: Context): CotDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CotDatabase::class.java,
                    "cot_driver_db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}