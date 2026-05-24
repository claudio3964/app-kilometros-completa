# Plan de Desarrollo — COT Driver Android Kotlin
## Transcripción fiel desde Vanilla JS + alineación con panel admin

*Generado: Mayo 2026 — basado en análisis del repo `claudio3964/app-kilometros-completa`*

---

## Estado actual resumido

| Capa | Estado |
|------|--------|
| Infraestructura (Room, Supabase, GPS, FCM, Workers) | ✅ Sólida |
| Entidades de datos (Viaje, Guardia, Jornada) | ✅ Completas |
| LaudoCalculator.kt | ❌ Archivo vacío — solo `package` |
| JornadaCompleta.kt | ❌ Archivo vacío — solo `package` |
| ActivarViajeReceiver.kt / ViajeFinalizadoReceiver.kt | ⚠️ Stubs vacíos |
| NuevaGuardiaScreen | ❌ No existe |
| Cierre de jornada | ❌ No implementado |
| Generación de PDF | ❌ No existe |
| HistorialScreen completo | ⚠️ Parcial, sin totales reales |

---

## Fase 1 — Core de negocio (desbloquea todo lo demás)

### 1.1 `JornadaCompleta.kt`
Data class que une todo. El JS la tiene implícita en el objeto `order`.

```kotlin
data class JornadaCompleta(
    val orderNumber: String,
    val fecha: String,
    val legajo: String = "",
    val baseInicio: String = "Montevideo",
    val travels: List<Viaje> = emptyList(),
    val guards: List<Guardia> = emptyList(),
    val closed: Boolean = false,
    val tomeCeseGenerado: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
    val totalsSnapshot: TotalsSnapshot? = null
)

data class TotalsSnapshot(
    val kmViajes: Double,
    val kmGuardias: Double,
    val kmTomeCese: Double,
    val kmAcoplados: Double,
    val kmTotal: Double,
    val viaticos: Int,
    val monto: Double,
    val cerradoAt: Long
)
```

### 1.2 `LaudoCalculator.kt` — transcripción exacta de `core.js`

Constantes (ya definidas, confirmar valores):
```kotlin
const val LAUDO_KM = 8.0122
const val GUARDIA_COMUN_KM_HORA = 30.0
const val GUARDIA_ESPECIAL_KM_HORA = 40.0
const val TOME_CESE_KM = 42.5
const val ACOPLADO_EXTRA_KM = 30.0
const val MONTO_VIATICO = 455.0
```

Reglas de acoplado por tipo de servicio (del JS):
- TURNO → tome/cese SÍ, acoplado NO
- DIRECTO / DIRECTÍSIMO → tome/cese SÍ, acoplado SÍ
- EXPRESO, CONTRATADO → tome/cese SÍ, acoplado NO
- PASAJERO → tome/cese NO, acoplado NO
- SEMIDIRECTO → tome/cese SÍ, acoplado NO

Acoplado km especiales:
- Destino Chuy → 0 km acoplado
- Destino La Pedrera → 37.5 km
- Resto → 30.0 km

Regla de viáticos (la más compleja del JS):
- Calcular `horasJornada` = suma de minutos de viajes finalizados + guardias
- Verificar franja 14:00 — si la jornada atraviesa las 14h y lleva ≥3.5h antes → +1 viático
- Verificar franja 23:00 — misma lógica → +1 viático
- Piso mínimo: si `horasJornada >= 9` y viáticos = 0 → viáticos = 1
- La UI del admin muestra el campo `viaticos` en el resumen de cada jornada

Función principal `calcular(jornadaCompleta)` retorna `Totales`:
```kotlin
data class Totales(
    val kmViajes: Double,
    val kmAcoplados: Double,
    val kmGuardias: Double,
    val kmTomeCese: Double,
    val kmTotal: Double,
    val monto: Double,
    val viaticos: Int
)
```

