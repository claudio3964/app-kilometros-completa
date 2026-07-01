# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> **Última actualización:** 30/06/2026

---

## SNAPSHOT

- **Qué es:** app Android nativa (Kotlin, `com.driverlog.app`, branch `main`) para
  digitalizar jornadas de choferes de transporte en Uruguay.
- **Backend:** Supabase (Postgres + RLS + RPCs) + FCM push. Lógica de laudo centralizada.
- **Panel admin:** Vanilla JS en `cot-driver-admin.netlify.app`. (Migración a Next/React
  ya hecha, sin desplegar — ver backlog.)
- **Fase:** pre-producción. APK aún NO distribuido a choferes. "Producción" = solo entorno
  de prueba propio (Claudio testea en campo y PC).
- **Auth:** la app usa SOLO la anon key (no hay Supabase Auth por chofer). Login = legajo
  + device_id contra tabla `choferes`. **Confirmado 28/06 leyendo `SupabaseService.kt`:**
  la app manda la anon key como `Authorization: Bearer` SIN JWT de sesión → PostgREST
  asigna rol **`anon`** con certeza total, `auth.uid()` siempre null. Cualquier policy
  con `auth.uid()` o `auth.role()='authenticated'` BLOQUEA la app. El filtrado por
  identidad de chofer queda diferido (requiere Auth por chofer o claims firmados).
- **Alcance app del chofer:** muestra el MES CALENDARIO corriente (sync trae últimas 30
  jornadas cerradas). El historial profundo / consulta de meses específicos / impresión es
  responsabilidad del PANEL WEB (Tránsito), no de la app. El `limit=30` del sync es un
  límite de DISEÑO coherente con esto, no un bug.

---

## DÓNDE ESTOY PARADO HOY

**Anti-solapamiento — pieza 1: VALIDADA EN CAMPO END-TO-END. Causa raíz del fallo temprano
del 29/06 explicada: VERSIONADO, no lógica ni Room.** Reproducción limpia exitosa: viaje
en_curso Montevideo→Colonia (21:46) + intento de programado Punta del Este→Montevideo
(~22:05, +15min) → diálogo "Viaje en conflicto", segundo viaje NO creado (JSON confirmó
`travels[]` con UN solo viaje), GPS no arrancó. Logs `COT_GUARD` confirmaron el flujo
completo.

**Causa raíz confirmada por git (30/06), no solo por inferencia:** `SolapamientoValidator.kt`
estuvo *untracked* en Git desde el commit `86561e8` del 27/06 (que incluyó todo lo que USA
el validador — `ViajeRepositoy.kt`, `MainScreen.kt`, `NuevoViajeScreen.kt`,
`MensajesPollingWorker.kt` — pero no el archivo que lo DEFINE) hasta el commit de rescate
`d76f6a8` del 29/06. `git log --follow` confirma que el archivo aparece en un solo commit
(`d76f6a8`); `git show 86561e8 --stat` confirma que no está en esa lista. El archivo vivía
solo en disco local esa tarde. **Sigue siendo inferencia de alta probabilidad y no
confirmación directa del APK exacto** (no se tiene el binario de esa tarde para verificar
que el .class faltaba en el .dex) — pero el hallazgo de git más el hecho de que el camino
feliz funciona hoy end-to-end hacen que esta sea la explicación más sólida disponible. Las
6 hipótesis de lógica que se persiguieron ese día (0L, jornada duplicada, Room desync, race
condition, `order_number` vacío, gap de escritura Room) quedan explicadas de golpe por esta
séptima.

**Blindaje del `0L` — CERRADO HOY (30/06).** Aunque no causó el bug del 29/06, era una
bomba de tiempo latente identificada en la sesión: el resolver `viaje.inicioReal ?:
viaje.inicioProgramado` no atrapa `0L` (el cero no es `null`, así que un viaje corrupto con
`inicioReal=0` se mediría desde epoch 1970 y saldría de toda ventana de solapamiento). Se
blindaron las DOS instancias del patrón en `SolapamientoValidator.kt`:
- Línea 23 (`inicioReal`): fallback a `inicioProgramado` si `inicioReal` es `null` o `≤0L`.
- Línea 25 (`finReal`, viaje finalizado): fallback a `inicio + DURACION_VIAJE_DEFAULT_MS`
  (3h) si `finReal` es `null` o `≤0L`.
4 tests nuevos agregados (casos 7–10): `inicioReal=0L` solo, `finReal=0L` solo, control con
`finReal` real (confirma que el fallback no pisa un valor válido), y doble corrupción
(`inicioReal` y `finReal` ambos `0L`, confirma que los dos fallbacks encadenan). **10/10
tests verdes.** Commiteado.

