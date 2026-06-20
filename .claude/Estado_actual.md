# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Este es el archivo que se pega al inicio de cada chat
> (con Claude o Claude Code) para tener el contexto al día. Se REESCRIBE en cada cierre
> de jornada de trabajo (ver PROTOCOLO DE CIERRE al pie). Lo que deja de ser cierto, se
> borra de "Estado" y queda preservado en el CHANGELOG.
>
> > **Última actualización:** 20/06/2026

---

## SNAPSHOT

- **Qué es:** app Android nativa (Kotlin, `com.driverlog.app`, branch `main`) para
  digitalizar jornadas de choferes de transporte en Uruguay.
- **Backend:** Supabase (Postgres + RLS + RPCs) + FCM push. Lógica de laudo centralizada.
- **Panel admin:** Vanilla JS en `cot-driver-admin.netlify.app`. (Migración a Next/React
  ya hecha, sin desplegar — ver backlog.)
- **Fase:** pre-producción. APK aún NO distribuido a choferes. Producción = solo entorno
  de prueba propio (Claudio testea en campo y PC).
- **Auth:** la app usa SOLO la anon key (no hay Supabase Auth por chofer). Login = legajo
    + device_id contra tabla `choferes`. El filtrado por identidad de chofer queda diferido
      hasta la migración a React/Next.

---

## DÓNDE ESTOY PARADO HOY

**Frente activo: fix de raíz del laudo cliente (subfacturación). 4 piezas, 3 hechas.**

El laudo tenía dos fuentes de verdad que divergían: Supabase calcula desde `travels`
(correcto); la app servía `kmTotal`/`monto` planos de Room sin recalcular. Una jornada
reabierta mostraba el monto viejo congelado → subfacturación.

**HECHO y validado:**
- **Reopen server-side** (helper `_reabrir_jornada_si_corresponde` + integración en
  `agregar_viaje_a_jornada`/`agregar_guardia_a_jornada`). En producción, confirmado en vivo.
- **Pieza 1** — caché de `getConfiguracion` (companion object @Volatile + TTL 5min).
  Aplicada y validada.
- **Pieza 3** — criterio de `calcularTotalesJornada` por status (activa/reabierta →
  recalcula; cerrada → snapshot). Aplicada y VALIDADA end-to-end en celu el 18/06.
  El bug de subfacturación está muerto para la jornada reabierta del día.
- **Pieza 2** — en HistorialScreen, Totales se calculan una vez por jornada en el bucle de
  período y se comparten a las JornadaCard vía un Map (`totalesPorJornada`). Aplicada y
  validada el 20/06. NOTA: el dedup es parcial — las cards visibles en el primer frame
  pierden la carrera contra el LaunchedEffect del período (mapa aún vacío) y caen al
  fallback, así que siguen fetcheando. Las fuera de pantalla sí se benefician. El cierre
  REAL de la doble red se completa en Pieza 4 leyendo el snapshot DESDE Room en vez de la
  red (hoy cada lectura de snapshot es un round-trip a Supabase; ~25 fetches para 20
  jornadas, ~6s secuenciales). Ver Pieza 4.

**PENDIENTE (próximos pasos):**
- **Pieza 4** — persistir snapshot completo en Room + migrations reales (sacar
  `fallbackToDestructiveMigration`, decidir ANTES del build) + bump schema + ajustar sync
  para que una jornada reabierta de día anterior pueda volver a Room. (La Pieza 3 cubre la
  reabierta DE HOY; la de días anteriores necesita esta pieza.) **Incluye ahora:** leer el
  `totalsSnapshot` desde Room en HistorialScreen para cerrar la doble red de Pieza 2 y
  eliminar los ~6s de egress del historial.

---

## PRÓXIMOS PASOS (en orden)