Lógica de cálculo:
1. Si jornada cerrada y tiene `totalsSnapshot` → devolver snapshot (no recalcular)
2. Sumar km de viajes no cancelados y no programados (`kmEmpresa` o `kmAuto`)
3. Sumar km de acoplados por viaje
4. Sumar km de guardias: `hours × kmPorHora`
5. Tome y cese: 42.5 km si hay al menos un viaje válido y el tipo lo permite
6. Calcular viáticos con la regla de franjas
7. `monto = kmTotal × LAUDO_KM + viaticos × MONTO_VIATICO`

### 1.3 Completar stubs vacíos

**`ActivarViajeReceiver.kt`** — recibe broadcast cuando el WorkManager activa un viaje. Debe llamar a `ViajeRepository.activarViaje()` y notificar la UI.

**`ViajeFinalizadoReceiver.kt`** — recibe el broadcast de `GeoTerminalService` cuando el GPS cierra el viaje automáticamente. Debe refrescar la lista de viajes en la UI.

### 1.4 Lógica de Guardia mejorada (transcribir `addGuard` de core.js)

Validaciones que tiene el JS y faltan en Kotlin:
- Tipo inválido → error
- Formato hora inválido → error
- Hora de inicio anterior al `arrivalTime` del último viaje finalizado → error
- Guardia especial sin descripción → error

Agregar `descripcion: String? = null` a la entidad `Guardia.kt`.

---

## Fase 2 — Pantallas faltantes

### 2.1 `NuevaGuardiaScreen.kt` (no existe)

Campos según el JS (`addGuardUI`):
- Date picker para el día (por defecto hoy)
- Time picker para hora inicio (`horaInicioGuardia`)
- Selector tipo: Común / Especial (`tipoGuardia`)
- Campo descripción — visible y obligatorio solo si tipo = Especial
- Botón Registrar → llama a `repository.iniciarGuardia(orderNumber, type, inicio, dia, descripcion)`

Validaciones antes de crear:
- Si hay viaje `en_curso` → no permitir (aviso)
- Si hora inicio < `arrivalTime` del último viaje finalizado → error con mensaje exacto

Integración con admin: el panel admin puede asignar guardias vía mensajes. La app recibe el mensaje tipo `guardia` con `{ tipo, inicio, descripcion }` y la crea automáticamente. El status depende de si la hora ya pasó.

### 2.2 Mejorar `GuardiasScreen.kt`

Agregar:
- Mostrar descripción en `GuardiaListCard` si `guardia.type == "especial"`
- Timer elapsed en la guardia en curso (igual que el viaje en curso en MainScreen)
- Aviso si la guardia lleva 8h (el JS manda broadcast `com.driverlog.GUARDIA_8_HORAS`)

---

## Fase 3 — Cierre de jornada

### 3.1 Lógica de cierre (transcribir `closeActiveOrder` de core.js)

En `ViajeRepository.cerrarJornada(orderNumber)`:

1. Verificar que no haya viaje `en_curso` ni `programado` (si hay, mostrar error)
2. Verificar mínimo de horas:
   - Sin guardias → mínimo 9h desde `createdAt`
   - Con guardias → mínimo 8h
   - Si faltan horas → mostrar confirmación al usuario antes de continuar
3. Cerrar guardias en curso automáticamente:
   - Calcular `fin` = hora actual
   - Calcular `hours` = fin - inicio
   - `kmGuardia = hours × kmPorHora`
   - `viatico = hours >= 9`
4. Calcular `TotalsSnapshot` con `LaudoCalculator`
5. Actualizar `Jornada` en Room: `status = "cerrada"`, `closedAt = now`
6. Sincronizar a Supabase: endpoint para marcar jornada cerrada con el snapshot
7. El panel admin refleja inmediatamente la jornada como cerrada con totales

### 3.2 Botón en `MainScreen.kt`

El botón "Finalizar jornada" ya existe pero solo muestra un `Toast`. Conectarlo a la lógica real:
- Verificar condiciones
- Mostrar diálogo de confirmación con resumen (`LaudoCalculator.calcular(...)`)
- Si acepta → `repository.cerrarJornada()` → generar PDF → navegar a Historial

