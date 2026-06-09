# CLAUDE.md
Crear dos archivos CLAUDE.md — uno en cada repo.

1. En C:\cot_dev\app_kilometros\app-kilometros-completa\CLAUDE.md:

# DriverLog — Instrucciones para Claude Code

## Leer siempre al iniciar sesión
- RUTAUY_CONTEXT.md — contexto general del sistema
- PLAN_DESARROLLO_KOTLIN.md — estado de sprints y pendientes

## Rutas clave de este repo (JS/Panel Admin)
- Panel admin: www/admin/index.html
- Catálogo rutas: www/routes_catalog.js
- Edge Functions: supabase/functions/
- Branch activo: dev-rebuild-core

## Stack
Vanilla JS + Supabase + Capacitor Android + Firebase FCM

2. En C:\cot_dev\app_kilometros\cot_devapp_kilometros-completa-android-koltin\CLAUDE.md:

# DriverLog Kotlin — Instrucciones para Claude Code

## Leer siempre al iniciar sesión
- RUTAUY_CONTEXT.md (en repo JS: C:\cot_dev\app_kilometros\app-kilometros-completa\)
- PLAN_DESARROLLO_KOTLIN.md (mismo directorio)
- MULTIEMPRESA.md — plan de desarrollo multi-empresa (Fase 1)

## Rutas clave de este repo (Android Kotlin)
- Package: com.driverlog.app
- ViajeRepository: app/src/main/java/com/driverlog/app/data/ViajeRepositoy.kt
- SupabaseService: app/src/main/java/com/driverlog/app/data/SupabaseService.kt
- LaudoCalculator: app/src/main/java/com/driverlog/app/data/LaudoCalculator.kt
- GeoTerminalService: app/src/main/java/com/driverlog/app/service/GeoTerminalService.kt
- MensajesPollingWorker: app/src/main/java/com/driverlog/app/worker/MensajesPollingWorker.kt
- MainScreen: app/src/main/java/com/driverlog/app/ui/theme/MainScreen.kt
- HistorialScreen: app/src/main/java/com/driverlog/app/ui/theme/HistorialScreen.kt
- GuardiasScreen: app/src/main/java/com/driverlog/app/ui/theme/GuardiasScreen.kt
- AppNavigation: app/src/main/java/com/driverlog/app/ui/theme/AppNavigation.kt
- Branch activo: main

## Stack
Android Kotlin + Supabase + Firebase FCM
Room para persistencia local

## Reglas
- Siempre leer el archivo antes de modificarlo
- Compilar con gradlew assembleDebug antes de commit
- No mezclar archivos de ambos repos en el mismo commit

Commit ambos archivos en sus repos y push.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Native Kotlin/Compose Android app for COT (Compañía Oriental de Transporte) bus drivers. Drivers use it to record their workday: trips (`viajes`), on-call shifts (`guardias`), and get their daily pay calculated automatically. See `RUTAUY_CONTEXT.md` for full business context, data schemas, and Supabase/FCM architecture.

## Build & run commands

```powershell
# Debug APK
.\gradlew assembleDebug

# Install on connected device
.\gradlew installDebug

# Unit tests
.\gradlew test

# Instrumented tests (device/emulator required)
.\gradlew connectedAndroidTest

# Lint
.\gradlew lint
```

## Architecture

### Data flow

`ViajeRepository` (`data/ViajeRepositoy.kt` — note the typo in filename) is the **single entry point** for all data operations. UI composables receive it as a parameter; no ViewModel layer exists. The repository orchestrates:

1. **Room** (`CotDatabase`, v10) — local persistence for `Viaje`, `Guardia`, `Jornada`, `TravelStat`
2. **SupabaseService** — HTTP calls via OkHttp with manual JSON (no official Supabase Kotlin SDK). All calls go to `frjeivfpldcigklwepqt.supabase.co`.
3. **WorkManager** workers — scheduled background tasks

### Room schema

`CotDatabase` uses `fallbackToDestructiveMigration()`. Any schema change (new column, renamed field) that bumps `version` will **wipe all local data** on the user's device. Increment version in `CotDatabase.kt` whenever entity classes change.

### Background workers

| Worker | Purpose |
|---|---|
| `GeoTerminalService` | Foreground GPS service. Monitors 4 conditions to auto-close a trip: within 300m radius, 90+ min elapsed, 500m+ from origin, 2 min stillness. Sends `com.driverlog.VIAJE_FINALIZADO` broadcast on close. |
| `MensajesPollingWorker` | Polls Supabase every 30s for admin messages. Handles `asignacion`, `guardia`, `cancelar_viaje`, `mensaje`, `urgente`. Re-enqueues itself after each run. Started in `CotApplication.onCreate()`. |
| `GuardiaTimerWorker` | Fires after 8h to prompt the driver to extend or close the guardia. |
| `ActivarViajeWorker` | Fires at `inicioProgramado` timestamp to transition a trip from `programado` → `en_curso`. |
| `CortarGuardiaWorker` | Cuts an active guardia 15 min before a scheduled trip starts. |

### Navigation & screens

`MainActivity` implements a 3-state login flow (no legajo → `LoginScreen`; no profile → `ProfileSetupScreen`; ready → `AppNavigation`). `AppNavigation` wraps a `NavHost` with 4 bottom-nav tabs: Home, Viajes, Guardias, Historial. Two modal routes: `nuevo_viaje` and `nueva_guardia`.

### Pay calculation (`LaudoCalculator`)

All monetary calculations live in `LaudoCalculator.calcular(JornadaCompleta)`. Key constants:

- Laudo rate: **$8.0122/km**
- Guardia común: **30 km/h**
- Guardia especial: **40 km/h**
- Tome y cese: **42.5 km** (only for TURNO, SEMIDIRECTO, DIRECTO, DIRECTISIMO, EXPRESO, CONTRATADO)
- Acoplado extra: **30 km** (only for DIRECTO, DIRECTISIMO, except Chuy)
- Viático: **$455** — triggered by working across 14:00 or 23:00 with 3.5h+ elapsed before the franja, or 9h+ total

When a `JornadaCompleta` is `closed` and has a `totalsSnapshot`, `LaudoCalculator` returns the snapshot directly without recalculating.

## Key patterns

**Supabase sync pattern**: Operations are always written to Room first, then synced to Supabase in a `try/catch` that logs errors but doesn't fail. Sync failures leave `syncStatus = "local"` (vs `"synced"`).

**Guardia finalization**: `finalizarGuardia()` in `ViajeRepository` computes `hours` from `createdAt` timestamp (not from `inicio` string), then derives `kmGuardia = hours × (40 if especial, else 30)`.

**Device security**: On login, `Android_ID` is stored as `device_id` in Supabase. At every app start, `MainActivity` compares saved vs current device ID — mismatch forces re-login.

**GPS mode prueba**: `GeoConfig` has separate constants for test mode (50m radius, 15s stillness, hardcoded Montevideo coords). Activated by passing `modoPrueba=true` to `GeoTerminalService.iniciar()`.

## Adding a terminal (GPS destination)

Add an entry to `TerminalesGPS.catalogo` in `data/GeoConfig.kt`. The `resolver()` function does case-insensitive substring matching both ways, so partial names work.

## Supabase RPC functions referenced

- `finalizar_guardia_en_jornada` — called by `finalizarGuardiaEnSupabase()`; expects `p_guardia_id`, `p_order_number`, `p_fin`, `p_hours`, `p_km_guardia`, `p_status`
- `crear_jornada` — called by `crearJornadaEnSupabase()`
- `cerrar_jornada` — called by `cerrarJornadaEnSupabase()`