1. **[FRENTE #1] Fix cliente del laudo — Pieza 4 (la más invasiva, bump de schema):**
    - Persistir el desglose del snapshot en Room (no solo kmTotal/monto).
    - Enganchar migrations reales (sacar `fallbackToDestructiveMigration`) para no perder
      datos locales en el bump. DECIDIR esto ANTES de instalar ese build. (Riesgo confirmado:
      incidente 09/06, 8 crashes por mismatch de schema hash; ese es el modo de falla que van
      a sufrir los choferes en un update de schema sin migrations.)
    - Ajustar las 2 queries de sync para que una jornada reabierta (closed:false, no de hoy)
      pueda volver a Room.
    - Leer `totalsSnapshot` desde Room en HistorialScreen (cierra la doble red de Pieza 2).

2. **[PARALELO] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología establecida: inventario fresco primero, explicar-antes-de-ejecutar,
   comparación antes/después, validar contra app del chofer Y panel admin tras cada cambio.
   (Prerequisito para distribuir el APK a compañeros, junto con Pieza 4.)

3. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) del nº funcionario+base+tipo en
      pantalla principal debe volver a verde al reabrir.
    - Hora de fin de viaje: la card pinta `arrivalTime`, que el flujo de cierre por GPS deja
      vacío (`""`). El dato real está en `finReal` (timestamp). Fix: fallback
      `arrivalTime` → derivar HH:mm de `finReal` cuando arrivalTime esté vacío.
    - Número de coche: no se muestra en la fila de viaje del historial. En varios viajes el
      dato existe (`coche:"941"`), en otros viene vacío en origen (`coche:""`). Decidir si es
      solo mostrar-cuando-existe (UI) o si el flujo de carga debería exigir el coche (negocio).

4. **[BACKLOG] Tab de reconciliación en el panel admin.** Pantalla nueva con historial en
   tiempo real de la actividad del chofer (viajes, guardias, contratos, horarios), con
   edición autorizada por el superadmin. Propósito: la fuente de verdad es lo que Tránsito
   asigna por mensaje; lo que aparezca sin asignación = "operación inválida" → notificación
   al chofer. El superadmin corrige lo que el admin mandó mal o el chofer cargó mal,
   sobre todo si la salida está próxima. **Requiere trazabilidad de origen primero**
   (sellar `origenCreacion` server vs app — hoy todo cae a `"app"`). **Bloqueado por
   cambio organizacional** (regla de demanda boletos→coches, rotación de efectivos) que
   define la empresa, no el código. Avanza la trazabilidad (infra) sin esperar eso.

5. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
   viaje que la causó + origen app/panel) en el JSON de la jornada, visible en panel Next.
   Base ya sembrada: el flag `reabierta:true` sobrevive al recierre. Va después de Pieza 4.

6. **[FUTURO] Migración a MVVM.** Ver bloque de arquitectura. Objetivo, no ahora — después
   de cerrar frente #1 y RLS Escalón 3. No abrir un tercer refactor en paralelo.

7. **[FUTURO] Multi-empresa.** Objetivo del proyecto. Diseño en MULTIEMPRESA.md /
   ESTRATEGIA_MULTIEMPRESA.md (consulta). Va después de la migración a React/Next.

---

## ARQUITECTURA — ESTADO vs OBJETIVO

- **Estado actual (hecho):** UI (Compose) → `ViajeRepository` → DAO → Room.
  **No hay capa ViewModel.** Los composables reciben el repository como parámetro y lo
  llaman directo.
- **Objetivo:** migrar a MVVM (UI → ViewModel → Repository → DAO → Room) por orden y
  separación de capas. Migración incremental, NO hecha aún.
- **Regla para Claude Code:** respetar el patrón ACTUAL al tocar código existente.
  Introducir ViewModel SOLO en trabajo nuevo o en refactors explícitamente marcados como
  "migración MVVM". NO "corregir" código viejo a MVVM de oficio.
