# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> > **Última actualización:** 23/06/2026 (tarde)

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

**Sync de reabiertas — RECLASIFICADO (23/06 tarde): NO era bug de cliente.**

Investigado a fondo. El bug descrito (que `obtenerJornadasCerradas` fuerce `status="cerrada"`
→ servir snapshot viejo) NO se reproduce: 4112-20260610 tiene **0 filas en Room** (verificado
en Database Inspector), llega `closed:false`/`status:"activa"` del servidor, sin `closedAt`
ni `totalsSnapshot` en el `data`. No hay snapshot viejo que servir porque no hay fila. El
187,5/$1.502,29 que figuraba en el ESTADO venía de panel o de un celu pre-wipe, no de lo que
la app sirve hoy. Confirmado además: `reabierta:true` convive con `status:"activa"` →
`reabierta` NO sirve como discriminador (sobrevive al recierre). El escenario que generaría el
bug (cargar un viaje de día anterior cruzando medianoche desde la app) está **bloqueado por
diseño**: la app no permite carga fuera de ventana; ese caso entra por **panel web** (admin).
Conclusión: sin fix de cliente pendiente. Asignar el `orderNumber` correcto al viaje tardío
(día de SALIDA, no "hoy"; cuidado con `inicioReal:0` como fuente de fecha) es responsabilidad
del **panel** → backlog de panel.

**HECHO HOY (23/06 mañana) — regresión de Pieza 4 paso 2 cazada y arreglada + tarea UI:**
- **Bug de hidratación de viajes en historial (CERRADO, validado en campo).** Efecto colateral
  del Paso 2: al pasar a leer el snapshot rápido desde Room, `obtenerJornadasCerradas` dejó de
  hidratar los viajes individuales — parseaba solo `totalsSnapshot` y DESCARTABA `data.travels[]`.
  Consecuencia: la tabla `viajes` de Room solo retenía los viajes de la jornada activa (insertados
  en vivo); toda jornada cerrada que venía por sync quedaba sin viajes → detalle de jornada vacío
  y PDF en 0 (el PDF recomputa desde Room en vivo, no lee snapshot). Confirmado en Database
  Inspector: la tabla `viajes` solo tenía las filas de la última jornada activa. **Fix:**
  `obtenerJornadasCerradas` ahora acumula los objetos de jornadas `closed:true` en un `closedArr`
  y reutiliza `parsearViajes()` sobre él; devuelve `JornadasCerradasResult(jornadas, viajes)`; el
  caller en `ViajeRepositoy` inserta los viajes con `dao.insertarViajes(...)` (REPLACE por `id`).
  Solo se hidratan viajes de jornadas cerradas (ids únicos → no pisa viajes en vivo). Validado:
  jornadas anteriores que estaban vacías ahora traen detalle completo y PDF con liquidación
  correcta (snapshot del 20: $3.479,61 / 377,47 km).
- **Hora de fin de viaje en historial (CERRADO, sale del backlog UI).** La card pintaba
  `arrivalTime`, que viene vacío (`""`) en TODOS los viajes (cierre manual y automático por
  igual). El dato real está en `finReal` (epoch). **Fix:** en HistorialScreen.kt (fila 2 del
  viaje) fallback `arrivalTime` → `finReal` formateado a HH:mm con el patrón `Calendar` inline
  existente (zona local del dispositivo = UTC-3 en Uruguay), `"—"` si ambos vacíos/null. NO se
  usa `llegadaEstimada` (eso es el pronóstico del motor de promedios apagado, no la hora real).
  Validado en celu.
- **Dato de modelo detectado:** el campo `llegadaEstimada` cambió entre el 20 y el 21. JSON del
  20 lo trae en `0`; JSON del 21 NO lo trae. La entidad/tabla `viajes` de Room sigue teniendo la
  columna `llegadaEstimada` (INTEGER nullable), y `parsearViajes` tolera su ausencia. No rompe
  nada hoy, pero queda registrado por si reaparece al tocar `travel_stats`.

---

## PRÓXIMOS PASOS (en orden)