---

## Fase 4 — Generación de PDF

### 4.1 Contenido del PDF (igual al JS con `jspdf`)

El JS en `ui_travels.js` llama a `exportarJornada()` al cerrar. El PDF debe incluir:

**Encabezado:**
- Logo COT (si está disponible como asset en `res/drawable`)
- Nombre, legajo, base, tipo del chofer
- Número de orden, fecha, hora de cierre

**Sección viajes:**
- Por cada viaje no cancelado: origen, destino, tipo servicio, km, acoplado (sí/no), hora salida, hora llegada, tome/cese (sí/no)

**Sección guardias:**
- Por cada guardia: tipo (común/especial), descripción si especial, hora inicio, hora fin, horas totales, km generados, viático (sí/no)

**Resumen final:**
- Km viajes, km guardias, km tome/cese, km acoplados, km total
- Viáticos (cantidad y monto)
- **Monto total en pesos**

**Implementación:**
- Usar `android.graphics.pdf.PdfDocument` (nativo Android, sin dependencias)
- Guardar en `context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)`
- Ofrecer compartir vía `Intent.ACTION_SEND` (igual que el JS usa Capacitor Share)

### 4.2 Integración con `HistorialScreen`

Agregar botón "Ver PDF" en `JornadaCard` para jornadas con `status == "cerrada"`. El PDF se genera en el momento si no existe, o se abre si ya fue guardado.

---

## Fase 5 — Historial completo

### 5.1 Mejorar `HistorialScreen.kt`

Estado actual: muestra lista de jornadas sin totales reales (LaudoCalculator vacío).

Agregar tras implementar LaudoCalculator:
- Expandir `JornadaCard`: mostrar km total y monto al tocar
- Botón "Ver PDF" para jornadas cerradas
- Filtro por mes (Spinner o DateRangePicker)
- Sección de resumen del período filtrado:
  - Total km del mes, monto total, cantidad de jornadas, total viáticos

### 5.2 Nuevo: `JornadaDetalleScreen.kt`

Al tocar una jornada en el historial → abrir pantalla de detalle con:
- Lista de viajes de esa jornada (desde Room por `orderNumber`)
- Lista de guardias
- Totales calculados o snapshot si está cerrada
- Botón compartir PDF

---

## Fase 6 — Mensajes del admin

### 6.1 `CotFirebaseMessagingService.kt` — ampliar

El FCM ya funciona para viajes. El admin también manda mensajes tipo:
- `mensaje` → mostrar notificación de texto
- `asignacion` → crear viaje automáticamente (si acepta)
- `guardia` → crear guardia automáticamente
- `urgente` → notificación con sonido diferenciado

Hoy la app Kotlin solo maneja push de activación de viaje. Hay que parsear el `data` del push y enrutar según `tipo`.

### 6.2 Polling de mensajes

El JS hace polling cada 30 segundos a la tabla `mensajes`. En Kotlin se puede implementar con un `WorkManager` periódico que:
1. Consulta `mensajes` donde `para = legajo` y `leido = false`
2. Si hay mensajes → muestra notificación local
3. Al tocar → abre la app en una pantalla de mensajes

### 6.3 `MensajesScreen.kt` (nueva)

Lista de mensajes recibidos con opción de marcar como leído. El admin ve en tiempo real si el chofer leyó el mensaje (campo `leido` en Supabase).

---

## Fase 7 — Bugs activos (resolver en paralelo con Fase 1)

### Bug 1 — Viaje no sincroniza a Supabase
En `ViajeRepository.crearViaje()` el bloque `try/catch` atrapa la excepción silenciosamente. Hay que agregar log del response body de Supabase para ver el error real. Posibles causas: RPC `agregar_viaje_a_jornada` no existe o los parámetros no coinciden con los que espera Postgres.

