# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> **Última actualización:** 29/06/2026

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

**Anti-solapamiento — pieza 1: VALIDADA EN CAMPO (29/06). El guard rebota correctamente y NO
crea el viaje en conflicto.** Reproducción limpia exitosa: con Room limpio, viaje en_curso
Montevideo→Colonia + intento de programado Montevideo→Punta del Este a +15min → diálogo
"Viaje en conflicto" mostrado, segundo viaje NO creado (JSON de la jornada confirmó `travels[]`
con UN SOLO viaje), GPS no arrancó para el conflicto. Logs `COT_GUARD` confirmaron
`viajesTodos.size=1` con el en_curso visible en la lista en el momento del check.

**PERO ojo — el camino feliz quedó validado, NO el modo de falla. Esto es deuda abierta, no
cerrada.** En un primer intento más temprano del 29/06 (mismo caso) el guard NO rebotó y dejó
crear el segundo viaje. La diferencia entre las dos corridas fue el ESTADO DE ROOM, no el guard:

- **Corrida que falló (temprano):** Room arrastraba estado de pruebas previas. El guard recibió
  `viajesTodos` sin el Viaje 1 (Colonia) en la lista → no detectó conflicto → creó el segundo.
- **Corrida que funcionó (tarde):** Room borrado y limpio. Viaje 1 se creó fresco, su
  `insertarViaje` síncrono (línea 177) lo dejó garantizado en Room → el guard lo vio (`size=1`)
  → rebotó.

**Por qué importa ESTE modo de falla específicamente:** el propósito de fondo del solapamiento
NO es UX — es INTEGRIDAD DEL LAUDO. El sistema existe para detectar inconsistencias (viajes/
guardias fantasma, error humano de tipeo, o carga maliciosa de un chofer queriendo inflar el
laudo). El caso `viajesTodos.size=0` con Room sucio es EXACTAMENTE el modo de falla que el
sistema existe para prevenir: un viaje que entra sin ser validado. Si en producción Room queda
en un estado donde la lista llega incompleta, el guard queda ciego y pasa un fantasma. Por eso
no se puede declarar "robusto" solo con el camino feliz.

**Diagnóstico — qué quedó descartado con dato (NO con deducción):** se persiguieron y refutaron
SEIS hipótesis sobre por qué falló la corrida temprana, cada una contra un dato o contra código:
(1) `0L` no atrapado por `?:` — refutado (Viaje 1 tenía `inicioReal` válido, no cero); (2)
jornada duplicada — refutado (`getOCrearJornada` genera `orderNumber` determinista); (3) Room
desincronizado vía admin/2º dispositivo — refutado (mismo celu, misma sesión); (4) race
condition entre coroutines — refutado (15 min reales entre los dos viajes, no milisegundos); (5)
columna `order_number` vacía corrompiendo el `orderNumber` en Room vía fallback del sync —
refutado (SELECT de las 9 jornadas en Supabase: `order_number` correcto en TODAS); (6) gap de
escritura Room asíncrona — refutado (`insertarViaje` es `suspend` síncrono, sin gap). **La causa
exacta del fallo temprano NO quedó confirmada** — la hipótesis viva es `viajesTodos` incompleto
por desalineación de `orderNumber` en Room con estado de prueba previo, pero no se reprodujo (el
estado de Room que lo disparó se borró antes de capturarlo).

**Red de seguridad puesta:** logs `Log.d("COT_GUARD", ...)` quedaron en `ViajeRepositoy.kt`
(líneas 154 y 158) — uno al inicio de `crearViaje` (confirma que el guard corrió) y otro antes
de `encontrarConflicto` (muestra `viajesTodos.size` + ids + status + timestamps de cada viaje en
la lista). Si el bug reaparece en uso real, el log captura el `size` real en el momento del check
→ se ve si dio 0 → caso real con dato, sin reconstruir. **NO sacar los logs hasta endurecer el
modo de falla.**

