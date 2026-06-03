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

### 5.4 Notificación 8 horas con botones de acción Android

Cuando `GuardiaTimerWorker` detecta que la guardia cumple 8 horas, en lugar de solo mostrar una notificación informativa, construir la notificación con dos `NotificationCompat.Action`:

**Botones:**
- **Cerrar guardia** → `PendingIntent` apunta a `GuardiaActionReceiver` con acción `ACTION_CERRAR_GUARDIA`
- **Extender 1 hora** → `PendingIntent` apunta a `GuardiaActionReceiver` con acción `ACTION_EXTENDER`

**`GuardiaActionReceiver` (nuevo `BroadcastReceiver`):**

```kotlin
class GuardiaActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val guardiaId = intent.getStringExtra("guardia_id") ?: return
        CoroutineScope(Dispatchers.IO).launch {
            val repo = ViajeRepository(context)
            when (intent.action) {
                ACTION_CERRAR_GUARDIA -> {
                    repo.finalizarGuardia(guardiaId)
                    context.sendBroadcast(Intent("com.driverlog.GUARDIA_CERRADA").setPackage(context.packageName))
                }
                ACTION_EXTENDER -> {
                    // Reagenda GuardiaTimerWorker con delay de 1h
                    val workRequest = OneTimeWorkRequestBuilder<GuardiaTimerWorker>()
                        .setInitialDelay(60, TimeUnit.MINUTES)
                        .setInputData(workDataOf("guardiaId" to guardiaId))
                        .build()
                    WorkManager.getInstance(context)
                        .enqueueUniqueWork("guardia_timer_$guardiaId", ExistingWorkPolicy.REPLACE, workRequest)
                }
            }
            NotificationManagerCompat.from(context).cancel(NOTIF_ID_GUARDIA_8H)
        }
    }
    companion object {
        const val ACTION_CERRAR_GUARDIA = "com.driverlog.ACTION_CERRAR_GUARDIA"
        const val ACTION_EXTENDER       = "com.driverlog.ACTION_EXTENDER"
        const val NOTIF_ID_GUARDIA_8H   = 2001
    }
}
```

**Construcción de la notificación en `GuardiaTimerWorker`:**

```kotlin
val closePi = PendingIntent.getBroadcast(
    context, 0,
    Intent(GuardiaActionReceiver.ACTION_CERRAR_GUARDIA, null, context, GuardiaActionReceiver::class.java)
        .putExtra("guardia_id", guardiaId),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
)
val extendPi = PendingIntent.getBroadcast(
    context, 1,
    Intent(GuardiaActionReceiver.ACTION_EXTENDER, null, context, GuardiaActionReceiver::class.java)
        .putExtra("guardia_id", guardiaId),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
)
NotificationCompat.Builder(context, CHANNEL_ID)
    .setSmallIcon(R.drawable.ic_guardia)
    .setContentTitle("Guardia — 8 horas cumplidas")
    .setContentText("¿Cerrás la guardia o seguís?")
    .addAction(R.drawable.ic_close, "Cerrar guardia", closePi)
    .addAction(R.drawable.ic_extend, "Extender 1h", extendPi)
    .setAutoCancel(false)
    .setOngoing(true)
    .build()
```

**Registro en `AndroidManifest.xml`:**
```xml
<receiver android:name=".worker.GuardiaActionReceiver" android:exported="false">
    <intent-filter>
        <action android:name="com.driverlog.ACTION_CERRAR_GUARDIA"/>
        <action android:name="com.driverlog.ACTION_EXTENDER"/>
    </intent-filter>
</receiver>
```

---

### 5.5 Botón "Cambiar tipo" en `GuardiaListCard`

Permite al chofer cambiar una guardia en curso de `comun` → `especial` (o viceversa) sin cerrarla y abrir una nueva manualmente. Internamente se crea un segundo tramo, preservando la continuidad de horas para el cálculo de km y viáticos.

**UI — `GuardiaListCard` en `GuardiasScreen.kt`:**

Mostrar el botón solo cuando `guardia.status == "en_curso"`:

```kotlin
if (guardia.status == "en_curso") {
    val nuevoTipo = if (guardia.type == "comun") "especial" else "comun"
    TextButton(onClick = { onCambiarTipo(guardia) }) {
        Text("Cambiar a $nuevoTipo")
    }
}
```

**Lógica — `cambiarTipoGuardia(guardiaId: String)` en `ViajeRepository`:**