**Fix:** En `SupabaseService.agregarViajeAJornada()` loguear `response.body?.string()` completo, no solo el código HTTP.

### Bug 2 — orderNumber con legajo incorrecto
En `ViajeRepository.getOCrearJornada()` el `legajo` se toma como parámetro pero puede llegar vacío si `SharedPreferences` tiene un valor stale. Agregar validación: si `legajo.isEmpty()` → leer de nuevo de SharedPreferences antes de crear.

**Fix limpieza:** `DELETE FROM jornadas WHERE legajo = '1234';` + reinstalar app para limpiar Room.

### Bug 3 — registro_alertas
Ya tiene implementación en `SupabaseService.insertarAlertaAcceso()`. Verificar que la estructura de la tabla en Supabase coincida con los campos que se envían (`device_id_nuevo`, `device_id_actual`, `intentado_at`).

---

## Orden de ejecución recomendado

```
Sprint 1 (desbloquea todo):
  → Bug 1, Bug 2 (30min cada uno)
  → JornadaCompleta.kt (15min)
  → LaudoCalculator.kt (2-3h — lógica de viáticos es la parte compleja)

Sprint 2 (UI faltante):
  → NuevaGuardiaScreen.kt (2h)
  → Completar stubs ActivarViajeReceiver + ViajeFinalizadoReceiver (30min)
  → Mejorar validaciones en iniciarGuardia() (1h)
 
Sprint 3 (cierre de jornada):
  → Lógica cerrarJornada() en Repository (2h)
  → Diálogo de confirmación en MainScreen (1h)
  → Endpoint Supabase para marcar jornada cerrada (si no existe)

Sprint 4 (PDF):
  → PdfGenerator.kt con PdfDocument nativo (3-4h)
  → Integrar en cerrarJornada() (30min)
  → Botón Ver PDF en HistorialScreen (30min)

Sprint 5 (historial + mensajes):
  → HistorialScreen con totales reales (1h post-LaudoCalculator)
  → JornadaDetalleScreen (2h)
  → MensajesScreen + ampliar FCM handler (3h)
```

---

## Alineación con el panel admin

| Feature del admin | Equivalente en Kotlin | Estado |
|---|---|---|
| Ver jornadas activas con viajes | `sincronizarDesdeSupabase()` | ✅ |
| Ver totales de km y monto | `LaudoCalculator.calcular()` | ❌ falta |
| Estado de jornada (activa/cerrada) | `Jornada.status` | ✅ campo existe |
| Ver guardias con horas y km | `GuardiasScreen` | ⚠️ sin descripción |
| Enviar asignación de viaje | FCM handler | ⚠️ parcial |
| Enviar asignación de guardia | FCM handler | ❌ no implementado |
| Alertas dispositivo duplicado | `insertarAlertaAcceso()` | ✅ implementado |
| Ver PDF de jornada cerrada | `PdfGenerator` | ❌ falta |
| Dashboard km total del día | `calcularTotalesHoy()` | ❌ depende de LaudoCalculator |

---

*El campo `empresa_id = "cot"` está hardcodeado en toda la app Kotlin — correcto para esta fase del piloto. La Fase 6 multi-empresa no está en scope de este plan.*

## 16. Estado al 23/05/2026 — Proyecto Kotlin

### Bugs resueltos hoy
- [x] Bug 1 — Viajes sincronizan a Supabase (RPC agregar_viaje_a_jornada creada + SECURITY DEFINER)
- [x] Bug 2 — orderNumber usa legajo correcto (4112)
- [x] Bug 3 — registro_alertas funciona, panel admin muestra alertas y botón Autorizar/Rechazar operativo

### Próximos pasos
Ver PLAN_DESARROLLO_KOTLIN.md — Sprint 1

Sprint 1 , 2 completos

Sprint 3 completo ✅
Mirá el JSON en Supabase — todo perfecto:

closed: true ✅
status: "finalizada" ✅
totalsSnapshot con todos los valores ✅
kmTotal: 220.5, monto: 1766.69 ✅