- Room: `CotDatabase` en **version 13** (no v10 como decía el CLAUDE.md viejo). Todavía
  con `fallbackToDestructiveMigration` — deuda de prod: migrations reales antes de publicar
  (es parte de Pieza 4).

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes de cálculo** → `REGLAS_NEGOCIO.md`. (Valores
  autoritativos: laudo $8.0122/km, viático $455.26. Los $7.637/$455 de RUTAUY_CONTEXT
  están OBSOLETOS, no usar.)
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md` (vigentes
  como diseño, no implementados).
- **Esquema de tablas Supabase completo** → RUTAUY_CONTEXT.md (útil SOLO como mapa de
  esquema; sus valores de cálculo están obsoletos).
- **Historial de sprints 1-5 (port JS→Kotlin)** → PLAN_DESARROLLO_KOTLIN.md (archivo
  histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)
### 20/06/2026
- Pieza 2 (Totales una vez por jornada en HistorialScreen, compartidos a JornadaCard vía
  Map `totalesPorJornada`) APLICADA. Build OK, validada en celu contra 20 jornadas reales:
  cada cerrada muestra su snapshot correcto, la reabierta 4112-20260618 (reabierta:true)
  devuelve su snapshot $7.925,2011 / 875,5 km → Pieza 3 intacta, el Map no pisa valores.
- Dedup CONFIRMADO PARCIAL: ~25 fetches para 20 jornadas (5 cards visibles en primer frame
  pierden la carrera contra el LaunchedEffect del período y caen al fallback). Race visible
  en logcat (dos obtenerTotalesSnapshot de 4112-20260607 a 1ms, ambos antes de poblarse el
  Map). Decisión: NO perseguir el race con un gate (mostraría "cargando" hasta ~6s sobre un
  loop de red secuencial que no debería existir). El cierre real se hace en Pieza 4 leyendo
  el snapshot DESDE Room en vez de la red. El Map queda como infra correcta para eso.
- Hallazgo: cada lectura de snapshot en el historial es un round-trip a Supabase
  (`obtenerTotalesJornada`), ~6s secuenciales para 20 jornadas, pese a que las jornadas YA
  están en Room (sync del arranque las guarda). Es el cuello de egress anotado el 15/06.
  Se ataca en Pieza 4.
- Detectadas 2 tareas UI nuevas (sueltas, anotadas en backlog, NO en este commit):
  (a) hora de fin de viaje: la card lee `arrivalTime` que el cierre por GPS deja vacío; el
  dato real está en `finReal`. (b) nº de coche no se muestra en la fila de viaje; en varios
  viajes existe, en otros viene vacío en origen.
### 18/06/2026
- Pieza 3 (criterio de calcularTotalesJornada por status) APLICADA y VALIDADA end-to-end
  en celu con jornada real del día. Prueba: cerrada con 2 viajes ($2.824,30 / 352,5 km) ->
  agregado 3er viaje (Mvd-Colonia) -> reabrió sola (closed:false, status:activa, 3 travels,
  confirmado en logcat) -> cerrada de nuevo -> recalculó correcto ($4.250,47 / 530,5 km,
  KM viajes 280->458). Tome/Cese NO se duplicó (42,5). BUG DE SUBFACTURACIÓN MUERTO para
  jornada reabierta del día.
- Validado de paso: GPS "Escalando a ALTA" capturado (distancia 9950m) y checkpoint Colonia
  (Radial Juan Lacaze) funcionando — pendientes desde el 10/06.
- Nota: el historial NO muestra la jornada activa del día (filtro fecha!=hoy || cerrada);
  por eso para ver la reabierta hay que cerrarla. Comportamiento esperado, no bug.
- Detectada tarea UI: indicador de color (verde=abierta/gris=cerrada) del nº funcionario+
  base+tipo en pantalla principal debe volver a verde al reabrir. Anotada como pieza aparte.
- Detectada tarea: registro de auditoría de reaperturas (eventos timestamp+viaje+origen en
  el JSON, visible en panel Next). Anotada como pieza aparte.
### 15/06/2026
- Diseño completo del fix de raíz del laudo cliente (4 piezas), sobre código real mapeado
  con Claude Code. Decisión: atacar la raíz (dos fuentes de verdad Room-plano vs Supabase),
  no parchar.
- Regla de decisión confirmada: ABIERTA->recalcula local / CERRADA->snapshot. Se apoya en
  la regla temporal (jornada vive en su día calendario, reopen nunca cruza 23:59:59, por lo
  que abierta siempre es de hoy y tiene travels en Room).
- Pieza 1 (caché getConfiguracion, companion object @Volatile + TTL 5min) APLICADA y
  validada en celu. No cachea vacío, conserva caché viejo ante fallo de red.
- Confirmado en vivo: reopen server-side funciona en produccion (4112-20260610 baja
  reabierta, sin snapshot).
- Despejada preocupación de almacenamiento Supabase: free tier 500MB alcanza para años;
  el cuello real es egress/red del historial, no espacio. Persistir snapshot en Room
  (Pieza 4) no agranda Supabase.
- Consolidación de docs: inventariados 13 mds del repo (Claude Code), detectadas
  contradicciones (laudo $7.637 vs $8.0122, MVVM, estado RLS). Creados ESTADO_ACTUAL.md,
  REGLAS_NEGOCIO.md, LIMPIEZA_REPO.md.
- Regla temporal agregada a REGLAS_NEGOCIO.md: pertenencia de viaje por hora de INICIO;
  jornada atada a su día calendario; corte 23:59:59.
### 10/06/2026
- **Diagnóstico raíz de la subfacturación del laudo:** identificadas las dos fuentes de
  verdad (Supabase calcula desde `travels`; app sirve `kmTotal`/`monto` planos de Room sin
  recalcular por el cortocircuito de `calcularTotalesJornada`). El borrado de
  `totalsSnapshot` en Supabase NO mueve la app porque casi nunca lee el snapshot.
- **Fix de reopen server-side (HECHO, validado):** helper `_reabrir_jornada_si_corresponde`
    + integración en `agregar_viaje_a_jornada` y `agregar_guardia_a_jornada`. Idempotente,
      sin gate de fecha (regla de negocio: regreso post-medianoche = order_number nuevo
      siempre), sin RAISE (rechazar perdería viajes que la app no maneja). Probado con jornada
      TEST en los dos caminos.
- **Endurecimiento de paso:** `search_path` pineado en `agregar_viaje_a_jornada`; COALESCE
  defensivo en guards.
- **Regla de negocio confirmada:** un viaje pertenece a la jornada del día en que SALIÓ
  (inicio), no la de fin. Sale antes de medianoche y cierra después → cuenta para el día
  de salida. Sale después de medianoche → order_number nuevo, jornada nueva, siempre.
- **Decisión de método:** las jornadas-testigo (ej. 4112-20260610) se dejan rotas a
  propósito como casos de estudio; no se recuperan con precisión.
- **Pendiente identificado:** el `status` de jornada activa es `"activa"` (confirmado en
  Jornada.kt, ViajeRepositoy.kt, SupabaseService.kt). Solo existen dos status: "activa" y
  "finalizada".
- **Consolidación de documentación:** creados ESTADO_ACTUAL.md (este), REGLAS_NEGOCIO.md y
  LIMPIEZA_REPO.md. Inventariados los 13 mds del repo; detectadas contradicciones de
  valores de laudo/viático, estado de RLS y arquitectura MVVM.

---

## ⚠️ PROTOCOLO DE CIERRE DE JORNADA DE TRABAJO (LEER SIEMPRE)

Al terminar cada sesión de edición de código / SQL, ANTES de cerrar:

1. **REESCRIBIR** "Dónde estoy parado hoy" y "Próximos pasos" — borrar lo que ya no es
   cierto, no acumular. Si un bloqueo se resolvió, sale de "Estado".
2. **AGREGAR** una entrada nueva al CHANGELOG (arriba del todo: fecha + qué se hizo +
   decisiones tomadas + qué quedó pendiente). El changelog NO se reescribe, solo crece.
3. Si cambió una **REGLA DE NEGOCIO o CONSTANTE** → actualizar también `REGLAS_NEGOCIO.md`
   (es lo único que justifica tocar ese archivo).
4. Si cambió la **ARQUITECTURA** → actualizar el bloque "Estado vs Objetivo".
5. **Commit** del/los `.md` junto con el código de la sesión (mismo commit o uno
   `docs: actualizar estado DD/MM`). El md viaja CON el código, no después.

**Regla de oro:** si abrís un chat nuevo y este archivo no refleja la realidad, el
protocolo falló. Este es la fuente de verdad portable.