```kotlin
suspend fun cambiarTipoGuardia(guardiaId: String) {
    val guardiaActual = guardiaDao.getGuardiaEnCurso() ?: return
    // 1. Cierra el tramo actual con la hora exacta ahora
    finalizarGuardia(guardiaId)
    // 2. Abre un nuevo tramo del tipo opuesto en la misma jornada,
    //    con inicio = hora actual para mantener continuidad
    val nuevoTipo = if (guardiaActual.type == "comun") "especial" else "comun"
    iniciarGuardia(
        orderNumber = guardiaActual.orderNumber,
        type = nuevoTipo,
        descripcion = guardiaActual.descripcion  // hereda descripción si era especial
    )
}
```

**Comportamiento esperado:**
- El tramo cerrado queda en Room/Supabase con sus horas y `kmGuardia` calculados correctamente.
- El nuevo tramo arranca desde `System.currentTimeMillis()` con el tipo opuesto.
- `LaudoCalculator` suma los dos tramos normalmente — ambos son `Guardia` independientes con el mismo `orderNumber`.
- Si el chofer cambiaba de `comun` a `especial`, la descripción queda vacía y puede agregarse luego (o se la pide en un `AlertDialog` antes de confirmar el cambio).
- El `GuardiaTimerWorker` **no se reinicia desde cero** al cambiar de tipo. El nuevo tramo hereda el tiempo acumulado del tramo anterior. El delay restante se calcula como:
  ```
  delay = createdAt(primer tramo) + 8h - System.currentTimeMillis()
  ```
  Si `delay <= 0` (ya pasaron las 8 horas totales de guardia), **no reagendar** el worker — la notificación ya debió haberse disparado o el chofer eligió no extender. En `cambiarTipoGuardia()` pasar el `createdAt` del tramo original al nuevo `iniciarGuardia()` para que calcule el delay correctamente:
  ```kotlin
  val tiempoAcumuladoMs = System.currentTimeMillis() - guardiaActual.createdAt
  val delayRestanteMs = (8 * 3600_000L) - tiempoAcumuladoMs
  if (delayRestanteMs > 0) {
      val workRequest = OneTimeWorkRequestBuilder<GuardiaTimerWorker>()
          .setInitialDelay(delayRestanteMs, TimeUnit.MILLISECONDS)
          .setInputData(workDataOf("guardiaId" to nuevaGuardia.id, "inicio" to nuevaGuardia.inicio))
          .addTag("guardia_timer_${nuevaGuardia.id}")
          .build()
      WorkManager.getInstance(context)
          .enqueueUniqueWork("guardia_timer_${nuevaGuardia.id}", ExistingWorkPolicy.REPLACE, workRequest)
  }
  // Si delayRestanteMs <= 0 → no reagendar; el viático ya fue o no corresponde
  ```

**Diálogo de confirmación (opcional pero recomendado):**

Si el nuevo tipo es `especial`, mostrar un `AlertDialog` con un `TextField` para que el chofer ingrese la descripción del contrato antes de confirmar.

---

### 5.3 Gestión de viajes asignados desde panel admin — flujo de cancelación y reasignación de guardia

#### Contexto
Cuando el admin cancela un viaje programado (que el chofer aún no inició), necesita asignarle una guardia de compensación que arranque desde `horaSalida - 45 min` (tome de guardia). El flujo debe ser coherente end-to-end: panel admin → Supabase mensajes → app Kotlin.

#### Panel admin — tab Mensajes

- Mostrar sección "Asignaciones activas": viajes con `status = "programado"` y `inicioReal = null` de la jornada activa de cada chofer.
- Por cada asignación activa, agregar botón **"Cancelar y asignar guardia"**.
- Al tocar ese botón:
  1. Insertar mensaje tipo `"cancelar_viaje"` en tabla `mensajes` con `data: { viajeId, legajo }`.
  2. Calcular `horaGuardia = horaSalida - 45 min` (usando `departureTime` del viaje).
  3. Insertar mensaje tipo `"guardia"` en tabla `mensajes` con `data: { tipo: "comun", inicio: horaGuardia, motivo: "Viaje cancelado - tome de guardia" }`.
  - Ambos mensajes se insertan en secuencia; el segundo depende del primero para no crear la guardia con un viaje aún activo.

#### App Kotlin — handler FCM / polling

