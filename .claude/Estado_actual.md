# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> **Última actualización:** 27/06/2026

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
    + device_id contra tabla `choferes`. Filtrado por identidad diferido hasta React/Next.
- **Alcance app del chofer:** muestra el MES CALENDARIO corriente (sync trae últimas 30
  jornadas cerradas). El historial profundo / consulta de meses específicos / impresión es
  responsabilidad del PANEL WEB (Tránsito), no de la app. El `limit=30` del sync es un
  límite de DISEÑO coherente con esto, no un bug.

---

## DÓNDE ESTOY PARADO HOY

**Anti-solapamiento de viajes (pieza 1 — creación manual): CÓDIGO COMPLETO Y COMPILADO.
PENDIENTE VALIDACIÓN EN CAMPO.** Implementado el guard que impide crear un viaje cuya
ventana temporal se pisa con otro viaje de la misma jornada. Hallazgo clave del diseño: esto
NO fue un port del JS vanilla — el JS NO tenía este motor. El JS solo tenía `existeViajeEnCurso()`
(bloquea un segundo en_curso si ya hay uno en_curso, ignora programados) y auto-corte de guardia.
El caso real (programado 22:30 creado mientras corre un en_curso de 22:10, ambos pisándose) era
DISEÑO NUEVO. Atado directo al fix del viaje fantasma del 23/06 (dos viajes a 77ms): el
anti-solapamiento es la red que impide que dos viajes pisados coexistan en origen.

**Qué se entregó (5 archivos de producción + 1 de test, BUILD SUCCESSFUL, 6 tests verdes):**
- **`data/SolapamientoValidator.kt` (nuevo):** objeto puro (sin Room/Supabase, patrón
  `PermisosManager`). `encontrarConflicto(nuevaInicio, nuevaFin, existentes)` devuelve el primer
  viaje que solapa o null. Cada viaje proyecta a un intervalo `[inicio, fin]` en epoch ms:
  inicio = `inicioReal ?: inicioProgramado`; fin = `finReal` si está finalizado (fallback
  `inicio + DURACION`), si no `inicio + DURACION`. Cancelado se excluye. Solapamiento ESTRICTO
  (`a.inicio < b.fin && b.inicio < a.fin`): tocarse en el borde NO solapa (viajes consecutivos
  legítimos). Constante `DURACION_VIAJE_DEFAULT_MS = 3h`. También define `sealed class
  CrearViajeResult { Exito(viaje) | Solapamiento(enConflicto) }`.
- **`data/ViajeRepositoy.kt`:** `crearViaje` ahora devuelve `CrearViajeResult` (no `Viaje`).
  Guard corre tras `getOCrearJornada`, ANTES de `dao.insertarViaje`: arma el candidato
  (`inicioProgramadoMs`, `+DURACION`), lee `getViajesPorJornada` (sin filtro, trae todos los
  status), y si hay conflicto retorna `Solapamiento` SIN insertar. Happy path retorna
  `Exito(viaje)`. El `180` mágico de `calcularLlegadaEstimada` reemplazado por
  `DURACION_VIAJE_DEFAULT_MS / 60_000`. **OJO: el `2h` de `activarViaje` NO se tocó** — es una
  tolerancia de activación (concepto distinto), no una duración de viaje.
- **`ui/theme/NuevoViajeScreen.kt`:** `when(resultado)` — `Exito` arranca GPS con
  `resultado.viaje` + navega/genera vuelta; `Solapamiento` setea estado de un AlertDialog que
  muestra el viaje en conflicto. **El GPS vive DENTRO del brazo Exito; el viaje en conflicto
  NUNCA toca `GeoTerminalService`.** Toda la lógica de vuelta también quedó dentro de Exito (un
  solapamiento no dispara vuelta fantasma).
- **`ui/theme/MainScreen.kt`:** mismo `when` para el botón de viaje de prueba. `Exito` arranca
  GPS modo prueba + `getViajeEnCurso()` (ambos DENTRO del brazo); `Solapamiento` solo `Log.w`.