1. **[FRENTE NUEVO — app + Supabase, sesión propia con CC] Ciclo de vida del estado "activa".**
   Nudo raíz que encadena varios ítems hoy dispersos. La sesión arranca por **mapear el ciclo
   completo** (quién abre/cierra `status="activa"`, qué se permite mientras está abierto, bordes:
   medianoche / día anterior / reapertura) ANTES de tocar código. De ese mapa caen como piezas:
    - **(1) Guard de jornada activa huérfana de día anterior.** `getOCrearJornada` solo chequea
      `getJornadaPorFecha(hoy)`; si hay una jornada `status="activa"` de día anterior sin cerrar,
      crea una segunda activa en paralelo sin avisar. El guard de `createOrder()` del JS vanilla
      (`if getActiveOrder() throw YA_EXISTE_JORNADA_ACTIVA`) NO se migró a Kotlin. **OJO con el
      diseño del guard:** `getJornadaActiva()` es `WHERE status='activa' LIMIT 1` SIN filtro de
      fecha → trataría igual a la huérfana de ayer y a la reabierta-de-hoy (legítima, vuelve a
      Room como activa). El discriminador correcto es **activa de día ANTERIOR a hoy**
      (`status='activa' AND fecha != :hoy`), NO "cualquier activa". CC mapeó 6 callers (#2/#4 ya
      con catch, #3/#5/#6 crash risk, #1 worker = loop silencioso de 30s si el panel asigna a un
      chofer con jornada de ayer trabada → un viaje que se evapora sin rastro; decidir si el panel
      fuerza cierre o no). Alcance sugerido 1ª pasada: `getOCrearJornada` con filtro de fecha +
      los 2 callers que ya tienen catch/UI (#2, #4). Diferir #3/#5/#6 y la decisión del worker #1.
    - **(2) Lógica de 8h del botón "finalizar jornada"** (mostrar solo sin viaje/guardia/contrato
      en curso, como el JS vanilla). Detalle en bugs 21/06 abajo.
    - **(3) Bugs de guardia A y B** (detalle en bugs 21/06 abajo) — requieren reproducción antes
      de tocar.
    - **(4) Indicador color verde/gris** que no vuelve a verde al reabrir (detalle en backlog UI).
      Empezar probablemente por (1) (más acotado, regla más clara), pero decidir secuencia CON el
      mapa, no antes. Sin abrir refactor gigante de un saque — pieza por pieza, validación en campo
      entre cada una. **Pendiente para esa sesión:** bajar a `REGLAS_NEGOCIO.md` la regla de cuándo
      una jornada puede reabrirse y qué define que un viaje pertenece a un día (incluida la condición
      de borde de medianoche clarificada el 23/06), hoy implícita.

2. **[FRENTE #2] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología: inventario fresco primero, explicar-antes-de-ejecutar, comparación
   antes/después, validar contra app del chofer Y panel tras cada cambio. (Prerequisito
   para distribuir el APK a compañeros.)

3. **[BUGS — 21/06, sin diagnosticar] Sesión propia, NO mezclar con otros frentes:**
    - **"Viajes del día" vacío con jornada activa.** La tab mostró "0 viajes" teniendo la
      jornada activa 4112-20260621 tres viajes finalizados y sincronizados en Supabase
      (`syncStatus:synced`). Regresión confirmada (la pantalla antes mostraba los finalizados).
      Sospecha: bug de lectura/filtro de la pantalla, posiblemente relacionado al campo
      `llegadaEstimada` ausente en el JSON del 21 vs presente (como `0`) en JSONs previos.
      Atacar con el código de la pantalla + Claude Code. Síntoma distinto al de historial:
      este es jornada ACTIVA y bug de LECTURA, no de sync/hidratación. (NO es parte del frente
      ciclo de vida — es bug de lectura independiente.)
    - **Dos bugs de guardias (parte del frente ciclo de vida #1, pieza 3).** Bug A — interacción
      entre viaje programado, guardia abierta y la lógica de corte automático de 15 min se
      comporta mal. Bug B — una guardia ya finalizada recibe ~8h después un mensaje de
      finalizar/extender (posible trigger FCM/cron/WorkManager que no chequea si la guardia ya
      está cerrada). Requiere sesión enfocada con el código de apertura/cierre de guardia +
      identificar el trigger de 8h + JSON del bug.
    - **Lógica de 8h para botón "finalizar jornada" (parte del frente ciclo de vida #1, pieza 2).**
      Para evitar cierre accidental de jornada, mostrar el botón de finalizar SOLO mientras no
      haya viaje, guardia o contrato en curso — como se hacía en el JS vanilla. Encarar JUNTO con
      los bugs de guardias (tocan la misma lógica de cierre); NO parchar a ciegas sin diagnosticar
      A y B primero.

4. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
      (Parte del frente ciclo de vida #1, pieza 4 — depende de detectar bien el cambio de estado.)
    - Número de coche: no se muestra en la fila de viaje del historial; existe en varios
      viajes (`coche:"941"`/`"959"`/`"927"`), vacío en otros. Decidir mostrar-cuando-existe (UI)
      vs exigir el coche en la carga (negocio).

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
- Deploy del panel: NO desplegar a producción real hasta cerrar RLS de las 3 tablas. En
  preview/staging con datos de prueba, OK.

5. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en el panel
   Next con historial en tiempo real de la actividad del chofer (viajes, guardias,
   contratos, horarios), con edición autorizada por el superadmin. PROPÓSITO PRECISADO
   (20/06): el sistema busca MÍNIMA intervención humana — viajes/guardias/contratos salen
   del panel por asignación automática vía mensajes. La carga manual del chofer es la
   EXCEPCIÓN (chofer sin señal, viaje pasado por teléfono). Lo que se valida es el ERROR
   HUMANO DE TIPEO en esa carga manual (un km, un destino, una hora mal), NO error de
   cálculo de la app (el laudo calcula bien). Lo que aparezca sin asignación = "operación
   inválida" → marcar/notificar; el superadmin corrige o congela "hasta donde el dato sea
   confiable", sobre todo si la salida está próxima. **Prerequisito: trazabilidad de origen
   confiable** (sellar quién creó cada viaje: asignación server vs carga manual app — hoy
   `origenCreacion` no es discriminador fiable). **Bloqueado además por cambio
   organizacional** (regla demanda boletos→coches, rotación) que define la empresa. NOTA:
   esto NO es una "alerta de formato en Supabase" — el formato de las jornadas inconsistentes
   es válido; lo que se detecta es inconsistencia semántica/humana, y se resuelve con
   edición autorizada desde el panel, no frenando el guardado en la base.
   **Nota de cruce (23/06):** la asignación correcta del `orderNumber` al viaje tardío cargado
   por panel (día de SALIDA, no "hoy"; `inicioReal:0` no sirve como fuente de fecha) vive acá.

6. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
   viaje + origen app/panel) en el JSON de la jornada, visible en panel Next. Base sembrada:
   `reabierta:true` sobrevive al recierre.

7. **[FUTURO] Migración a MVVM.** Después de RLS Escalón 3. No abrir tercer refactor en
   paralelo.

8. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md. Va
   después de React/Next.

9. **[FUTURO - sin urgencia] Archivado trimestral.** NO es problema de almacenamiento
   (Supabase free 500MB alcanza años; confirmado 24 jornadas reales). Justificación REAL:
   optimización de egress y claridad cuando el volumen sea grande, para alimentar la consulta
   de meses históricos del PANEL (no la app). Dirección correcta: desde Supabase (durable),
   nunca desde Room.

---

## ARQUITECTURA — ESTADO vs OBJETIVO

- **Estado actual (hecho):** UI (Compose) → `ViajeRepository` → DAO → Room. **No hay capa
  ViewModel.** Los composables reciben el repository como parámetro y lo llaman directo.
- **Objetivo:** migrar a MVVM (UI → ViewModel → Repository → DAO → Room). Incremental, NO
  hecha aún.
- **Regla para Claude Code:** respetar el patrón ACTUAL al tocar código existente. ViewModel
  SOLO en trabajo nuevo o refactors explícitamente marcados "migración MVVM". NO corregir
  código viejo a MVVM de oficio.
- **Room: `CotDatabase` en version 14.** Con MIGRATIONS REALES (`addMigrations(MIGRATION_13_14)`).
  El `fallbackToDestructiveMigration` FUE ELIMINADO (Pieza 4 paso 1) — ya no es deuda de prod.
  La entidad `Jornada` persiste el snapshot completo (7 campos del desglose). El sync de
  arranque corre incondicional en MainScreen/HomeScreen, así que Room es caché reconstruible
  desde Supabase (fuente de verdad durable). Las jornadas cerradas que vienen por sync ahora
  hidratan TAMBIÉN sus viajes en la tabla `viajes` (fix 23/06), no solo el snapshot.

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes** → `REGLAS_NEGOCIO.md`. (Autoritativos: laudo
  $8.0122/km, viático $455.26. Los $7.637/$455 de RUTAUY_CONTEXT están OBSOLETOS.)
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md` (diseño, no
  implementado).
- **Esquema de tablas Supabase** → RUTAUY_CONTEXT.md (SOLO como mapa de esquema; valores de
  cálculo obsoletos).
- **Historial sprints 1-5 (port JS→Kotlin)** → PLAN_DESARROLLO_KOTLIN.md (histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)
### 23/06/2026 (tarde)
- **Sync de reabiertas reclasificado: NO era bug de cliente.** Verificado en Database Inspector:
  4112-20260610 con 0 filas en Room. Llega `closed:false`/`activa`, sin `closedAt`/`totalsSnapshot`.
  El "snapshot viejo servido" no existe — no hay fila. `reabierta:true` confirmado inútil como
  discriminador (convive con `activa`). Flujo causante (carga cruzando medianoche) bloqueado por
  diseño en app → entra por panel. Sin fix de cliente. orderNumber del viaje tardío =
  responsabilidad de panel (usar día de salida, no "hoy"; `inicioReal:0` no sirve como fuente).
  El punto #1 viejo de "Próximos pasos" ("sync de reabiertas, bajo riesgo, caso listo") y el
  bloque "PENDIENTE CONOCIDO de Pieza 4" quedaron eliminados por esta reclasificación.
- **Detectado hueco real (raíz distinta): jornada activa huérfana de día anterior.** Guard
  `createOrder` del JS vanilla no migrado a Kotlin. `getOCrearJornada` no bloquea segunda jornada
  activa de fecha distinta. CC mapeó 6 callers + propuso fix. Corrección de diseño pendiente: el
  guard debe filtrar por fecha (`activa AND fecha != hoy`), no "cualquier activa", para no romper
  la reabierta legítima del día. Agrupado como cabeza del nuevo frente "ciclo de vida del estado
  activa" (junto con lógica de 8h, bugs de guardia y indicador de color), con metodología
  "mapear primero, después tocar". Sesión propia con CC. Sesión de hoy fue solo diagnóstico:
  no se tocó código, viaja solo el ESTADO.
### 23/06/2026 (mañana)
- **Bug de hidratación de viajes en historial CERRADO (validado en campo).** Era regresión de
  Pieza 4 paso 2: `obtenerJornadasCerradas` leía solo `totalsSnapshot` y descartaba
  `data.travels[]`, así que las jornadas cerradas sincronizadas nunca poblaban la tabla `viajes`
  de Room → detalle de jornada vacío y PDF en 0 (el PDF recomputa desde Room en vivo). Confirmado
  con Database Inspector (la tabla `viajes` solo tenía las filas de la jornada activa más reciente).
  Fix: `parsearViajes` cambia firma `String`→`JSONArray` (único otro caller `sincronizarJornada`
  adaptado); `obtenerJornadasCerradas` acumula jornadas `closed:true` en `closedArr`, las parsea
  con `parsearViajes(closedArr)` y devuelve `JornadasCerradasResult(jornadas, viajes)`; caller en
  `ViajeRepositoy` inserta con `dao.insertarViajes(...)` (REPLACE por `id`). `parsearViajes` setea
  `orderNumber` desde el objeto jornada padre (verificado) → coincide con `getViajesPorJornada`.
  BUILD SUCCESSFUL. Validado en celu: jornadas vacías ahora con detalle + PDF correcto
  (snapshot 20/06: $3.479,61 / 377,47 km).
- **Hora de fin de viaje en historial CERRADO (sale del backlog UI).** La card pintaba
  `arrivalTime` (vacío en TODOS los viajes, manual y automático). Fix en HistorialScreen.kt:
  fallback `arrivalTime` → `finReal` (epoch) formateado a HH:mm con patrón `Calendar` inline
  existente (zona local = UTC-3 en UY), `"—"` si ambos null/vacío. NO se usa `llegadaEstimada`
  (es pronóstico del motor apagado, no hora real). Validado en celu.
- Dato de modelo registrado: `llegadaEstimada` cambió entre 20 (viene `0`) y 21 (ausente). La
  columna sigue en Room (INTEGER nullable); `parsearViajes` tolera su ausencia. Posible relación
  con el bug "Viajes del día vacío" del 21 → anotado en próximos pasos #3.
- Archivos tocados: `SupabaseService.kt`, `ViajeRepositoy.kt`, `HistorialScreen.kt`.
### 20/06/2026 (noche)
- **Pieza 4 COMPLETA (cierra Frente #1 entero).** Dos pasos:
    - Paso 1: migration real 13→14 (ADD COLUMN aditivo) reemplaza fallbackToDestructiveMigration;
      5 columnas de desglose en entidad Jornada; obtenerJornadasCerradas puebla snapshot
      completo. Validado: instala sobre app existente sin wipe ni crash (eliminado el modo de
      falla del incidente 09/06). Commit limpiado de basura temporal; creado .gitignore.
    - Paso 2: obtenerTotalesSnapshot lee snapshot desde Room (discriminador status
      cerrada/finalizada + closedAt) en vez de round-trip a Supabase. Historial ~7s → ~0,3s,
      validado en campo: 23 jornadas reales correctas (idénticas a corrida previa), lectura
      "desde Room" confirmada en logcat. Doble red de Pieza 2 cerrada de verdad.
- Pendiente conocido detectado: jornada reabierta de día anterior queda en Room con
  status="cerrada" forzado por el sync → paso 2 sirve snapshot viejo. Testigo: 4112-20260610
  (jornada de prueba rota a propósito, muestra 187,5/$1.502,29). NO afecta jornadas reales.
  Se resuelve en sub-tarea de sync de reabiertas (anotada en próximos pasos #1).
  [NOTA 23/06: este pendiente quedó RECLASIFICADO — ver entrada 23/06 tarde, no era bug de cliente.]
- Decisión de alcance: app del chofer = mes corriente; historial profundo/impresión = panel
  web. limit=30 del sync confirmado como límite de diseño, no bug.
- Idea de validación en panel precisada: objetivo es cazar error HUMANO de tipeo en carga
  manual (excepción por falta de señal), no error de cálculo. Requiere trazabilidad de origen
  primero. Anotada bien en backlog #5.
### 20/06/2026 (día)
- Pieza 2 (Totales una vez por jornada vía Map) aplicada y validada. Dedup parcial (cards
  visibles del primer frame pierden carrera con el efecto del período); cierre real diferido
  a Pieza 4 leyendo de Room (ya hecho). Detectadas 2 tareas UI (hora fin / coche) → backlog.
### 18/06/2026
- Pieza 3 (criterio de calcularTotalesJornada por status) APLICADA y VALIDADA end-to-end con
  jornada real. Cerrada 2 viajes ($2.824,30/352,5) → 3er viaje → reabrió sola → cerrada →
  recalculó correcto ($4.250,47/530,5). Tome/Cese no se duplicó. Subfacturación muerta para
  reabierta del día. GPS "Escalando a ALTA" y checkpoint Colonia validados de paso.
### 15/06/2026
- Diseño completo del fix (4 piezas) sobre código real. Decisión: atacar la raíz (dos fuentes
  de verdad), no parchar. Regla ABIERTA→recalcula / CERRADA→snapshot (apoyada en regla
  temporal: jornada vive en su día, reopen no cruza 23:59:59). Pieza 1 aplicada. Reopen
  server-side confirmado en producción. Storage Supabase despejado (cuello es egress, no
  espacio). Consolidación de docs (13 mds), creados ESTADO/REGLAS/LIMPIEZA.
### 10/06/2026
- Diagnóstico raíz de subfacturación (dos fuentes de verdad). Reopen server-side HECHO/validado
  (idempotente, sin gate de fecha, sin RAISE). search_path pineado, COALESCE defensivo. Regla:
  viaje pertenece a la jornada del día en que SALIÓ. Jornadas-testigo (ej. 4112-20260610) se
  dejan rotas a propósito como casos de estudio. Status activa = "activa"; solo "activa" y
  "finalizada". Creados ESTADO/REGLAS/LIMPIEZA, inventariados 13 mds.

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