**Mensaje tipo `"cancelar_viaje"`** (nuevo, en `CotFirebaseMessagingService` o worker de polling):
1. Leer `viajeId` del campo `data` del mensaje.
2. Llamar `ViajeRepository.cancelarViaje(viajeId)` → actualiza Room (`status = "cancelado"`) y llama `SupabaseService.cancelarViajeEnSupabase(viajeId)`.
3. Marcar mensaje como `leido = true` en Supabase.
4. Emitir broadcast `"com.driverlog.SYNC_JORNADA"` para refrescar la UI.

**Mensaje tipo `"guardia"` con motivo `"tome de guardia"`** (ampliar handler existente):
1. Leer `inicio` y `motivo` del campo `data`.
2. Llamar `ViajeRepository.iniciarGuardia(orderNumber, type, inicio, dia, descripcion = motivo)`.
3. El timer de 8h (`GuardiaTimerWorker`) debe arrancar calculando el delay desde `inicio` (hora pre-calculada), no desde `System.currentTimeMillis()`.
   - Fix en `iniciarGuardia()`: calcular `demoraTimer = horaInicioMs - ahora + 8h`. Si `horaInicioMs < ahora` (guardia retroactiva), usar `delay = 8h - (ahora - horaInicioMs)`.
4. Marcar mensaje como `leido = true` en Supabase.

#### PDF e Historial

- En `PdfGenerator`, en la sección Guardias, si `guardia.descripcion` contiene `"tome de guardia"`: mostrar la hora de inicio con una nota `(*)` y agregar al pie: `(*) Tome de guardia por viaje cancelado`.
- En `HistorialScreen` / `JornadaDetalleScreen`, en la card de guardia con ese motivo: mostrar badge o texto secundario "Tome de guardia" en color naranja.

#### Modelo de datos — cambios mínimos

No se requieren cambios en Room. El campo `descripcion: String?` de `Guardia` ya existe y es suficiente para transportar el motivo. El campo `inicio: String` ya existe y acepta la hora pre-calculada.

#### Tabla Supabase `mensajes` — nuevos tipos

| Campo | Valor |
|---|---|
| `tipo` | `"cancelar_viaje"` |
| `para` | legajo del chofer |
| `data.viajeId` | id del viaje a cancelar |
| `leido` | false → true al procesar |

| Campo | Valor |
|---|---|
| `tipo` | `"guardia"` |
| `para` | legajo del chofer |
| `data.tipo` | `"comun"` |
| `data.inicio` | hora calculada (HH:mm) |
| `data.motivo` | `"Viaje cancelado - tome de guardia"` |
| `leido` | false → true al procesar |

---

### 5.6 Seguridad de acceso

#### PIN de 4 dígitos

Configurado en el **primer login** (después de que el chofer guarda su perfil). Se almacena con `EncryptedSharedPreferences` (Jetpack Security):

```kotlin
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val securePrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
// Guardar: securePrefs.edit().putString("pin", hashPin(pin)).apply()
// El PIN se guarda hasheado con SHA-256 + salt del device_id
```

Dependencia a agregar en `build.gradle` (app):
```kotlin
implementation("androidx.security:security-crypto:1.1.0-alpha06")
```

#### BiometricPrompt — primera opción con fallback a PIN

Al volver a primer plano (tras timeout o inicio en frío), mostrar `BiometricPrompt`. Si la huella/face falla o no está configurada, mostrar la pantalla de PIN:

```kotlin
val biometricManager = BiometricManager.from(context)
val canAuthenticate = biometricManager.canAuthenticate(
    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
)

if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
    val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Verificar identidad")
        .setSubtitle("Acceso a DriverLog COT")
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .setNegativeButtonText("Usar PIN")
        .build()

    BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            viewModel.unlockApp()
        }
        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            // Fallback al PIN
            viewModel.showPinScreen()
        }
    }).authenticate(promptInfo)
} else {
    viewModel.showPinScreen()
}
```

Dependencia a agregar:
```kotlin
implementation("androidx.biometric:biometric:1.2.0-alpha05")
```

#### Timeout de 5 minutos en background

`MainActivity` registra el timestamp cada vez que la app pasa a background (`onPause`). Al volver a primer plano (`onResume`) compara con el tiempo actual:

```kotlin
// En MainActivity o Application
override fun onPause() {
    super.onPause()
    prefs.edit().putLong("bg_since", System.currentTimeMillis()).apply()
}

override fun onResume() {
    super.onResume()
    val bgSince = prefs.getLong("bg_since", 0L)
    val elapsed = System.currentTimeMillis() - bgSince
    if (elapsed > 5 * 60 * 1000L && bgSince > 0L) {
        // Forzar pantalla de autenticación
        appLockViewModel.lock()
    }
    prefs.edit().remove("bg_since").apply()
}
```

`appLockViewModel.lock()` pone un estado `isLocked = true` en un `ViewModel` de alcance global (`activityViewModels()`). El `NavHost` en `AppNavigation` observa ese estado y redirige a la ruta `auth_lock` antes de mostrar cualquier pantalla de datos.

#### Pantalla `AuthLockScreen` (nueva)

Mostrada como primera ruta cuando `isLocked == true`. No expone ningún dato del chofer hasta autenticar. Flujo:

1. Intentar biometría → éxito → `isLocked = false` → navegar a destino original.
2. Usuario elige PIN / biometría falla → mostrar 4 campos numéricos (o `BasicTextField` con `KeyboardType.NumberPassword`).
3. PIN incorrecto 3 veces → cerrar sesión completa (`SharedPreferences.clear()` + `NavController.navigate("login")`).

#### Registro en `AndroidManifest.xml`

No se necesita permiso extra — `USE_BIOMETRIC` lo agrega automáticamente la librería `androidx.biometric`.

#### Integración con el flujo de login existente

- **Primer uso** (sin PIN guardado): `ProfileSetupScreen` → al guardar perfil, mostrar `PinSetupScreen` (nuevo) → solicitar PIN dos veces para confirmar → guardar en `EncryptedSharedPreferences` → continuar a `AppNavigation`.
- **Login normal**: después de validar legajo y device_id, si `isLocked == false` y no expiró timeout → directo a `AppNavigation` sin pedir PIN.
- **`LoginScreen`**: no muestra datos del chofer → no necesita auth previa.

---

## Fase 6 — Mensajes del admin

### 6.1 `CotFirebaseMessagingService.kt` — rol aclarado

El push FCM es **solo notificación visual** (aviso de que llegó algo). La lógica de creación de viajes/guardias **no depende de FCM** — va en el worker de polling.

El sistema JS nunca dependió del push para crear entidades: usaba polling cada 30 segundos a la tabla `mensajes`. El mismo modelo se replica en Kotlin.

### 6.2 Polling de mensajes — implementación obligatoria

El sistema original en JS consultaba la tabla `mensajes` de Supabase cada 30 segundos (sin depender de FCM para la lógica de negocio). En Kotlin se implementa con un `WorkManager` periódico:

**Worker: `MensajesPollingWorker.kt`**

1. Consulta `mensajes` donde `para = legajo` y `leido = false`.
2. Por cada mensaje encontrado, enrutar según `tipo`:
   - `asignacion` → llamar `ViajeRepository.crearViaje()` con los datos de `data.viaje`
   - `guardia` → llamar `iniciarGuardia()` con los datos de `data` (tipo, inicio, descripcion)
   - `cancelar_viaje` → llamar `ViajeRepository.cancelarViaje(viajeId)` (ver Fase 5.3)
   - `mensaje` o `urgente` → mostrar notificación local con `NotificationManager`
3. Marcar cada mensaje procesado como `leido = true` en Supabase.

**Frecuencia:** 30 segundos. Usar `PeriodicWorkRequest` con `repeatInterval = 30, TimeUnit.SECONDS` (mínimo real de WorkManager es 15 minutos en background; para intervalos cortos usar un `Worker` que se re-encola a sí mismo con `OneTimeWorkRequest` + delay, o usar un `Service` con `Handler.postDelayed`).

> **Nota de arquitectura:** FCM puede despertar el worker o mostrar un toast, pero nunca es la única vía para crear viajes o guardias. Si el push no llega (sin conexión, proceso muerto), el polling lo resuelve en el próximo ciclo.

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