**Aprendizaje de método de la sesión:** el bug NO se reprodujo teorizando — se reprodujo
INSTRUMENTANDO (logs) + ejecutando en campo con Room limpio. Las seis hipótesis deductivas
fallaron todas; el dato en vivo (`viajesTodos.size`) fue lo único que ordenó el cuadro. Lección:
ante un bug intermitente, instrumentar antes que deducir. El validator y el guard están sanos
(test verde + campo OK con Room limpio); lo que falta probar es que funcionan SIEMPRE, incluso
con Room en mal estado.

---

## PRÓXIMOS PASOS (en orden)

1. **[ENDURECER — siguiente sesión, prerequisito de APK] Cerrar el modo de falla del
   solapamiento (`viajesTodos.size=0` con Room sucio).** El camino feliz quedó validado hoy; el
   modo de falla NO. Dos sub-tareas:
    - **(a) Blindaje defensivo del `0L`:** cambiar en `SolapamientoValidator` el resolver
      `viaje.inicioReal ?: viaje.inicioProgramado` por `if (inicioReal != null && inicioReal > 0L)
      ...` en AMBOS extremos del intervalo. `0L ?: x` devuelve `0L` (el cero no es null), así que
      un viaje con `inicioReal=0` se mediría desde 1970 y saldría de toda ventana. NO causó el bug
      de hoy, pero es bomba de tiempo latente para un sistema de integridad. + test del caso
      `inicioReal=0L` que los 6 tests actuales NO cubren.
    - **(b) Recrear el Room sucio o confiar en los logs:** decidir entre (i) intentar reproducir
      el `size=0` recreando estado de Room arrastrado (cargar viajes, dejar sincronizar, jornada
      de día anterior sin cerrar) para cazar qué lo dispara, o (ii) dar por suficiente la red de
      logs `COT_GUARD` y cerrar con ellos puestos, atribuyendo el fallo temprano a mugre de
      testing que un chofer con app recién instalada no arrastra. Decisión pendiente; depende de
      cuánto se quiera blindar antes del APK.

2. **[VALIDAR — suelto] INSERT de `comandos_dispositivo` desde el panel.** Mandar un comando de
   prueba (`tipo:'limpiar_jornadas'`) desde el panel admin y confirmar que entra (prueba el
   INSERT `authenticated`) y que la app JS lo recibe/marca ejecutado (prueba SELECT+UPDATE anon).
   No bloqueante: la tabla está vacía. Cierra el círculo de la consolidación RLS del 28/06.

3. **[SIGUIENTE PIEZA — UI] Botones de cancelar viaje en las pantallas + path de borrado de
   jornada local.** Complementa el anti-solapamiento (prevención) con la corrección de lo que ya
   entró. Hoy: viaje programado tiene botón "Cancelar"; viaje en_curso SOLO tiene "Finalizar", no
   "Cancelar". Falta botón de cancelar en en_curso. **La lógica de cancelar YA funciona** (fix del
   26/06: `cancelarViajeEnSupabase` con 5 args + `JSONObject.NULL`, validado en campo) — esto es
   UI, no lógica. **Diseño dura: cancelar un en_curso es DESTRUCTIVO** (descarta km, plata).
   Requiere CONFIRMACIÓN explícita ("¿Cancelar viaje X→Y? Se descarta del laudo"). **CUIDADO
   CRÍTICO:** cancelar un en_curso debe PARAR `GeoTerminalService` además de escribir cancelado —
   si no, GPS huérfano → vuelta fantasma por la otra puerta. **Deuda relacionada destapada hoy:**
   NO existe un path "bueno" de borrado de jornada desde la app (hoy: borrar datos de la app, o
   tocar Supabase a mano). Un chofer con jornada de prueba/errónea no tiene cómo limpiarla. Misma
   familia que el botón cancelar (falta el lado destructivo/correctivo de la UI). Anotar como parte
   de esta pieza.