- **`worker/MensajesPollingWorker.kt`:** asignación de admin. `Exito` loguea `Log.d`;
  `Solapamiento` loguea `Log.w` con id de asignación + datos de ambos viajes (nuevo y conflicto).
  Trazabilidad para cuando llegue el bloque del día siguiente.
- **`test/.../SolapamientoValidatorTest.kt` (nuevo, PRIMEROS TESTS DEL PROYECTO):** 5 casos —
  22:10/22:30 choca, 22:10/01:30 no choca, borde exacto no choca, cancelado ignorado, finalizado
  usa finReal (caso astuto: choca con la regla de +3h pero no con finReal real). Lógica pura,
  corre en JVM sin emulador.

**Cobertura y límites de la pieza 1 (a propósito):** El guard local cubre la CARGA MANUAL del
chofer (`crearViaje`), leyendo Room — offline-safe, no toca red. La ASIGNACIÓN DE ADMIN
(`MensajesPollingWorker`) hoy solo LOGUEA el solapamiento, NO lo bloquea — el bloqueo de
asignaciones va en el guard del servidor (RPC), pendiente. Los viajes que entran por
`sincronizarDesdeSupabase` esquivan el guard intencionalmente (son datos remotos ya existentes).

---

## PRÓXIMOS PASOS (en orden)

1. **[VALIDAR EN CAMPO — cierra pieza 1] Anti-solapamiento en el celu.** Casos:
   (a) jornada activa → en_curso 22:10 (arranca) → programado 22:30 debe REBOTAR con el diálogo
   "Viaje en conflicto", SIN arrancar GPS. (b) 22:10 → viaje 01:30 (fuera de la ventana de 3h)
   debe PERMITIR y arrancar GPS normal. (c) chequeo negativo: un solapamiento bloqueado NO deja
   GPS corriendo ni dispara vuelta fantasma. Si pasa → cerrar en changelog y bajar la regla a
   REGLAS_NEGOCIO.md (ver protocolo).

2. **[SIGUIENTE PIEZA — UI] Botones de cancelar viaje en las pantallas.** Complementa el
   anti-solapamiento (prevención) con la corrección de lo que ya entró. Hoy: viaje programado
   tiene botón "Cancelar"; viaje en_curso SOLO tiene "Finalizar", no "Cancelar". Falta botón de
   cancelar en en_curso. **La lógica de cancelar YA funciona** (fix del 26/06:
   `cancelarViajeEnSupabase` con 5 args + `JSONObject.NULL`, validado en campo) — esto es UI, no
   lógica. **Diseño dura: cancelar un en_curso es DESTRUCTIVO** (descarta km, plata). Requiere
   CONFIRMACIÓN explícita ("¿Cancelar viaje X→Y? Se descarta del laudo") para que el chofer no
   apriete cancelar queriendo finalizar. El cancelar de programado es menos grave (el viaje aún
   no pasó). Sirve también para no guardar viajes mal cargados.

3. **[FRENTE — extiende anti-solapamiento, NO ahora] Solapamiento en el servidor + activación.**
   Dos sub-piezas que cierran las puntas que la pieza 1 dejó abiertas a propósito:
    - **Guard del servidor (RPC):** rechazar en la escritura un viaje/bloque solapado. Robusto
      (atómico, sin race). Es el que protege la ASIGNACIÓN DE ADMIN (el celu puede estar apagado).
      `SolapamientoValidator` (lógica pura) es la MISMA regla que va a correr ahí — una sola regla,
      dos lados (Próximos Pasos #10). Atado al diseño del bloque del día siguiente (definir con la
      empresa).
    - **Re-chequeo en `ActivarViajeWorker`:** antes de flipear programado→en_curso, re-verificar
      solapamiento. Última red si por la vía de admin (offline) entró un programado que el guard
      local no vio. Barato.