**Próximo paso de esta misma tanda:** versionado visible + sellado en JSON (Próximos Pasos
#1) — pendiente de arrancar.

---

## PRÓXIMOS PASOS (en orden)

1. **[INSTRUMENTAR — prerequisito blando de distribuir APK] Versionado visible + sellado en
   el JSON.** Hallazgo estructural del 29/06: NO hay forma de saber qué versión del código
   corre en el celu, y eso costó una tarde de diagnóstico persiguiendo hipótesis de lógica
   cuando la causa era "APK sin el archivo compilado". Dos partes:
    - **(a) Versión visible en pantalla:** mostrar en ajustes / "acerca de" / toque largo en
      el título el `BuildConfig.VERSION_NAME` + `VERSION_CODE` + **hash corto del commit**
      (inyectado en `build.gradle` con `git rev-parse --short HEAD` en build time) + fecha
      de build.
    - **(b) Sellado en el JSON de la jornada:** agregar `appVersion` / `buildCommit` al lado
      del `origenCreacion:"app"` que ya existe en cada viaje. Cada viaje queda sellado con
      qué build lo creó. Conecta con el frente de integridad del laudo (#4).
    Justificación: con muchos choferes en versiones distintas, un bug reportado es
    indiagnosticable sin saber la versión. Con un solo usuario ya costó una tarde entera.

2. **[VALIDAR — suelto] INSERT de `comandos_dispositivo` desde el panel.** Mandar un comando
   de prueba (`tipo:'limpiar_jornadas'`) desde el panel admin y confirmar que entra (prueba
   el INSERT `authenticated`) y que la app JS lo recibe/marca ejecutado (prueba SELECT+UPDATE
   anon). No bloqueante: la tabla está vacía. Cierra el círculo de la consolidación RLS del
   28/06.

3. **[SIGUIENTE PIEZA — UI] Botones de cancelar viaje en las pantallas + path de borrado de
   jornada local.** Complementa el anti-solapamiento (prevención) con la corrección de lo que
   ya entró. Hoy: viaje programado tiene botón "Cancelar"; viaje en_curso SOLO tiene
   "Finalizar", no "Cancelar". **La lógica de cancelar YA funciona** (fix del 26/06,
   validado en campo) — esto es UI, no lógica. **Diseño dura: cancelar un en_curso es
   DESTRUCTIVO** (descarta km, plata). Requiere CONFIRMACIÓN explícita. **CUIDADO CRÍTICO:**
   cancelar un en_curso debe PARAR `GeoTerminalService` — si no, GPS huérfano → vuelta
   fantasma por la otra puerta. **Deuda relacionada:** NO existe path "bueno" de borrado de
   jornada desde la app. **Prioridad reforzada (30/06):** sin este botón, un viaje en_curso
   cargado por error (segundos/minutos de duración) NO tiene más salida que "Finalizar" —
   entra a `LaudoCalculator`/`totalsSnapshot` como dato real. Es la misma familia de riesgo
   que la sobrefacturación por RPC rota del 26/06: acá la vía de entrada del dato corrupto
   es una UI incompleta, no una RPC rota, pero el efecto sobre el laudo es el mismo.

4. **[FRENTE GRANDE — diseño, NO ahora] Sistema de integridad del laudo / validación
   multi-eje.** El anti-solapamiento (temporal) es la PRIMERA pieza entregada de un sistema
   más completo cuyo propósito es detectar inconsistencias que corrompen el laudo (error
   humano o fraude del chofer). Ejes futuros (sin código hasta integrar el Next):
    - **Eje temporal (ENTREGADO):** solapamiento de horarios entre viajes. Intervalo
      `[inicioReal ?: inicioProgramado, +3h]` (con blindaje `0L` ya aplicado), cancelado
      excluido, borde no solapa.
    - **Eje geográfico (anotado 29/06):** continuidad — el ORIGEN de un viaje nuevo debería
      coincidir con el DESTINO del viaje anterior. Caso testigo: Mvd→Colonia y a los 15min
      Mvd→Punta del Este (geográficamente imposible, ninguna validación temporal lo atrapa).
      MATICES a resolver: reposicionamiento de coche vacío, arranque desde terminal sin que
      el destino anterior haya sido ahí.
    - **Eje de rango horario:** validar que un viaje esté en rango razonable contra el
      timestamp registrado; fuera de rango → alerta.
    - **Eje viaje-vs-guardia (NUEVO, anotado 30/06):** el `SolapamientoValidator` hoy SOLO
      compara viaje contra viaje — no tiene ningún concepto de guardia. Si una guardia se
      solapa con la ventana de fallback de un viaje en_curso, HOY nada lo detecta, ni local
      ni server. Caso concreto planteado: viaje en_curso 21:30 sin `finReal` (ventana de
      fallback hasta 00:30) + una guardia que caiga en ese tramo — sin cobertura. Sin diseño
      aún, solo identificado.
    - **Validación en la ASIGNACIÓN (panel web Next):** hoy un viaje asignado por admin
      (`MensajesPollingWorker`) solo LOGUEA el conflicto, no lo bloquea — el guard local no
      cubre esa vía de entrada. Caso concreto: viaje en_curso 21:30 + viaje asignado por
      panel a las 22:00 → conflicto detectado en logs pero el viaje se crea igual, y no hay
      alerta visual en el panel (el lado servidor de esto no existe todavía). El bloqueo real
      va en el guard del servidor (RPC), misma regla del validador puro — "una sola regla,
      dos lados" (#11).
    - **Salida:** las inconsistencias detectadas abren ALERTA en el panel web y quedan
      REGISTRADAS en el JSON de la jornada para auditoría. Diseño aún no definido por
      Claudio ("va por allí").
    - Conecta con: backlog tab de reconciliación (#9), auditoría de reaperturas (#10), guard
      del servidor RPC (#5).

5. **[FRENTE — extiende anti-solapamiento, NO ahora] Solapamiento en el servidor +
   activación.**
    - **Guard del servidor (RPC):** rechazar en la escritura un viaje/bloque solapado.
      Robusto (atómico, sin race). Protege la ASIGNACIÓN DE ADMIN (el celu puede estar
      apagado). `SolapamientoValidator` (lógica pura) es la MISMA regla que va a correr ahí.
      Atado al diseño del bloque del día siguiente (definir con la empresa) y al frente #4.
    - **Re-chequeo en `ActivarViajeWorker`:** antes de flipear programado→en_curso,
      re-verificar solapamiento. Última red si por la vía de admin (offline) entró un
      programado que el guard local no vio. Barato.

6. **[FRENTE — app + Supabase, sesión propia con CC] Ciclo de vida del estado "activa".**
   Nudo raíz. Arranca por **mapear el ciclo completo** (quién abre/cierra `status="activa"`,
   qué se permite mientras está abierto, bordes: medianoche / día anterior / reapertura)
   ANTES de tocar código. De ese mapa caen:
    - **(1) Guard de jornada activa huérfana de día anterior.** `getOCrearJornada` solo
      chequea `getJornadaPorFecha(hoy)`; si hay una `status="activa"` de día anterior sin
      cerrar, crea una segunda activa en paralelo sin avisar. **Discriminador correcto:**
      `status='activa' AND fecha != :hoy`, NO "cualquier activa". Preferir BLOQUEAR + AVISAR,
      no auto-cerrar en silencio. CC mapeó 6 callers. Alcance 1ª pasada: `getOCrearJornada`
      con filtro de fecha + los 2 callers con catch/UI.
    - **(2) Lógica de 8h del botón "finalizar jornada"** (mostrar solo sin viaje/guardia/
      contrato en curso, como el JS vanilla).
    - **(3) Bugs de guardia A y B** (bugs 21/06) — requieren reproducción antes de tocar.
    - **(4) Indicador color verde/gris** que no vuelve a verde al reabrir.
      Empezar por (1). **Pendiente:** bajar a `REGLAS_NEGOCIO.md` la regla de cuándo una
      jornada puede reabrirse y qué define que un viaje pertenece a un día.

7. **[BUG — 21/06, sin diagnosticar] "Viajes del día" vacío con jornada activa.** Sesión
   propia. Sospecha: bug de lectura/filtro de la pantalla, posiblemente relacionado al campo
   `llegadaEstimada` ausente en el JSON del 21 vs presente (como `0`) en previos.

8. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
    - Número de coche: no se muestra en la fila de viaje del historial.
    - Deuda menor: viático `$455.26` hardcodeado en HistorialScreen (solo display).
    - Texto del diálogo de solapamiento muestra `(${status})` crudo (ej. "(en_curso)").
      Pulir: mapear a texto legible.

9. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en panel Next
   con historial en tiempo real de actividad del chofer, edición autorizada por superadmin.
   Objetivo: cazar ERROR HUMANO DE TIPEO en la carga manual, NO error de cálculo.

10. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
    viaje + origen app/panel) en el JSON de la jornada, visible en panel Next.

11. **[FUTURO] Identidad firmada del chofer.** Para que RLS pueda filtrar a nivel CHOFER
    hace falta identidad firmada (Supabase Auth por chofer o claims/JWT). NO empezar hasta
    estabilizar lo en curso.

12. **[FUTURO] Dónde vive la lógica de negocio.** Frente de diseño grande. Sync pull-only,
    `syncStatus` es teatro. Sub-tarea: sync de SALIDA real (cola persistida + reintento).

13. **[FUTURO] Migración a MVVM.** Después de identidad/RLS fino.

14. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md.

15. **[FUTURO — sin urgencia] Archivado trimestral.** Dirección: desde Supabase (durable),
    nunca desde Room.

---

## ESTADO DE SEGURIDAD RLS (revisado 28/06 — Escalón 3 mayormente cerrado)

- **Rol real de la app CONFIRMADO: `anon`.** La app manda la anon key como Bearer sin JWT →
  PostgREST = rol `anon`, `auth.uid()` null.
- **Las 3 tablas que estaban UNRESTRICTED ya tienen RLS ENCENDIDO (28/06):** `choferes`,
  `jornadas`, `travel_stats`. Ya NO hay tablas UNRESTRICTED.
- **DEUDA CONSCIENTE que persiste:** las policies filtran por `empresa_id='cot'`, no por
  chofer. Cierre real = identidad firmada del chofer (#11).
- **`comandos_dispositivo` consolidada** (10→4 policies, INSERT cerrado a authenticated).
  Validación del flujo desde panel: pendiente (#2).
- **Pendiente de Escalón 3:** auditar el resto de las ~42 policies `{public}` legacy en
  otras tablas. Sigue siendo prerequisito antes de distribuir el APK.

---

## PANEL WEB NEXT — estado de revisión (sin cambios desde 20/06)

- ✅ Token: anon key, respeta RLS.
- ✅ Auth admin: Supabase Auth real.
- ❌ Chequeo de rol contra tabla `admins` es COSMÉTICO.
- ⚠️ Refresh token no implementado.
- ⚠️ Cliente Supabase no centralizado (13 archivos).
- ❌ Falta UI de edición/finalización/cancelación de viajes ya cargados → backlog #9.
- Deploy: bloqueo por RLS levantado el 28/06. Falta el resto del Escalón 3 y decidir el
  momento del switch de dominio.

---

## ARQUITECTURA — ESTADO vs OBJETIVO

- **Estado actual:** UI (Compose) → `ViajeRepository` → DAO → Room. Sin capa ViewModel.
- **Objetivo:** MVVM incremental, NO hecha.
- **Regla para Claude Code:** respetar el patrón ACTUAL. ViewModel SOLO en trabajo nuevo.
- **Capa de lógica pura:** `PermisosManager` y `SolapamientoValidator` son objetos puros
  sin dependencias de Room/Supabase/Android, testeables en JVM. `SolapamientoValidator` es
  la base del futuro sistema de integridad del laudo (#4). **Blindaje `0L` cerrado 30/06**
  con 10/10 tests verdes.
- **RPCs SECURITY DEFINER:** aplicado a `actualizar_viaje_en_jornada`, `estimar_llegada`,
  `registrar_en_travel_stats`. Las helper puras quedan INVOKER.
- **Room: `CotDatabase` en version 14.** Con MIGRATIONS REALES. `fallbackToDestructiveMigration`
  ELIMINADO. Room es caché reconstruible desde Supabase. El guard de solapamiento lee
  `getViajesPorJornada(orderNumber)` de Room; validado end-to-end con el build correcto.
- **Sync direccional: PULL-ONLY.** No hay push de salida. `syncStatus` es teatro. No hay
  path de borrado de jornada local desde la UI (deuda, #3).
- **Instrumentación activa:** logs `Log.d("COT_GUARD", ...)` en `ViajeRepositoy.kt` (líneas
  154, 158). Dejados como cámara. Filtrar logcat con `tag:COT_GUARD`.
- **OJO — tabla `viajes` de Supabase está MUERTA.** La verdad del laudo vive en
  `jornadas.data.travels` (JSONB), no en la tabla `viajes` de Room.
- **Nombres de columna en Supabase: snake_case.** `order_number` top-level; `orderNumber`
  camelCase vive DENTRO del JSONB `data`.

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes** → `REGLAS_NEGOCIO.md`. **Pendiente bajar acá:** la
  regla de solapamiento (validada en campo end-to-end + blindaje `0L` cerrado 30/06) — ya
  no depende de ninguna deuda abierta, se puede pasar formalmente en la próxima sesión.
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md`.
- **Esquema de tablas Supabase** → RUTAUY_CONTEXT.md (solo como mapa; valores obsoletos).
- **RPCs versionadas en `supabase/functions/`:** `actualizar_viaje_en_jornada.sql`,
  `travel_stats.sql`.
- **Historial sprints 1-5** → PLAN_DESARROLLO_KOTLIN.md (histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)

### 30/06/2026
- **Reconciliación de ESTADO.md: el repo tenía una versión desactualizada/pesimista por
  corte de créditos, no por error de diagnóstico.** La sesión del 29/06 se cortó sin
  créditos antes de commitear el md final — quedó en el repo la versión intermedia que
  todavía tenía el modo de falla como "no confirmado" (atribuido a Room sucio). La
  investigación había continuado y cerrado con la causa real (versionado/archivo untracked),
  pero ese md nunca se subió. Reconciliado hoy con dato objetivo de git, no por preferencia
  entre versiones: `git log --follow` confirma que `SolapamientoValidator.kt` aparece en un
  solo commit (`d76f6a8`, 29/06); `git show 86561e8 --stat` confirma que el commit del 27/06
  (5 archivos: `ViajeRepositoy.kt`, `MainScreen.kt`, `NuevoViajeScreen.kt`,
  `MensajesPollingWorker.kt`, `.claude/Estado_actual.md`) NO incluye el archivo. Confirma el
  diagnóstico de versionado. Sigue siendo inferencia de alta probabilidad sobre el APK
  específico de esa tarde (no confirmación binaria), pero es la explicación más sólida
  disponible y las 6 hipótesis de lógica quedan explicadas de golpe por ella.
  **Aprendizaje de proceso:** un corte de créditos a mitad de commit puede dejar el ESTADO.md
  del repo desincronizado del diagnóstico real por varias horas/días si no se lo detecta
  activamente. Vale la pena, al abrir una sesión nueva, comparar el md pegado en el chat
  contra el que vive en el repo si hay cualquier sospecha de continuidad cortada.
- **Blindaje `0L` en `SolapamientoValidator.kt`: CERRADO.** Bomba de tiempo latente
  identificada el 29/06 (no causó el bug de ese día, pero era un riesgo real para un sistema
  de integridad). Dos instancias del patrón `?:` no atrapaban `0L` (el cero no es `null`):
  línea 23 (`inicioReal`) y línea 25 (`finReal` en viaje finalizado). Fix: ambas resueltas
  con chequeo explícito `!= null && > 0L`, cayendo al fallback correcto (`inicioProgramado`
  o `inicio+3h`) en vez de medir desde epoch 1970. 4 tests nuevos (casos 7–10): `inicioReal`
  corrupto solo, `finReal` corrupto solo, control con `finReal` real (confirma que no se
  pisa un valor válido), y doble corrupción (ambos `0L`, confirma que los fallbacks
  encadenan). **10/10 tests verdes** (`./gradlew :app:testDebugUnitTest`). Commiteado.
- **Nuevo gap identificado (no atacado, anotado en Próximos Pasos #4): eje viaje-vs-guardia
  sin cobertura.** El validador solo compara viaje contra viaje; una guardia solapando la
  ventana de fallback de un viaje en_curso hoy no se detecta por ningún lado.
- **Reforzada la prioridad de #3 (botones de cancelar en_curso):** discutido que sin ese
  botón, un viaje en_curso cargado por error no tiene más salida que "Finalizar" — entra al
  laudo como dato real. Misma familia de riesgo que la sobrefacturación del 26/06, esta vez
  con una UI incompleta como vía de entrada en vez de una RPC rota. Decidido explícitamente
  NO abrir esta pieza en esta sesión — queda en cola, próxima.

### 29/06/2026
- **Anti-solapamiento — pieza 1: VALIDADA EN CAMPO (camino feliz). Modo de falla NO cerrado —
  deuda abierta.** Reproducción limpia exitosa: Room limpio + en_curso Mvd→Colonia (21:46) +
  intento de programado Mvd→Punta del Este (22:05, +~15min) → diálogo "Viaje en conflicto"
  mostrado, segundo viaje NO creado (JSON confirmó `travels[]` con UN solo viaje), GPS no arrancó.
  Logs confirmaron `viajesTodos.size=1` con el en_curso visible.
  **El bug original (corrida temprana del 29/06 que NO rebotó) NO se reprodujo ni se confirmó su
  causa exacta.** La diferencia entre las dos corridas fue el ESTADO DE ROOM, no el guard: corrida
  que falló tenía Room arrastrando estado de pruebas → `viajesTodos` sin Viaje 1 → guard ciego;
  corrida que funcionó tenía Room limpio → `size=1` → rebote.
  **Diagnóstico — SEIS hipótesis refutadas con dato/código (no con deducción):** (1) `0L` no
  atrapado por `?:` — refutado (Viaje 1 tenía `inicioReal` válido); (2) jornada duplicada —
  refutado (`orderNumber` determinista); (3) Room desync vía admin/2º device — refutado (mismo
  celu); (4) race condition coroutines — refutado (15 min reales, no ms); (5) columna `order_number`
  vacía + fallback del sync corrompiendo `orderNumber` en Room — refutado (CSV de 9 jornadas:
  `order_number` correcto en TODAS, sin mismatch con el JSONB); (6) gap de escritura Room asíncrona
  — refutado (`insertarViaje` es `suspend` síncrono). Hipótesis viva no confirmada: `viajesTodos`
  incompleto por desalineación de `orderNumber` en Room con estado de prueba previo.
  **Por qué el modo de falla importa:** el propósito del solapamiento es INTEGRIDAD DEL LAUDO
  (detectar viajes/guardias fantasma — error humano o fraude del chofer para inflar el laudo). El
  caso `size=0` es exactamente el modo de falla que el sistema existe para prevenir. No se puede
  declarar robusto solo con el camino feliz.
  **Red puesta:** logs `Log.d("COT_GUARD")` en `ViajeRepositoy.kt:154,158` (inicio de `crearViaje`
    + antes de `encontrarConflicto`, mostrando `viajesTodos.size`+ids+status+timestamps). DEJADOS
      PUESTOS para capturar reincidencia con dato real. Filtrar logcat `tag:COT_GUARD`.
      **Aprendizaje de método:** el bug NO se reprodujo teorizando (6 hipótesis deductivas fallaron) —
      se reprodujo INSTRUMENTANDO + ejecutando en campo. Ante bug intermitente: instrumentar antes que
      deducir. El dato en vivo (`viajesTodos.size`) ordenó el cuadro que ninguna deducción ordenó.
- **Frente NUEVO mapeado: Sistema de integridad del laudo / validación multi-eje (Próximos Pasos
  #4).** El anti-solapamiento (eje temporal) es la primera pieza de un sistema cuyo propósito es
  detectar inconsistencias que corrompen el laudo. Ejes futuros (sin código hasta integrar Next):
  geográfico (origen nuevo = destino anterior — caso testigo hoy: Mvd→Colonia + Mvd→PdE
  geográficamente imposible), rango horario contra timestamp, y validación en la ASIGNACIÓN desde
  el panel web (los viajes nacerán en el panel y viajarán por mensaje de asignación — solapamiento
  en el origen, misma regla del validador puro corriendo en RPC). Salida: alertas en panel +
  registro en JSON de jornada para auditoría. Diseño aún no definido ("va por allí").
- **Deuda destapada: no hay path de borrado de jornada local desde la UI.** Hoy: borrar datos de
  la app o tocar Supabase a mano. Borrar de Supabase NO saca de Room (sync pull-only). Agrupado con
  el botón de cancelar viaje (Próximos Pasos #3) — misma familia (falta lado destructivo/correctivo
  de la UI).
- **Confirmaciones de arquitectura registradas:** columna Supabase es `order_number` (snake_case),
  `orderNumber` camelCase vive en el JSONB; el JSON visible en Supabase sale del JSONB, NO de la
  tabla `viajes` de Room (dos escrituras distintas). Diálogo de solapamiento muestra "(en_curso)"
  literal → pulir (backlog UI #8).
### 28/06/2026
- **RLS Escalón 3 — CAPÍTULO MAYOR: las 3 tablas UNRESTRICTED encendidas y validadas en campo +
  `comandos_dispositivo` consolidada.** Saldada la deuda de seguridad que bloqueaba el APK por
  este lado. Ya NO hay tablas UNRESTRICTED.
  **Cimiento confirmado (no asumido):** se leyó `SupabaseService.kt` — la app manda la anon key
  como Bearer SIN JWT → rol `anon`, `auth.uid()` null, CERTEZA TOTAL. Toda policy de la app se
  diseña para anon. El `auth.role()=null` que dio el editor al "simular" fue descartado como
  artefacto del editor (fuera de una request real auth.role() es null), no como el rol de la app.
  **`travel_stats` — cerrada al 100%, sin deuda:** CC confirmó que la app no la toca por REST
  (solo Room local). `estimar_llegada` + `registrar_en_travel_stats` → `SECURITY DEFINER` con
  `search_path=public,pg_catalog` (vía `ALTER FUNCTION`, menos invasivo que recrear). Owner=
  postgres. Helper `ts_*` quedaron INVOKER (puras). `ENABLE RLS` sin políticas = deny-all; las
  RPC DEFINER saltean. Validado: `registrar_en_travel_stats('{"id":"TEST-PRU"}')` corrió sin
  error de permisos. Funciones versionadas en `supabase/functions/travel_stats.sql`.
  **`choferes` — RLS encendido, login validado en celu.** Policies ya servían para anon.
  **`jornadas` — RLS encendido, validado en celu (la más delicada).** Viaje de prueba activado +
  cerrado automático; JSON confirmó insert+update+`syncStatus:synced`. Ciclo de escritura completo
  con RLS puesto. Id `-PRU` → no ensucia laudo ni travel_stats.
  **`comandos_dispositivo` — consolidada 10→4 policies.** CC mapeó el uso real: app JS lee anon
  (`?device_id=eq.X&ejecutado=eq.false`), panel inserta authenticated, cero RPC, tabla VACÍA
  (count=0). Nuevas: SELECT `{public}` true; UPDATE `{public}` `(ejecutado=false)` (idempotencia
  en la policy); INSERT `{authenticated}` (HUECO CERRADO: antes cualquier anon inyectaba comandos);
  ALL `{authenticated}`. Validación del INSERT desde panel: pendiente (Próximos Pasos #2).
  **Decisión de diseño clave (atacar raíz, no síntoma):** NO se intentó filtrar `comandos`/
  `jornadas`/`choferes` por chofer vía RLS. Con anon sin login el `device_id` viaja como query
  param, no como claim firmado → RLS no puede verificarlo. Un header `x-device-id` sin firmar da
  SENSACIÓN de seguridad sin darla → descartado. El cierre real es identidad firmada del chofer
  (Auth/claims), nuevo frente #11. RLS hoy protege a nivel EMPRESA (base del multi-tenant), no
  chofer. Deuda documentada honestamente, no parcheada.
  **Aprendizaje de método:** confirmar el rol real leyendo el cliente (no simular en el editor) y
  preguntar a CC el uso real de cada tabla ANTES de escribir policies evitó dos trampas: (1) poner
  `empresa_id='cot'` en comandos hubiera sido decorativo (la app filtra por device_id, no empresa);
  (2) encender RLS en travel_stats sin convertir las RPC a DEFINER las habría bloqueado (eran
  INVOKER). Validación en celu tras CADA encendido, rollback (`DISABLE ROW LEVEL SECURITY`) listo.
  **Bloqueo de deploy de Next levantado por este lado** (cerrar RLS de las 3 tablas era el
  prerequisito). Falta el resto del Escalón 3 (otras tablas legacy) para distribuir el APK.
### 27/06/2026
- **Anti-solapamiento de viajes — pieza 1 (creación manual): CÓDIGO COMPLETO, COMPILADO, CON
  TESTS. Pendiente validación en campo.** [NOTA 29/06: validado el camino feliz; modo de falla
  abierto — ver entrada 29/06.] 5 archivos de producción + 1 de test, BUILD SUCCESSFUL,
  6 tests verdes (5 nuevos + dummy).
  **Hallazgo de diseño:** NO fue un port — el JS vanilla NO tenía motor de solapamiento. Solo
  tenía `existeViajeEnCurso()` (bloquea segundo en_curso, ignora programados) y auto-corte de
  guardia. El caso real (programado creado mientras corre un en_curso que se pisa con él) era
  DISEÑO NUEVO. El JS además era filosóficamente "auto-resolver + avisar" (no bloqueante,
  `console.warn`); la pieza nueva BLOQUEA.
  **Arquitectura:** `SolapamientoValidator` como objeto puro (patrón `PermisosManager`),
  testeable en JVM, mismo código que va a correr en la RPC del servidor más adelante = primer
  caso concreto de "una sola regla, dos lados".
  **Regla implementada:** intervalo `[inicioReal ?: inicioProgramado, fin]`; fin = `finReal` si
  finalizado (fallback `inicio+3h`), si no `inicio+3h`. Cancelado excluido. Solapamiento estricto
  (borde no solapa = viajes consecutivos legítimos). `DURACION_VIAJE_DEFAULT_MS=3h` defensivo
  hasta que `travel_stats` despierte.
  **Bug cazado en revisión (1er intento de CC):** asimetría `inicioReal`/`inicioProgramado` — CC
  usaba `inicioProgramado` para el inicio del intervalo pero `inicioReal ?: inicioProgramado`
  para el fin. Un en_curso con `inicioReal` divergente (activación tardía) habría medido la
  ventana en el lugar equivocado. Corregido a `inicioReal ?: inicioProgramado` en ambos lados.
  [NOTA 29/06: el `?:` no atrapa `0L` — bomba de tiempo latente, a blindar, Próximos Pasos #1a.]
  **2do bug cazado:** CC intentó reemplazar el `2h` de `activarViaje` por la constante de 3h —
  pero ese `2h` es una TOLERANCIA DE ACTIVACIÓN (concepto distinto), no una duración de viaje.
  Se dejó intacto. Solo el `180` de `calcularLlegadaEstimada` (sí es duración) se centralizó.
  **Contrato de retorno:** `crearViaje` pasó de devolver `Viaje` a `CrearViajeResult` sellado
  (`Exito`/`Solapamiento`) — porque los call-sites de UI tragan excepciones (scopes de Compose),
  un `throw` se perdía silenciosamente (mismo modo de falla del bug de cancelación). El sealed
  obliga a cada call-site a manejar el conflicto. Impacto: 3 call-sites (NuevoViajeScreen,
  MainScreen, MensajesPollingWorker), 0 tests rotos (no había), 0 caminos de inserción ocultos.
  [NOTA 29/06: CC re-mapeó 4 caminos — los 3 + vuelta automática; todos pasan por `crearViaje`,
  confirmado sin bypass.]
  **Cuidado crítico en los 3 `when`:** el viaje en conflicto NUNCA se pasa a `GeoTerminalService`
  — el GPS vive dentro del brazo `Exito`. Riesgo evitado: GPS rastreando el viaje equivocado
  habría corrompido `inicioReal`/laudo (bug peor que el solapamiento original).
  **Cobertura:** guard local cubre carga manual (offline, lee Room). Asignación de admin solo
  LOGUEA (no bloquea) — el bloqueo va en el guard del servidor (pendiente, próximos pasos #5).
  **Aprendizaje de método:** revisión edit-por-edit (sin "allow all") cazó los 2 bugs antes de
  compilar. Los primeros tests del proyecto blindan la regla de plata como documentación
  ejecutable.
### 26/06/2026
- **Sobrefacturación por viaje fantasma: CERRADA y VALIDADA EN CAMPO.** Diagnóstico del ESTADO
  viejo era INCORRECTO ("la cancelación marca finalizado") — el JSON real del 23/06 lo desmintió:
  el viaje fantasma nunca recibió cancelación (`inicioReal` siguió siendo el string ISO original,
  jamás pasó por la RPC). **Raíz real (confirmada empíricamente con SELECT en Supabase):** overload
  ambiguo de la RPC `actualizar_viaje_en_jornada` — existían DOS funciones, una de 4 params y otra
  de 5. El cliente cancelaba con 3 args → `ERROR 42725 "function is not unique"` → la cancelación
  fallaba SIEMPRE, determinística, NO era red. Excepción tragada en 3 capas del cliente → Room
  cancelado / Supabase finalizado → laudo lo contaba.
  **Fix en dos capas:**
    - Servidor: versionada la RPC en `supabase/functions/actualizar_viaje_en_jornada.sql`
      (commit f109f8a, respaldo ANTES de tocar). Luego `DROP FUNCTION ...(text,text,bigint,bigint)`.
      Queda 1 sola firma (5 params). Verificado: pg_proc 0 callers internos; finalización ya usaba
      la de 5; la cancelación ya no da `is not unique`.
    - Cliente: `cancelarViajeEnSupabase` ahora llama con 5 args, `p_status="cancelado"` y los 3
      timestamps/bool como `JSONObject.NULL` explícito (sacado el `p_inicio_real=0L`). La RPC solo
      escribe campos `IS NOT NULL` → solo cambia status, preserva el resto. BUILD SUCCESSFUL.
    - Validación en campo: jornada 4112-20260626, viaje programado VJL-1782501425820-PUN cancelado
      desde el Inicio → en Supabase quedó `status:"cancelado"` SIN `finReal` SIN `cierreAutomatico`,
      resto intacto. Propagación de punta a punta confirmada.
    - NO hizo falta la defensa (B) en LaudoCalculator: como el viaje queda correctamente `cancelado`,
      la UI (que ya filtra `!= cancelado`) y el cálculo lo descartan solos. Raíz atacada, no síntoma.
    - **Aprendizaje de método:** la solución obvia del primer pase (PATCH a `/rest/v1/viajes`) habría
      escrito en una tabla MUERTA (3 filas de mayo, nadie la lee). El diagnóstico empírico antes de
      codear lo evitó. La hipótesis de "fallo de red + retry" también habría sido errónea (el fallo era
      100% determinístico; reintentar un request roto no lo arregla).
- **Hallazgo estructural registrado (deuda, no atacada): syncStatus es teatro / sync pull-only.**
  El campo `syncStatus` se escribe pero nunca se lee para push; no hay sync de salida;
  `actualizarSyncStatus` es dead code. Este bug NO dependía de eso (raíz = overload), pero si una
  escritura a Supabase falla por señal real, se pierde sin huella. → Próximos pasos #12 (frente
  "dónde vive la lógica" / sync de salida robusto).
- **Confirmado: tabla `viajes` de Supabase está muerta** (3 filas de mayo, nadie escribe). La verdad
  del laudo vive en `jornadas.data.travels`. Anotado en Arquitectura para no volver a confundir.
- **Sumado a próximos pasos: anti-solapamiento (#1) queda como cabeza de cola** — atado a este fix:
  el fantasma del 23/06 coexistió con el real (77ms) porque la app permite crear viaje encima de
  viaje. [NOTA 27/06: cerrado en código. NOTA 29/06: camino feliz validado en campo.]
### 23/06/2026 (noche)
- **BUG de plata detectado y confirmado: viaje cancelado cuenta en el laudo (sobrefacturación).**
  Un viaje cancelado por el chofer queda en Supabase con `status:"finalizado"` (con `finReal`
  escrito) en vez de cancelado → CUENTA en el laudo. Confirmado con JSON de jornada cerrada
  4112-20260623: `kmViajes:285` (=145 cancelado + 140 real), debió ser 140 → ~$1.700 de más.
  [NOTA 26/06: este diagnóstico resultó INCORRECTO en su mecanismo — ver entrada 26/06. La raíz
  no era "la cancelación marca finalizado" sino un overload ambiguo de la RPC que hacía fallar la
  cancelación SIEMPRE. El síntoma observado (viaje en finalizado) era correcto; la causa, no.]
- **Confirmado que Pieza 2 está bien hecha en el repo** (revisión de HistorialScreen.kt): el
  `totalesPorJornada` (mutableStateMapOf) precalcula una vez en el efecto del período y reparte a
  las JornadaCard vía `totalPrecalculado`, con fallback defensivo si no vino en el mapa. Mata la
  doble invocación. Incluye el fix de hora de fin (arrivalTime → finReal). Detectada deuda menor:
  viático $455.26 hardcodeado en la UI del desglose (display, no cálculo) → backlog UI.
- **Sumada tarea de prevención: anti-solapamiento de viajes/guardias** (portar del JS vanilla).
  [NOTA 27/06: resultó NO ser un port — el JS no tenía el motor. Ver entrada de hoy.]
### 23/06/2026 (tarde)
- **Sync de reabiertas reclasificado: NO era bug de cliente.** Verificado en Database Inspector:
  4112-20260610 con 0 filas en Room. Llega `closed:false`/`activa`, sin `closedAt`/`totalsSnapshot`.
  El "snapshot viejo servido" no existe — no hay fila. `reabierta:true` confirmado inútil como
  discriminador (convive con `activa`). Flujo causante (carga cruzando medianoche) bloqueado por
  diseño en app → entra por panel. Sin fix de cliente. orderNumber del viaje tardío =
  responsabilidad de panel (usar día de salida, no "hoy"; `inicioReal:0` no sirve como fuente).
- **Detectado hueco real (raíz distinta): jornada activa huérfana de día anterior.** Guard
  `createOrder` del JS vanilla no migrado a Kotlin. `getOCrearJornada` no bloquea segunda jornada
  activa de fecha distinta. CC mapeó 6 callers + propuso fix. Corrección de diseño pendiente: el
  guard debe filtrar por fecha (`activa AND fecha != hoy`), no "cualquier activa", para no romper
  la reabierta legítima del día. Agrupado como cabeza del frente "ciclo de vida del estado
  activa". Sesión fue solo diagnóstico: no se tocó código.
### 23/06/2026 (mañana)
- **Bug de hidratación de viajes en historial CERRADO (validado en campo).** Era regresión de
  Pieza 4 paso 2: `obtenerJornadasCerradas` leía solo `totalsSnapshot` y descartaba
  `data.travels[]`, así que las jornadas cerradas sincronizadas nunca poblaban la tabla `viajes`
  de Room → detalle de jornada vacío y PDF en 0. Fix: `parsearViajes` cambia firma `String`→
  `JSONArray`; `obtenerJornadasCerradas` acumula jornadas `closed:true` en `closedArr`, las parsea
  y devuelve `JornadasCerradasResult(jornadas, viajes)`; caller en `ViajeRepositoy` inserta con
  `dao.insertarViajes(...)`. BUILD SUCCESSFUL. Validado en celu (snapshot 20/06: $3.479,61 / 377,47 km).
- **Hora de fin de viaje en historial CERRADO (sale del backlog UI).** Fix en HistorialScreen.kt:
  fallback `arrivalTime` → `finReal` (epoch) formateado a HH:mm. Validado en celu.
- Dato de modelo registrado: `llegadaEstimada` cambió entre 20 (viene `0`) y 21 (ausente). La
  columna sigue en Room (INTEGER nullable); `parsearViajes` tolera su ausencia. Posible relación
  con el bug "Viajes del día vacío" del 21.
- Archivos tocados: `SupabaseService.kt`, `ViajeRepositoy.kt`, `HistorialScreen.kt`.
### 20/06/2026 (noche)
- **Pieza 4 COMPLETA (cierra Frente #1 entero).** Paso 1: migration real 13→14 (ADD COLUMN
  aditivo) reemplaza fallbackToDestructiveMigration; 5 columnas de desglose en entidad Jornada.
  Validado: instala sobre app existente sin wipe ni crash. Paso 2: obtenerTotalesSnapshot lee
  snapshot desde Room en vez de round-trip a Supabase. Historial ~7s → ~0,3s, validado en campo:
  23 jornadas reales correctas.
- Decisión de alcance: app del chofer = mes corriente; historial profundo/impresión = panel
  web. limit=30 del sync confirmado como límite de diseño, no bug.
- Idea de validación en panel precisada: objetivo es cazar error HUMANO de tipeo en carga
  manual, no error de cálculo. Requiere trazabilidad de origen primero.
### 20/06/2026 (día)
- Pieza 2 (Totales una vez por jornada vía Map) aplicada y validada. Detectadas 2 tareas UI
  (hora fin / coche) → backlog.
### 18/06/2026
- Pieza 3 (criterio de calcularTotalesJornada por status) APLICADA y VALIDADA end-to-end con
  jornada real. Subfacturación muerta para reabierta del día. GPS "Escalando a ALTA" y checkpoint
  Colonia validados de paso.
### 15/06/2026
- Diseño completo del fix (4 piezas) sobre código real. Decisión: atacar la raíz (dos fuentes
  de verdad), no parchar. Pieza 1 aplicada. Reopen server-side confirmado en producción.
  Consolidación de docs (13 mds), creados ESTADO/REGLAS/LIMPIEZA.
### 10/06/2026
- Diagnóstico raíz de subfacturación (dos fuentes de verdad). Reopen server-side HECHO/validado.
  Regla: viaje pertenece a la jornada del día en que SALIÓ. Jornadas-testigo se dejan rotas a
  propósito como casos de estudio. Creados ESTADO/REGLAS/LIMPIEZA, inventariados 13 mds.

---

## ⚠️ PROTOCOLO DE CIERRE DE JORNADA DE TRABAJO (LEER SIEMPRE)

Al terminar cada sesión de edición de código / SQL, ANTES de cerrar:
1. **REESCRIBIR** "Dónde estoy parado hoy" y "Próximos pasos" — borrar lo que ya no es
   cierto, no acumular.
2. **AGREGAR** entrada al CHANGELOG (arriba: fecha + qué se hizo + decisiones + pendiente).
   El changelog NO se reescribe, solo crece.
3. Si cambió una REGLA DE NEGOCIO o CONSTANTE → actualizar `REGLAS_NEGOCIO.md`.
4. Si cambió la ARQUITECTURA → actualizar el bloque "Estado vs Objetivo".
5. **Commit** del/los `.md` junto con el código de la sesión. El md viaja CON el código.

**Regla de oro:** si abrís un chat nuevo y este archivo no refleja la realidad, el protocolo
falló. Este es la fuente de verdad portable.