4. **[FRENTE GRANDE — diseño, NO ahora] Sistema de integridad del laudo / validación multi-eje.**
   El anti-solapamiento (temporal) es la PRIMERA pieza entregada de un sistema más completo cuyo
   propósito es detectar inconsistencias que corrompen el laudo (error humano o fraude del chofer).
   Ejes futuros (sin código hasta integrar el Next):
    - **Eje temporal (ENTREGADO hoy):** solapamiento de horarios. Intervalo
      `[inicioReal ?: inicioProgramado, +3h]`, cancelado excluido, borde no solapa.
    - **Eje geográfico (NUEVO, anotado 29/06):** continuidad — el ORIGEN de un viaje nuevo debería
      coincidir con el DESTINO del viaje anterior. Caso testigo: hoy se cargó Mvd→Colonia y a los
      15min Mvd→Punta del Este (segundo viaje "sale" de Mvd cuando el chofer está yendo a Colonia =
      geográficamente imposible, que ninguna validación temporal atrapa). MATICES a resolver antes
      de implementar: reposicionamiento de coche vacío, arranque desde terminal sin que el destino
      anterior haya sido ahí. Intuición sólida, no trivial.
    - **Eje de rango horario:** validar que un viaje esté en rango razonable contra el timestamp
      registrado; fuera de rango → alerta.
    - **Validación en la ASIGNACIÓN (panel web Next):** en el futuro los viajes/guardias/contratos
      NACEN en el panel web y viajan al chofer por mensaje de asignación. El solapamiento debe
      validarse TAMBIÉN en el origen (cuando se asigna), no solo cuando el chofer carga. Es la misma
      regla del `SolapamientoValidator` (objeto puro) corriendo en el servidor (RPC) — "una sola
      regla, dos lados" (#11). Por eso el validador se diseñó puro y sin excepciones el 27/06.
    - **Salida:** las inconsistencias detectadas abren ALERTA en el panel web y quedan REGISTRADAS
      en el JSON de la jornada para auditoría. Diseño aún no definido por Claudio ("va por allí").
    - Conecta con: backlog tab de reconciliación (#9), auditoría de reaperturas (#10), guard del
      servidor RPC (#5).

5. **[FRENTE — extiende anti-solapamiento, NO ahora] Solapamiento en el servidor + activación.**
    - **Guard del servidor (RPC):** rechazar en la escritura un viaje/bloque solapado. Robusto
      (atómico, sin race). Protege la ASIGNACIÓN DE ADMIN (el celu puede estar apagado).
      `SolapamientoValidator` (lógica pura) es la MISMA regla que va a correr ahí — una sola
      regla, dos lados. Atado al diseño del bloque del día siguiente (definir con la empresa) y al
      frente #4 (asignación desde panel).
    - **Re-chequeo en `ActivarViajeWorker`:** antes de flipear programado→en_curso, re-verificar
      solapamiento. Última red si por la vía de admin (offline) entró un programado que el guard
      local no vio. Barato.

6. **[FRENTE — app + Supabase, sesión propia con CC] Ciclo de vida del estado "activa".**
   Nudo raíz. Arranca por **mapear el ciclo completo** (quién abre/cierra `status="activa"`, qué
   se permite mientras está abierto, bordes: medianoche / día anterior / reapertura) ANTES de
   tocar código. De ese mapa caen:
    - **(1) Guard de jornada activa huérfana de día anterior.** `getOCrearJornada` solo chequea
      `getJornadaPorFecha(hoy)`; si hay una `status="activa"` de día anterior sin cerrar, crea una
      segunda activa en paralelo sin avisar. El guard de `createOrder()` del JS vanilla NO se migró
      a Kotlin. **Discriminador correcto:** `status='activa' AND fecha != :hoy`, NO "cualquier
      activa" (una jornada de día anterior puede ser LEGÍTIMA: viaje que cruzó medianoche).
      Preferir BLOQUEAR + AVISAR, no auto-cerrar en silencio. CC mapeó 6 callers. Alcance 1ª
      pasada: `getOCrearJornada` con filtro de fecha + los 2 callers con catch/UI.
    - **(2) Lógica de 8h del botón "finalizar jornada"** (mostrar solo sin viaje/guardia/contrato
      en curso, como el JS vanilla). Detalle en bugs 21/06.
    - **(3) Bugs de guardia A y B** (bugs 21/06) — requieren reproducción antes de tocar.
    - **(4) Indicador color verde/gris** que no vuelve a verde al reabrir.
      Empezar por (1). **Pendiente:** bajar a `REGLAS_NEGOCIO.md` la regla de cuándo una jornada
      puede reabrirse y qué define que un viaje pertenece a un día (borde de medianoche del 23/06).

7. **[BUG — 21/06, sin diagnosticar] "Viajes del día" vacío con jornada activa.** Sesión propia.
   La tab mostró "0 viajes" teniendo la jornada activa 4112-20260621 tres viajes finalizados y
   sincronizados (`syncStatus:synced`). Sospecha: bug de lectura/filtro de la pantalla,
   posiblemente relacionado al campo `llegadaEstimada` ausente en el JSON del 21 vs presente
   (como `0`) en previos. Atacar con el código de la pantalla + Claude Code. Bug de LECTURA de
   jornada ACTIVA, independiente del frente ciclo de vida.

8. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
    - Número de coche: no se muestra en la fila de viaje del historial; existe en varios viajes
      (`coche:"941"`/`"959"`/`"927"`/`"963"`), vacío en otros. Decidir mostrar-cuando-existe vs exigir.
    - Deuda menor: viático `$455.26` hardcodeado en HistorialScreen (solo display del desglose;
      el cálculo real sale de LaudoCalculator). Debería venir de config. Conecta con "dónde vive
      la lógica".
    - Texto del diálogo de solapamiento muestra `(${status})` crudo (ej. "(en_curso)"). Jerga
      interna en UI. Pulir: mapear `en_curso`→"en curso", etc. (CONFIRMADO en el diálogo del 29/06:
      muestra "(en_curso)" literal.) No urgente.

9. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en panel Next con
   historial en tiempo real de actividad del chofer, edición autorizada por superadmin. Objetivo:
   cazar ERROR HUMANO DE TIPEO en la carga manual (excepción), NO error de cálculo. Prerequisito:
   trazabilidad de origen confiable. Bloqueado además por cambio organizacional (boletos→coches,
   rotación) que define la empresa. Falta UI de edición de viajes en curso/finalizados en el panel.
   Conecta con el frente de integridad del laudo (#4).

10. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp + viaje +
    origen app/panel) en el JSON de la jornada, visible en panel Next. Base sembrada:
    `reabierta:true` sobrevive al recierre. Conecta con el frente de integridad del laudo (#4).

11. **[FUTURO] Identidad firmada del chofer.** Para que RLS pueda filtrar a nivel CHOFER (no solo
    empresa) hace falta que la app lleve identidad firmada: Supabase Auth por chofer, o un esquema
    de claims/JWT. Es trabajo en la APP (no en el panel — el panel ya tiene Auth de admin).
    Habilita cerrar la deuda consciente de RLS (data de cot hoy legible por cualquiera con la anon
    key). NO empezar hasta estabilizar lo en curso; es un capítulo en sí mismo. Conecta con
    multi-empresa (claims de `empresa_id`).

12. **[FUTURO] Dónde vive la lógica de negocio.** Frente de diseño grande (NO empezar hasta cerrar
    laudo + bugs en cola). El anti-solapamiento es el PRIMER caso concreto de "una sola REGLA aunque
    se ejecute en dos lados". Sigue abierto: el sync es pull-only y `syncStatus` es teatro (escrito,
    nunca leído para push; `actualizarSyncStatus` dead code). Sub-tarea: sync de SALIDA real (cola
    persistida + reintento). Conecta con multi-empresa.

13. **[FUTURO] Migración a MVVM.** Después de identidad/RLS fino. No abrir tercer refactor en
    paralelo.

14. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md. Va
    después de React/Next. La config de negocio de cada empresa debe vivir en un solo lugar
    inyectable.

15. **[FUTURO — sin urgencia] Archivado trimestral.** NO es problema de almacenamiento. Justif.
    real: optimización de egress y claridad cuando el volumen sea grande, para alimentar la
    consulta de meses históricos del PANEL. Dirección: desde Supabase (durable), nunca desde Room.

---

## ESTADO DE SEGURIDAD RLS (revisado 28/06 — Escalón 3 mayormente cerrado)

- **Rol real de la app CONFIRMADO: `anon`.** La app manda la anon key como Bearer sin JWT de
  sesión → PostgREST = rol `anon`, `auth.uid()` null. Toda policy de la app debe diseñarse para
  anon; `auth.role()='authenticated'` la bloquea. Cimiento de todo el diseño RLS.
- **Las 3 tablas que estaban UNRESTRICTED ya tienen RLS ENCENDIDO (28/06):**
  `choferes` (login validado), `jornadas` (escritura validada con viaje de prueba),
  `travel_stats` (deny-all + RPC DEFINER). Ya NO hay tablas UNRESTRICTED.
- **DEUDA CONSCIENTE que persiste (NO es bug, es límite de diseño con anon sin login):** las
  policies de `jornadas`/`choferes` filtran por `empresa_id='cot'`, no por chofer. La anon key es
  pública → cualquiera que la extraiga lee toda la data de cot. Cierre real = identidad firmada
  del chofer (Próximos Pasos #11), no más policies. RLS hoy ya protege a nivel empresa (base del
  futuro multi-tenant).
- **`comandos_dispositivo` consolidada** (10→4 policies, INSERT cerrado a authenticated). Tabla
  vacía. Validación del flujo desde panel: pendiente (Próximos Pasos #2).
- **Pendiente de Escalón 3 (no atacado el 28/06):** auditar el resto de las ~42 policies `{public}`
  legacy en otras tablas (`registro_alertas`, `mensajes`, `configuracion`, `coches_taller`,
  `rotacion`, etc.) — varias con `qual=true`/`check=true`. Metodología: inventario fresco,
  explicar-antes-de-ejecutar, validar app+panel. (El CSV de 42 policies del 28/06 sirve de mapa.)
  Sigue siendo prerequisito completar esto antes de distribuir el APK a compañeros.

---

## PANEL WEB NEXT — estado de revisión (sin cambios desde 20/06)

- ✅ Token: usa anon key (pública, OK), NO service_role. Respeta RLS.
- ✅ Auth admin: Supabase Auth real (email/password → access_token en sessionStorage).
- ❌ El chequeo de rol contra tabla `admins` es COSMÉTICO (cliente): decide qué muestra la UI
  pero NO protege datos — la protección real está en RLS.
- ⚠️ Refresh token: se guarda pero NO se usa; el access_token expira (~1h) → 401, re-login.
  Implementar refresh (UX, no urgente).
- ⚠️ Cliente Supabase no centralizado: cada page.tsx hardcodea URL+key. Centralizar en
  lib/supabase (importante para multi-empresa, no urgente).
- ❌ Falta UI de edición/finalización/cancelación de viajes ya cargados. → backlog #9.
- Deploy del panel: el bloqueo por RLS de las 3 tablas UNRESTRICTED quedó LEVANTADO el 28/06.
  Falta completar el resto del Escalón 3 (otras tablas legacy) y decidir el momento del switch de
  dominio. En preview/staging con datos de prueba, OK. (Nota: migrar a Next NO acelera ni requiere
  la identidad del chofer — son ejes independientes; el panel ya tiene su auth.)

---

## ARQUITECTURA — ESTADO vs OBJETIVO

- **Estado actual (hecho):** UI (Compose) → `ViajeRepository` → DAO → Room. **No hay capa
  ViewModel.** Los composables reciben el repository como parámetro y lo llaman directo.
- **Objetivo:** migrar a MVVM (UI → ViewModel → Repository → DAO → Room). Incremental, NO hecha.
- **Regla para Claude Code:** respetar el patrón ACTUAL al tocar código existente. ViewModel SOLO
  en trabajo nuevo o refactors explícitamente marcados "migración MVVM". NO corregir código viejo
  a MVVM de oficio.
- **Capa de lógica pura (patrón establecido):** `PermisosManager` y `SolapamientoValidator` son
  objetos/clases puras sin dependencias de Room/Supabase/Android, testeables en JVM. Patrón a
  seguir para reglas de negocio que deben correr en más de un lado (cliente + servidor) o
  espejarse a Swift (iOS futuro). El `SolapamientoValidator` es la base del futuro sistema de
  integridad del laudo (Próximos Pasos #4).
- **RPCs SECURITY DEFINER (patrón de seguridad establecido):** las RPC que deben escribir tablas
  con RLS deny-all van DEFINER con `search_path` pineado (`public, pg_catalog`). Owner = postgres.
  Aplicado a `actualizar_viaje_en_jornada` (Escalón 2), `estimar_llegada` y
  `registrar_en_travel_stats` (28/06). Las helper puras quedan INVOKER.
- **Room: `CotDatabase` en version 14.** Con MIGRATIONS REALES (`addMigrations(MIGRATION_13_14)`).
  `fallbackToDestructiveMigration` ELIMINADO. La entidad `Jornada` persiste el snapshot completo.
  Room es caché reconstruible desde Supabase. **NOTA 29/06:** la confiabilidad del guard de
  solapamiento depende de que `getViajesPorJornada(orderNumber)` devuelva la lista COMPLETA en el
  momento del check. Con Room limpio funciona; con Room arrastrando estado de pruebas el guard
  recibió lista incompleta y quedó ciego (ver "Dónde estoy parado hoy"). Modo de falla a endurecer.
- **Sync direccional: PULL-ONLY.** `sincronizarDesdeSupabase` trae datos; NO hay push de salida.
  `syncStatus` se escribe pero no se lee para empujar. Deuda en #12. **Consecuencia operativa
  (29/06):** borrar una jornada de Supabase NO la saca de Room (el sync no propaga deletes). Para
  dejar el celu limpio en pruebas: borrar datos de la app (Ajustes → Apps → COT Driver → Borrar
  datos). No hay path de borrado de jornada local desde la UI (deuda, Próximos Pasos #3).
- **Instrumentación activa (29/06):** logs `Log.d("COT_GUARD", ...)` en `ViajeRepositoy.kt`
  (líneas 154, 158) — al inicio de `crearViaje` y antes de `encontrarConflicto`. NO sacar hasta
  endurecer el modo de falla del solapamiento. Filtrar logcat con `tag:COT_GUARD`.
- **OJO — tabla `viajes` de Supabase está MUERTA.** Solo 3 filas de mayo, nadie escribe. NO
  confundir con la tabla `viajes` de Room (esa sí se usa). La verdad del laudo en Supabase vive en
  `jornadas.data.travels` (JSONB). **Recordatorio 29/06:** el JSON que se ve en Supabase sale del
  JSONB, NO de la tabla `viajes` de Room — son dos escrituras distintas; un JSON completo NO
  garantiza que la tabla `viajes` de Room esté completa.
- **Nombres de columna en Supabase: snake_case.** La columna top-level es `order_number` (no
  `orderNumber`). El `orderNumber` camelCase vive DENTRO del JSONB `data`. Confirmado 29/06 vía
  SELECT. Tener presente para queries y para el panel Next.

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes** → `REGLAS_NEGOCIO.md`. (Autoritativos: laudo $8.0122/km,
  viático $455.26. Regla de solapamiento: `DURACION_VIAJE_DEFAULT_MS=3h`, intervalo
  `[inicioReal ?: inicioProgramado, +DURACION]`, finalizado usa `finReal`, cancelado excluido,
  borde no solapa. Los $7.637/$455 de RUTAUY_CONTEXT están OBSOLETOS.) **Pendiente bajar acá:** la
  regla de solapamiento ya está validada en campo — pasarla formalmente a REGLAS_NEGOCIO.md cuando
  se cierre el endurecimiento del modo de falla (Próximos Pasos #1).
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md` (diseño, no impl.).
- **Esquema de tablas Supabase** → RUTAUY_CONTEXT.md (SOLO como mapa de esquema; valores
  obsoletos).
- **RPCs versionadas en `supabase/functions/`:**
    - `actualizar_viaje_en_jornada.sql` (una sola firma de 5 params; la de 4 dropeada el 26/06).
    - `travel_stats.sql` (`estimar_llegada` + `registrar_en_travel_stats` en DEFINER + las helper
        + el ENABLE RLS de la tabla). Estimación APAGADA a propósito (9 buckets / 9 muestras al
          18/06, lejos de c_min=5). Mientras esté apagada, el anti-solapamiento usa la constante
          defensiva de 3h.
- **Historial sprints 1-5 (port JS→Kotlin)** → PLAN_DESARROLLO_KOTLIN.md (histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)
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