Sprint 5 (historial + mensajes + cancelación admin + mejoras guardia + seguridad):
  → HistorialScreen con totales reales (1h post-LaudoCalculator)
  → JornadaDetalleScreen (2h)
  → MensajesPollingWorker (polling 30s: asignacion→crearViaje, guardia→iniciarGuardia, mensaje/urgente→notif local, marcar leido) (3h)
  → MensajesScreen + FCM como notificación visual complementaria (1h)
  → Flujo cancelación y reasignación de guardia desde panel admin (ver Fase 5.3)
  → Notificación 8h con botones ACTION_CERRAR_GUARDIA / ACTION_EXTENDER sin abrir app (ver Fase 5.4) (2h)
  → Botón "Cambiar tipo" en GuardiaListCard + cambiarTipoGuardia() en Repository (ver Fase 5.5) (1.5h)
  → Seguridad de acceso: PIN encriptado + BiometricPrompt + timeout 5 min + AuthLockScreen (ver Fase 5.6) (3h)
```

---

## Alineación con el panel admin

| Feature del admin | Equivalente en Kotlin | Estado |
|---|---|---|
| Ver jornadas activas con viajes | `sincronizarDesdeSupabase()` | ✅ |
| Ver totales de km y monto | `LaudoCalculator.calcular()` | ❌ falta |
| Estado de jornada (activa/cerrada) | `Jornada.status` | ✅ campo existe |
| Ver guardias con horas y km | `GuardiasScreen` | ⚠️ sin descripción |
| Enviar asignación de viaje | `MensajesPollingWorker` → `crearViaje()` (FCM solo avisa) | ❌ falta worker |
| Enviar asignación de guardia | `MensajesPollingWorker` → `iniciarGuardia()` (FCM solo avisa) | ❌ falta worker |
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
kmTotal: 220.5, monto: 1766.69 ✅2

---

## Fixes del 24/05/2026

- **Coordenadas Punta del Este corregidas** — `TerminalesGPS.catalogo` actualizado a `-34.956996, -54.939091` (antes `-34.95738, -54.938867`). Archivo: `GeoConfig.kt`.
- **Radio GPS aumentado a 300 m** — `GeoConfig.RADIO_METROS` pasó de `150.0` a `300.0` para reducir falsos negativos de llegada en terminales con variación de señal.
- **Tiempo de quietud reducido a 2 minutos** — `GeoConfig.TIEMPO_QUIETO_MS` pasó de `5 * 60 * 1000` a `2 * 60 * 1000` para detectar parada más rápido.
- **`inicioReal` incluido en JSON a Supabase** — `SupabaseService.agregarViajeAJornada()` ahora envía el campo `inicioReal` (`viaje.inicioReal ?: 0L`). Para viajes creados `en_curso`, `ViajeRepository.crearViaje()` ya asignaba `inicioReal = inicioProgramadoMs` correctamente; el dato ahora llega completo a Supabase.

---

## Estado al 02/06/2026

### Sprints completados ✅
- Sprint 1: JornadaCompleta, LaudoCalculator, bugs Room/Supabase
- Sprint 2: NuevaGuardiaScreen, GuardiasScreen, cambiarTipoGuardia
- Sprint 3: cerrarJornada, PDF, totalsSnapshot
- Sprint 4: PdfGenerator completo
- Sprint 5 (parcial):
  - HistorialScreen con filtro mes, resumen período, badge tome guardia ✅
  - MensajesPollingWorker con km desde catálogo e inicioProgramadoMs ✅
  - GuardiaTimerWorker con botones acción ✅
  - GuardiaActionReceiver ✅
  - LaudoCalculator lee laudoKm y montoViatico desde Supabase ✅
  - GeoTerminalService reinicio automático + tiempo quieto 45s ✅
  - origenCreacion y cierreAutomatico en modelo Viaje ✅
  - GuardiasScreen countdown y km en tiempo real ✅
  - LoginScreen flujo registro nuevo chofer ✅

### Pendiente Sprint 5
- MensajesScreen — historial mensajes recibidos en app
- PIN + BiometricPrompt + AuthLockScreen

### Fixes aplicados
- parsearViajes() inicioReal como ISO string o Long
- LaudoCalculator acoplado automático por tipo/destino
- finalizarGuardia usa hora inicio ingresada (no createdAt)
- Guardias < 5 min se eliminan en lugar de finalizarse
- GeoConfig.TIEMPO_QUIETO_MS = 45 segundos

### Backlog
- Supabase Auth por chofer (Fase 2 seguridad)
- Keys en variables de entorno Netlify
- Rotación y servicios_rotacion RLS
- Nuevo viaje tipo CONTRATADO con campos libres
- Limpieza referencias COT → genérico
- APK por empresa con branding configurable
- Modularizar HTML panel admin
