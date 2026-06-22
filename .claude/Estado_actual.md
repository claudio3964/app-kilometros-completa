# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> > **Última actualización:** 20/06/2026 (noche)

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

**Frente #1 (fix de raíz del laudo - subfacturación): CERRADO. Las 4 piezas hechas.**

El laudo tenía dos fuentes de verdad que divergían: Supabase calcula desde `travels`
(correcto); la app servía valores planos de Room sin recalcular → una jornada reabierta
mostraba el monto viejo congelado (subfacturación). Atacado en la raíz, 4 piezas.

**HECHO y validado (todo en producción/celu con datos reales):**
- **Reopen server-side** (`_reabrir_jornada_si_corresponde` + integración en
  `agregar_viaje_a_jornada`/`agregar_guardia_a_jornada`). Confirmado en vivo.
- **Pieza 1** — caché de `getConfiguracion` (@Volatile + TTL 5min).
- **Pieza 3** — criterio de `calcularTotalesJornada` por status (activa/reabierta →
  recalcula; cerrada → snapshot). Bug de subfacturación muerto para la reabierta del día.
- **Pieza 2** — Totales calculados una vez por jornada en HistorialScreen, compartidos a
  las JornadaCard vía Map (`totalesPorJornada`).
- **Pieza 4** — DOS pasos, ambos hechos y validados:
    - *Paso 1:* migration REAL 13→14 (`MIGRATION_13_14`, ADD COLUMN aditivo) reemplazando
      `fallbackToDestructiveMigration`. 5 columnas de desglose persistidas en Room
      (kmViajes, kmAcoplados, kmGuardias, kmTomeCese, viaticos). `obtenerJornadasCerradas`
      puebla el snapshot completo. Validado: instala sobre app existente SIN wipe, SIN crash.
    - *Paso 2:* `obtenerTotalesSnapshot` lee el snapshot desde Room en vez de round-trip a
      Supabase (discriminador: status cerrada/finalizada + closedAt != null; activa/reabierta
      cae a recálculo). Historial pasó de ~7s a ~0,3s con 23 jornadas. Doble red de Pieza 2
      cerrada de verdad.

**PENDIENTE CONOCIDO de Pieza 4 (no bloquea, anotado para otra sesión):**
- **Sync de jornadas reabiertas de día anterior.** Hoy `obtenerJornadasCerradas` fuerza
  `status="cerrada"` en Room a toda jornada que sincroniza, aunque en Supabase esté
  `reabierta:true`/`activa`. Consecuencia: una reabierta de día anterior queda en Room como
  cerrada con su `closedAt` y snapshot viejos, y el paso 2 le sirve ese snapshot viejo en
  vez de recalcular. Caso testigo: 4112-20260610 (jornada de PRUEBA rota a propósito el
  10/06; muestra 187,5 km / $1.502,29, que es su snapshot congelado de cuando tenía 1
  viaje). NO afecta jornadas reales ni el total del mes. Se resuelve haciendo que el sync
  respete el status reabierto y dispare recálculo. Encarar como pieza propia.

---

## PRÓXIMOS PASOS (en orden)

1. **[FRENTE #1 - cola] Sync de reabiertas (pendiente conocido de Pieza 4).** Que
   `obtenerJornadasCerradas` no fuerce "cerrada" a una jornada que en Supabase está
   reabierta/activa, para que el cliente recalcule en vez de servir snapshot viejo. Caso de
   prueba listo: 4112-20260610. Bajo riesgo, bien acotado.

2. **[FRENTE #2] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología: inventario fresco primero, explicar-antes-de-ejecutar, comparación
   antes/después, validar contra app del chofer Y panel tras cada cambio. (Prerequisito
   para distribuir el APK a compañeros.)

3. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
    - Hora de fin de viaje: la card pinta `arrivalTime`, que el cierre por GPS deja vacío
      (`""`); el dato real está en `finReal`. Fix: fallback `arrivalTime` → derivar HH:mm de
      `finReal` cuando esté vacío.
    - Número de coche: no se muestra en la fila de viaje del historial; existe en varios
      viajes (`coche:"941"`), vacío en otros. Decidir mostrar-cuando-existe (UI) vs exigir
      el coche en la carga (negocio).

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

4. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en el panel
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

5. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
   viaje + origen app/panel) en el JSON de la jornada, visible en panel Next. Base sembrada:
   `reabierta:true` sobrevive al recierre.

6. **[FUTURO] Migración a MVVM.** Después de RLS Escalón 3. No abrir tercer refactor en
   paralelo.

7. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md. Va
   después de React/Next.

8. **[FUTURO - sin urgencia] Archivado trimestral.** NO es problema de almacenamiento
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
  desde Supabase (fuente de verdad durable).

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
- Decisión de alcance: app del chofer = mes corriente; historial profundo/impresión = panel
  web. limit=30 del sync confirmado como límite de diseño, no bug.
- Idea de validación en panel precisada: objetivo es cazar error HUMANO de tipeo en carga
  manual (excepción por falta de señal), no error de cálculo. Requiere trazabilidad de origen
  primero. Anotada bien en backlog #4.
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