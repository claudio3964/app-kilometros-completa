# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Este es el archivo que se pega al inicio de cada chat
> (con Claude o Claude Code) para tener el contexto al día. Se REESCRIBE en cada cierre
> de jornada de trabajo (ver PROTOCOLO DE CIERRE al pie). Lo que deja de ser cierto, se
> borra de "Estado" y queda preservado en el CHANGELOG.
>
> **Última actualización:** 10/06/2026

---

## SNAPSHOT

- **Qué es:** app Android nativa (Kotlin, `com.driverlog.app`, branch `main`) para
  digitalizar jornadas de choferes de transporte en Uruguay.
- **Backend:** Supabase (Postgres + RLS + RPCs) + FCM push. Lógica de laudo centralizada.
- **Panel admin:** Vanilla JS en `cot-driver-admin.netlify.app`.
- **Fase:** pre-producción. APK aún NO distribuido a choferes.
- **Auth:** la app usa SOLO la anon key (no hay Supabase Auth por chofer). Login = legajo
    + device_id contra tabla `choferes`. El filtrado por identidad de chofer queda diferido
      hasta la migración a React/Next.

---

## DÓNDE ESTOY PARADO HOY

**Frente activo: bug de subfacturación del laudo (cierre de jornada).**

Diagnóstico completo (10/06): el laudo tiene **dos fuentes de verdad que divergen**.
- **Servidor (Supabase):** calcula desde el array `travels`. Correcto.
- **App (Room):** guarda `kmTotal`/`monto` como campos PLANOS en la entidad `Jornada`,
  escritos una sola vez al cerrar. `ViajeRepository.calcularTotalesJornada()` tiene un
  cortocircuito: `if (jornada.kmTotal > 0.0) return planos` → devuelve el total congelado
  SIN recalcular ni mirar Supabase. Por eso una jornada reabierta sigue mostrando el monto
  viejo aunque el server esté correcto.
- Además: una jornada `closed:false` que no es de hoy queda FUERA de las dos queries de
  sync (`obtenerJornadaActiva` pide hoy + descarta closed; `obtenerJornadasCerradas` pide
  closed=true). No vuelve a bajar a Room.

**Ya HECHO y validado hoy (server-side):**
- Helper `_reabrir_jornada_si_corresponde(p_order_number)` — idempotente, sin gate de
  fecha, sin RAISE. Si la jornada está cerrada: borra `totalsSnapshot`, pone `closed:false`
    + `status:'activa'` + flag `reabierta:true`. Si está abierta o no existe: no hace nada.
- `agregar_viaje_a_jornada` y `agregar_guardia_a_jornada`: llaman al helper con `PERFORM`
  al inicio, antes del append. Probado en los dos caminos (reabre / no rompe si ya abierta).
- De paso: `search_path` pineado en `agregar_viaje_a_jornada` (era DEFINER sin pinear);
  `COALESCE(data->'guards', '[]')` defensivo en `agregar_guardia_a_jornada`.
- **El reopen server sirve y queda en producción, pero NO alcanza solo** — el bug real
  está del lado cliente (cortocircuito de Room). Eso es el frente #1 de mañana.

ESTADO DEL FIX DE RAÍZ DEL LAUDO (en progreso, 4 piezas):
- Pieza 1 (caché de getConfiguracion con TTL 5min): HECHA y validada en celu. El caché
  retiene entre llamadas (MISS la primera vez, HIT después).
- Piezas 2-4: diseñadas, pendientes. Ver próximos pasos.
- CONFIRMADO EN VIVO: el reopen server funciona en producción. La 4112-20260610 baja con
  closed:false, status:activa, reabierta:true, totalsSnapshot=null. El cliente ve el null
  y cae a calcularTotalesJornada — falta que recalcule bien (Pieza 3).
- HALLAZGO: el cuello de red real del historial NO era config, es obtenerTotalesSnapshot
  bajando el JSON completo de cada jornada cerrada por red, varias veces (período + card,
  sin compartir). Lo resuelven Pieza 2 + Pieza 4.
---

## PRÓXIMOS PASOS (en orden)

1. 1. [FRENTE #1] Fix cliente del laudo - continuar:
    - Pieza 3: reescribir criterio de calcularTotalesJornada. Regla por estado:
      ABIERTA (incl. reabierta) -> recalcular desde travels/guards locales (presentes,
      porque abierta = de hoy por la regla del corte 23:59:59).
      CERRADA -> usar snapshot. El kmTotal plano de Room deja de ser fuente de verdad.
    - Pieza 2: en HistorialScreen, calcular Totales una vez por jornada (Map) y pasarlo a
      las JornadaCard, en vez de que período y card lo pidan por separado.
    - Pieza 4 (la más invasiva, bump de schema): persistir el desglose del snapshot en Room
      (no solo kmTotal/monto). Enganchar migrations reales (sacar fallbackToDestructiveMigration)
      para no perder datos locales en el bump. Decidir esto ANTES de instalar ese build.
    - Pieza 4 tambien: ajustar las 2 queries de sync para que una jornada reabierta
      (closed:false, no de hoy) pueda volver a Room.

2. **[PARALELO] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología establecida: inventario fresco primero, explicar-antes-de-ejecutar,
   comparación antes/después, validar contra app del chofer Y panel admin tras cada cambio.

3. **[BACKLOG] Tab de reconciliación en el panel admin.** Pantalla nueva con historial en
   tiempo real de la actividad del chofer (viajes, guardias, contratos, horarios), con
   edición autorizada por el superadmin. Propósito: la fuente de verdad es lo que Tránsito
   asigna por mensaje; lo que aparezca sin asignación = "operación inválida" → notificación
   al chofer. El superadmin corrige lo que el admin mandó mal o el chofer cargó mal,
   sobre todo si la salida está próxima. **Requiere trazabilidad de origen primero**
   (sellar `origenCreacion` server vs app — hoy todo cae a `"app"`). **Bloqueado por
   cambio organizacional** (regla de demanda boletos→coches, rotación de efectivos) que
   define la empresa, no el código. Avanza la trazabilidad (infra) sin esperar eso.

4. **[FUTURO] Migración a MVVM.** Ver bloque de arquitectura. Objetivo, no ahora — después
   de cerrar frente #1 y RLS Escalón 3. No abrir un tercer refactor en paralelo.

5. **[FUTURO] Multi-empresa.** Objetivo del proyecto. Diseño en MULTIEMPRESA.md /
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
  con `fallbackToDestructiveMigration` — deuda de prod: migrations reales antes de publicar.

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