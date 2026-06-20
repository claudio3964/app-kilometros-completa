package com.driverlog.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_13_14 = object : Migration(13, 14) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE jornadas_local ADD COLUMN kmViajes REAL NOT NULL DEFAULT 0.0")
        db.execSQL("ALTER TABLE jornadas_local ADD COLUMN kmAcoplados REAL NOT NULL DEFAULT 0.0")
        db.execSQL("ALTER TABLE jornadas_local ADD COLUMN kmGuardias REAL NOT NULL DEFAULT 0.0")
        db.execSQL("ALTER TABLE jornadas_local ADD COLUMN kmTomeCese REAL NOT NULL DEFAULT 0.0")
        db.execSQL("ALTER TABLE jornadas_local ADD COLUMN viaticos INTEGER NOT NULL DEFAULT 0")
    }
}

@Database(
    entities = [Viaje::class, Guardia::class, Jornada::class, TravelStat::class],
    version = 14,
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
                    .addMigrations(MIGRATION_13_14)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}