4. **[FRENTE — app + Supabase, sesión propia con CC] Ciclo de vida del estado "activa".**
   Nudo raíz que encadena varios ítems. La sesión arranca por **mapear el ciclo completo**
   (quién abre/cierra `status="activa"`, qué se permite mientras está abierto, bordes:
   medianoche / día anterior / reapertura) ANTES de tocar código. De ese mapa caen:
    - **(1) Guard de jornada activa huérfana de día anterior.** `getOCrearJornada` solo chequea
      `getJornadaPorFecha(hoy)`; si hay una jornada `status="activa"` de día anterior sin cerrar
      (ej. pernocta/quedada — el chofer durmió en destino y no cerró), crea una segunda activa en
      paralelo sin avisar. El guard de `createOrder()` del JS vanilla (`if getActiveOrder() throw
      YA_EXISTE_JORNADA_ACTIVA`) NO se migró a Kotlin. **OJO con el diseño:** el discriminador
      correcto es **activa de día ANTERIOR a hoy** (`status='activa' AND fecha != :hoy`), NO
      "cualquier activa" — porque una jornada de día anterior puede ser LEGÍTIMA (viaje que cruzó
      medianoche), no siempre es error. Preferir BLOQUEAR + AVISAR, no auto-cerrar en silencio
      (auto-cerrar obliga a inventar un timestamp de cierre y si se pega mal corrompe el laudo).
      CC mapeó 6 callers (#2/#4 ya con catch, #3/#5/#6 crash risk, #1 worker = loop silencioso).
      Alcance 1ª pasada: `getOCrearJornada` con filtro de fecha + los 2 callers con catch/UI.
    - **(2) Lógica de 8h del botón "finalizar jornada"** (mostrar solo sin viaje/guardia/contrato
      en curso, como el JS vanilla). Detalle en bugs 21/06 abajo.
    - **(3) Bugs de guardia A y B** (detalle en bugs 21/06 abajo) — requieren reproducción antes
      de tocar.
    - **(4) Indicador color verde/gris** que no vuelve a verde al reabrir (detalle en backlog UI).
      Empezar probablemente por (1). **Pendiente:** bajar a `REGLAS_NEGOCIO.md` la regla de cuándo
      una jornada puede reabrirse y qué define que un viaje pertenece a un día (incluida la
      condición de borde de medianoche clarificada el 23/06), hoy implícita.

5. **[FRENTE] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología: inventario fresco primero, explicar-antes-de-ejecutar, comparación
   antes/después, validar contra app del chofer Y panel tras cada cambio. (Prerequisito
   para distribuir el APK a compañeros. Ver bloque "Estado de seguridad RLS" abajo.)

6. **[BUG — 21/06, sin diagnosticar] "Viajes del día" vacío con jornada activa.** Sesión propia,
   NO mezclar. La tab mostró "0 viajes" teniendo la jornada activa 4112-20260621 tres viajes
   finalizados y sincronizados en Supabase (`syncStatus:synced`). Regresión confirmada (la
   pantalla antes mostraba los finalizados). Sospecha: bug de lectura/filtro de la pantalla,
   posiblemente relacionado al campo `llegadaEstimada` ausente en el JSON del 21 vs presente
   (como `0`) en JSONs previos. Atacar con el código de la pantalla + Claude Code. Síntoma
   distinto al de historial: este es jornada ACTIVA y bug de LECTURA, no de sync/hidratación.
   (NO es parte del frente ciclo de vida — es bug de lectura independiente.)

7. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
      (Parte del frente ciclo de vida #4, pieza 4 — depende de detectar bien el cambio de estado.)
    - Número de coche: no se muestra en la fila de viaje del historial; existe en varios
      viajes (`coche:"941"`/`"959"`/`"927"`), vacío en otros. Decidir mostrar-cuando-existe (UI)
      vs exigir el coche en la carga (negocio).
    - Deuda menor: el viático `$455.26` está hardcodeado en HistorialScreen (solo para el display
      del desglose del período; el cálculo real sale de LaudoCalculator). Debería venir de config.
      Conecta con el frente "dónde vive la lógica".
    - Texto del diálogo de solapamiento muestra `(${status})` crudo (ej. "(en_curso)"). Jerga
      interna asomando en UI. Pulir: mapear `en_curso`→"en curso", etc. No urgente.

8. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en el panel
   Next con historial en tiempo real de la actividad del chofer (viajes, guardias,
   contratos, horarios), con edición autorizada por el superadmin. PROPÓSITO PRECISADO
   (20/06): el sistema busca MÍNIMA intervención humana — viajes/guardias/contratos salen
   del panel por asignación automática vía mensajes. La carga manual del chofer es la
   EXCEPCIÓN (chofer sin señal, viaje pasado por teléfono). Lo que se valida es el ERROR
   HUMANO DE TIPEO en esa carga manual (un km, un destino, una hora mal), NO error de
   cálculo de la app (el laudo calcula bien). **Prerequisito: trazabilidad de origen
   confiable** (sellar quién creó cada viaje). **Bloqueado además por cambio
   organizacional** (regla demanda boletos→coches, rotación) que define la empresa — falta el
   detalle de CÓMO el admin agrega coches a un viaje (es por venta de boletos pero sin detalle).
   NO diseñar adivinando. **Falta UI de edición de viajes en curso / finalizados** (el panel hoy
   NO tiene botón para finalizar/editar/cancelar un viaje ya cargado; solo enviar uno nuevo).

9. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
   viaje + origen app/panel) en el JSON de la jornada, visible en panel Next. Base sembrada:
   `reabierta:true` sobrevive al recierre.

10. **[FUTURO] Dónde vive la lógica de negocio.** Frente de diseño grande (NO empezar hasta
    cerrar laudo + bugs en cola). Lógica duplicada en app (Kotlin/Room) y Supabase que a veces
    diverge. **El anti-solapamiento es el PRIMER caso concreto del principio "una sola REGLA
    aunque se ejecute en dos lados":** `SolapamientoValidator` puro corre en el celu (guard local)
    y va a correr en la RPC (guard servidor) — misma regla, dos lados. **Sigue abierto: el sync es
    pull-only y `syncStatus` es teatro** (escrito, nunca leído para push; `actualizarSyncStatus`
    dead code; sin sync de salida). Cualquier escritura a Supabase que falle por red se pierde sin
    huella. Marco: NO mudar todo a Supabase (la app DEBE funcionar offline). Sub-tarea: diseñar un
    sync de SALIDA real (cola de deuda persistida + reintento). Conecta con multi-empresa.

11. **[FUTURO] Migración a MVVM.** Después de RLS Escalón 3. No abrir tercer refactor en paralelo.

12. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md. Va
    después de React/Next. La config de negocio de cada empresa debe vivir en un solo lugar
    inyectable.

13. **[FUTURO — sin urgencia] Archivado trimestral.** NO es problema de almacenamiento
    (Supabase free 500MB alcanza años). Justificación REAL: optimización de egress y claridad
    cuando el volumen sea grande, para alimentar la consulta de meses históricos del PANEL (no la
    app). Dirección correcta: desde Supabase (durable), nunca desde Room.

---

## ESTADO DE SEGURIDAD RLS (revisado 20/06 noche)

- **3 tablas UNRESTRICTED (RLS apagado) A PROPÓSITO durante desarrollo:**
  `choferes`, `jornadas`, `travel_stats`. Se dejan abiertas para iterar libre sobre
  Supabase + código sin pelear contra RLS en cada cambio de esquema. DEUDA CONSCIENTE.
  Datos sensibles (legajos, montos, identidad) hoy legibles por cualquiera con la anon key
  (que es pública). **Cerrar — encender RLS + escribir políticas en la MISMA operación —
  es prerequisito duro antes de: (a) distribuir el APK a compañeros, (b) desplegar el panel
  Next a producción real.** Las otras tablas ya tienen RLS activo.
- **Reto de diseño al cerrarlas:** la app del chofer usa anon SIN login (identidad =
  legajo+device_id, no Supabase Auth). Encender RLS sin la política correcta le corta el
  acceso a la app instantáneamente. Las políticas deben permitir: anon (app) → solo sus
  propios datos filtrados por legajo/device; authenticated (panel) → acceso amplio validado
  contra tabla `admins`. Encender RLS y escribir política van JUNTOS, tabla por tabla, con
  validación en celu + panel tras cada una.

---

## PANEL WEB NEXT — estado de revisión (20/06 noche)

- ✅ Token: usa anon key (pública, OK), NO service_role. Respeta RLS.
- ✅ Auth admin: Supabase Auth real (email/password → access_token en sessionStorage).
- ❌ El chequeo de rol contra tabla `admins` es COSMÉTICO (cliente): decide qué muestra la
  UI pero NO protege datos — la protección real debe estar en RLS (ver arriba). Cualquier
  token válido (o la anon key sola) accede a las tablas UNRESTRICTED igual.
- ⚠️ Refresh token: se guarda pero NO se usa; el access_token expira (~1h) → los fetch
  empezarán a dar 401 y el admin deberá re-loguearse. Implementar refresh (UX, no urgente).
- ⚠️ Cliente Supabase no centralizado: cada page.tsx hardcodea URL+key y hace fetch directo.
  Centralizar en lib/supabase (un punto de config) — prolijidad, importante para multi-empresa,
  no urgente. (La key hardcodeada NO es problema: la anon key es pública por diseño.)
- ❌ Falta UI de edición/finalización/cancelación de viajes ya cargados (en curso o finalizados).
  Hoy el panel solo permite enviar viajes nuevos. → backlog #8.
- Deploy del panel: NO desplegar a producción real hasta cerrar RLS de las 3 tablas. En
  preview/staging con datos de prueba, OK.

---

## ARQUITECTURA — ESTADO vs OBJETIVO

- **Estado actual (hecho):** UI (Compose) → `ViajeRepository` → DAO → Room. **No hay capa
  ViewModel.** Los composables reciben el repository como parámetro y lo llaman directo.
- **Objetivo:** migrar a MVVM (UI → ViewModel → Repository → DAO → Room). Incremental, NO
  hecha aún.
- **Regla para Claude Code:** respetar el patrón ACTUAL al tocar código existente. ViewModel
  SOLO en trabajo nuevo o refactors explícitamente marcados "migración MVVM". NO corregir
  código viejo a MVVM de oficio.
- **Capa de lógica pura (patrón establecido):** `PermisosManager` y ahora
  `SolapamientoValidator` son objetos/clases puras sin dependencias de Room/Supabase/Android,
  testeables en JVM. Patrón a seguir para reglas de negocio que deben correr en más de un lado
  (cliente + servidor) o espejarse a Swift (iOS futuro).
- **Room: `CotDatabase` en version 14.** Con MIGRATIONS REALES (`addMigrations(MIGRATION_13_14)`).
  El `fallbackToDestructiveMigration` FUE ELIMINADO (Pieza 4 paso 1) — ya no es deuda de prod.
  La entidad `Jornada` persiste el snapshot completo (7 campos del desglose). El sync de
  arranque corre incondicional, así que Room es caché reconstruible desde Supabase.
- **Sync direccional: PULL-ONLY.** `sincronizarDesdeSupabase` trae datos; NO hay push de
  salida. `syncStatus` se escribe pero no se lee para empujar. Deuda registrada en #10.
- **OJO — tabla `viajes` de Supabase está MUERTA.** Solo 3 filas de mayo, nadie escribe ahí
  hoy. NO confundir con la tabla `viajes` de Room (esa sí se usa). La verdad del laudo en
  Supabase vive en `jornadas.data.travels` (JSONB), no en la tabla `viajes`.

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes** → `REGLAS_NEGOCIO.md`. (Autoritativos: laudo
  $8.0122/km, viático $455.26. **Nuevo: regla de solapamiento de viajes** —
  `DURACION_VIAJE_DEFAULT_MS=3h`, intervalo `[inicioReal ?: inicioProgramado, +DURACION]`,
  finalizado usa `finReal`, cancelado excluido, borde no solapa. Los $7.637/$455 de
  RUTAUY_CONTEXT están OBSOLETOS.)
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md` (diseño, no
  implementado).
- **Esquema de tablas Supabase** → RUTAUY_CONTEXT.md (SOLO como mapa de esquema; valores de
  cálculo obsoletos).
- **RPC actualizar_viaje_en_jornada** → VERSIONADA en
  `supabase/functions/actualizar_viaje_en_jornada.sql` (una sola firma de 5 params; la de 4
  fue dropeada el 26/06). Las funciones de `travel_stats` siguen SIN versionar — pendiente
  guardarlas en `supabase/functions/travel_stats.sql`. Estimación APAGADA a propósito
  (9 buckets / 9 muestras al 18/06, lejos del umbral c_min=5). Mientras esté apagada, el
  anti-solapamiento usa la constante defensiva de 3h; cuando despierte, pasa a leer estimación
  por ruta.
- **Historial sprints 1-5 (port JS→Kotlin)** → PLAN_DESARROLLO_KOTLIN.md (histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)
### 27/06/2026
- **Anti-solapamiento de viajes — pieza 1 (creación manual): CÓDIGO COMPLETO, COMPILADO, CON
  TESTS. Pendiente validación en campo.** 5 archivos de producción + 1 de test, BUILD SUCCESSFUL,
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
  **2do bug cazado:** CC intentó reemplazar el `2h` de `activarViaje` por la constante de 3h —
  pero ese `2h` es una TOLERANCIA DE ACTIVACIÓN (concepto distinto), no una duración de viaje.
  Se dejó intacto. Solo el `180` de `calcularLlegadaEstimada` (sí es duración) se centralizó.
  **Contrato de retorno:** `crearViaje` pasó de devolver `Viaje` a `CrearViajeResult` sellado
  (`Exito`/`Solapamiento`) — porque los call-sites de UI tragan excepciones (scopes de Compose),
  un `throw` se perdía silenciosamente (mismo modo de falla del bug de cancelación). El sealed
  obliga a cada call-site a manejar el conflicto. Impacto: 3 call-sites (NuevoViajeScreen,
  MainScreen, MensajesPollingWorker), 0 tests rotos (no había), 0 caminos de inserción ocultos.
  **Cuidado crítico en los 3 `when`:** el viaje en conflicto NUNCA se pasa a `GeoTerminalService`
  — el GPS vive dentro del brazo `Exito`. Riesgo evitado: GPS rastreando el viaje equivocado
  habría corrompido `inicioReal`/laudo (bug peor que el solapamiento original).
  **Cobertura:** guard local cubre carga manual (offline, lee Room). Asignación de admin solo
  LOGUEA (no bloquea) — el bloqueo va en el guard del servidor (pendiente, próximos pasos #3).
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
  escritura a Supabase falla por señal real, se pierde sin huella. → Próximos pasos #10 (frente
  "dónde vive la lógica" / sync de salida robusto).
- **Confirmado: tabla `viajes` de Supabase está muerta** (3 filas de mayo, nadie escribe). La verdad
  del laudo vive en `jornadas.data.travels`. Anotado en Arquitectura para no volver a confundir.
- **Sumado a próximos pasos: anti-solapamiento (#1) queda como cabeza de cola** — atado a este fix:
  el fantasma del 23/06 coexistió con el real (77ms) porque la app permite crear viaje encima de
  viaje. [NOTA 27/06: cerrado en código, ver entrada de hoy.]
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