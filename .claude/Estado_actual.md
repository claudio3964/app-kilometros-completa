# COT DRIVER — ESTADO ACTUAL

> **Fuente de verdad portable.** Se pega al inicio de cada chat (Claude o Claude Code).
> Se REESCRIBE en cada cierre de jornada de trabajo (ver PROTOCOLO al pie). Lo que deja de
> ser cierto se borra de "Estado" y queda preservado en el CHANGELOG.
>
> **Última actualización:** 26/06/2026

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

**Fix de raíz del laudo (subfacturación): COMPLETO. Las 4 piezas hechas y validadas.**
Pieza 1 (caché getConfiguracion), Pieza 2 (Totales una vez por jornada vía Map + display de
hora de fin), Pieza 3 (criterio calcularTotalesJornada por status), Pieza 4 (migrations
reales Room v14 + snapshot completo persistido + lectura desde Room). Subfacturación muerta.

**Sobrefacturación por viaje fantasma: CERRADA y VALIDADA EN CAMPO (26/06).** El diagnóstico
del ESTADO viejo era INCORRECTO. NO era "el flujo de cancelación marca finalizado en vez de
cancelado". La raíz real, confirmada empíricamente: existían DOS RPCs `actualizar_viaje_en_jornada`
con el mismo nombre y distinta aridad (overload):
- A) `(text, text, bigint, bigint)` — vieja, sin cierre_automatico.
- B) `(text, text, bigint, bigint, boolean)` — nueva, + cierre_automatico + fold travel_stats.
  El cliente cancelaba llamando con 3 args (`p_viaje_id`, `p_status`, `p_inicio_real=0`). Con 3 args
  Postgres NO podía elegir entre A y B (ambas matchean el prefijo `(text,text,bigint)` + DEFAULTs)
  → `ERROR 42725 "function ... is not unique"`. **La cancelación fallaba SIEMPRE, determinística,
  NO era red.** La excepción se tragaba en 3 capas del cliente (catch→false, caller ignora false,
  syncStatus no se toca, sin retry) → Room quedaba `cancelado`, Supabase seguía `finalizado` → el
  laudo lo contaba. El viaje fantasma del 23/06 nunca recibió la cancelación (su `inicioReal` siguió
  siendo el string ISO original, jamás pasó por la RPC).

**Fix aplicado (dos capas, ambas validadas):**
- **Servidor:** RPC versionada en `supabase/functions/actualizar_viaje_en_jornada.sql` (commit
  f109f8a) ANTES de tocar nada. Luego `DROP FUNCTION ...(text,text,bigint,bigint)` — eliminada
  la función A. Queda UNA sola firma (la de 5 params). Verificado: ningún caller interno la
  menciona (pg_proc 0 filas); la finalización ya usaba B. La llamada de cancelación ya NO da
  `is not unique`.
- **Cliente:** `cancelarViajeEnSupabase` (SupabaseService.kt) ahora llama con 5 args:
  `p_status="cancelado"` y `p_inicio_real`/`p_fin_real`/`p_cierre_automatico` como
  `JSONObject.NULL` explícito (sacado el `0L` espurio). La RPC solo escribe campos
  `IS NOT NULL` → solo cambia el status, preserva el resto. BUILD SUCCESSFUL.
- **Validación en campo (26/06):** viaje programado 4112-20260626 (VJL-1782501425820-PUN)
  cancelado desde el botón "Cancelar" del Inicio → en Supabase quedó `status:"cancelado"`,
  SIN `finReal`, SIN `cierreAutomatico`, resto intacto. (Nota: `inicioReal:0` ya venía de la
  creación del programado, NO lo mete la cancelación.) Cancelación se propaga de punta a punta.

**NO hizo falta la defensa (B) en LaudoCalculator** que figuraba en el plan viejo: como ahora el
viaje queda correctamente `cancelado` (no `finalizado`), la UI del historial (que ya filtra
`status != "cancelado"`) y el cálculo lo descartan solos. Se atacó la raíz, no el síntoma.

**Hallazgo estructural de paso (DEUDA CONSCIENTE, NO atacar hoy): el syncStatus es teatro.**
El campo `syncStatus` se escribe (`"local"` al crear) pero NUNCA se lee para hacer push. No hay
sync de SALIDA en la app — es pull-only (`sincronizarDesdeSupabase`). `getViajesPendientesSync()`
existe pero se usa para re-encolar workers tras reboot, no para pushear. `actualizarSyncStatus()`
es dead code (0 callers). Implicación: este bug NO dependía de eso (la raíz era el overload), pero
si mañana una escritura a Supabase falla por señal de verdad (sin overload de por medio), se pierde
igual sin huella. Grieta estructural real. Va en su propia sesión (frente "dónde vive la lógica" /
sync robusto), NO abrir ahora.

---

## PRÓXIMOS PASOS (en orden)

1. **[PREVENCIÓN — portar del JS vanilla a Kotlin] Sistema anti-solapamiento de viajes y guardias.**
   Atado directo al fix recién cerrado: el viaje fantasma del 23/06 coexistió con el real (dos
   viajes con `inicioReal` a 77ms de diferencia) porque la app permitió crear un viaje encima de
   otro. La cancelación robusta ya cierra el lado "la cancelación se propaga"; el anti-solapamiento
   es la red de fondo que impide que dos viajes pisados coexistan en primer lugar. En la app JS
   vieja funcionaba: no permitía crear guardia encima de viaje ni viaje encima de guardia (ni
   solapamientos en general). Es PREVENCIÓN: corta el dato malo en el origen. Conecta con el Bug A
   de guardias (lógica de 15min con viaje programado). Al portar: revisar la validación del JS y
   replicarla en el flujo de creación de viajes/guardias en Kotlin. Conviene atacarlo JUNTO con
   los bugs de guardia (misma zona de código). Complementa (no reemplaza) el botón de
   edición/corrección del panel (backlog): anti-solapamiento = prevención en la app; edición en
   panel = corrección de lo que ya entró mal.

2. **[FRENTE — app + Supabase, sesión propia con CC] Ciclo de vida del estado "activa".**
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

3. **[FRENTE] RLS Escalón 3.** Auditar y remover las ~60 políticas `{public}` legacy con
   `qual=true`/`check=true` que reexponen tablas a anon por el OR de RLS. Prioridad:
   `comandos_dispositivo`, `registro_alertas`, `mensajes`, `jornadas`, `configuracion`.
   Metodología: inventario fresco primero, explicar-antes-de-ejecutar, comparación
   antes/después, validar contra app del chofer Y panel tras cada cambio. (Prerequisito
   para distribuir el APK a compañeros. Ver bloque "Estado de seguridad RLS" abajo.)

4. **[BUG — 21/06, sin diagnosticar] "Viajes del día" vacío con jornada activa.** Sesión propia,
   NO mezclar. La tab mostró "0 viajes" teniendo la jornada activa 4112-20260621 tres viajes
   finalizados y sincronizados en Supabase (`syncStatus:synced`). Regresión confirmada (la
   pantalla antes mostraba los finalizados). Sospecha: bug de lectura/filtro de la pantalla,
   posiblemente relacionado al campo `llegadaEstimada` ausente en el JSON del 21 vs presente
   (como `0`) en JSONs previos. Atacar con el código de la pantalla + Claude Code. Síntoma
   distinto al de historial: este es jornada ACTIVA y bug de LECTURA, no de sync/hidratación.
   (NO es parte del frente ciclo de vida — es bug de lectura independiente.)

5. **[BACKLOG — UI] Tareas de presentación en HistorialScreen (sueltas, no bloquean):**
    - Indicador de color (verde abierta / gris cerrada) debe volver a verde al reabrir.
      (Parte del frente ciclo de vida #2, pieza 4 — depende de detectar bien el cambio de estado.)
    - Número de coche: no se muestra en la fila de viaje del historial; existe en varios
      viajes (`coche:"941"`/`"959"`/`"927"`), vacío en otros. Decidir mostrar-cuando-existe (UI)
      vs exigir el coche en la carga (negocio).
    - Deuda menor: el viático `$455.26` está hardcodeado en HistorialScreen (solo para el display
      del desglose del período; el cálculo real sale de LaudoCalculator). Debería venir de config.
      Conecta con el frente "dónde vive la lógica".

6. **[BACKLOG — PANEL] Tab de reconciliación / validación de datos.** Pantalla en el panel
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
   **Falta UI de edición de viajes en curso / finalizados** (detectado 26/06: el panel hoy NO
   tiene botón para finalizar/editar/cancelar un viaje ya cargado; solo enviar uno nuevo). Va acá.
   **Nota de cruce (23/06):** la asignación correcta del `orderNumber` al viaje tardío cargado
   por panel (día de SALIDA, no "hoy"; `inicioReal:0` no sirve como fuente de fecha) vive acá.

7. **[BACKLOG] Auditoría de reaperturas.** Registro de eventos de reapertura (timestamp +
   viaje + origen app/panel) en el JSON de la jornada, visible en panel Next. Base sembrada:
   `reabierta:true` sobrevive al recierre.

8. **[FUTURO] Migración a MVVM.** Después de RLS Escalón 3. No abrir tercer refactor en
   paralelo.

9. **[FUTURO] Dónde vive la lógica de negocio.** Frente de diseño grande (NO empezar hasta
   cerrar laudo + bugs en cola). Problema de fondo: lógica duplicada en app (Kotlin/Room) y
   Supabase que a veces diverge (subfacturación, travel_stats triplicado). **Hoy se sumó un
   caso nuevo a este frente: el sync es pull-only y el `syncStatus` es teatro** (escrito, nunca
   leído para push; sin sync de salida; `actualizarSyncStatus` dead code). Esto significa que
   cualquier escritura a Supabase que falle por red se pierde sin huella. El bug de cancelación
   recién cerrado NO dependía de esto (raíz = overload), pero la grieta queda. Marco: NO mudar
   todo a Supabase (la app DEBE funcionar offline — el chofer maneja sin señal, razón por la que
   se migró de PWA a Kotlin). Solución no es "una sola ubicación" sino "una sola REGLA aunque se
   ejecute en dos lados": laudo oficial/estadísticas/validación de autoridad en Supabase; laudo
   preliminar offline + anti-solapamiento + cierre GPS en la app; MISMA fórmula a ambos lados +
   test que verifique que dan el mismo resultado (`REGLAS_NEGOCIO.md` es el ancla). Sub-tarea
   concreta que cae acá: diseñar un sync de SALIDA real (cola de deuda persistida + reintento)
   que cubra cancelación, finalización y cualquier escritura, en vez de fire-and-forget.
   Conecta con multi-empresa.

10. **[FUTURO] Multi-empresa.** Diseño en MULTIEMPRESA.md / ESTRATEGIA_MULTIEMPRESA.md. Va
    después de React/Next. La config de negocio de cada empresa debe vivir en un solo lugar
    inyectable.

11. **[FUTURO — sin urgencia] Archivado trimestral.** NO es problema de almacenamiento
    (Supabase free 500MB alcanza años; confirmado 24 jornadas reales). Justificación REAL:
    optimización de egress y claridad cuando el volumen sea grande, para alimentar la consulta
    de meses históricos del PANEL (no la app). Dirección correcta: desde Supabase (durable),
    nunca desde Room.

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
- ❌ Falta UI de edición/finalización/cancelación de viajes ya cargados (in curso o finalizados).
  Hoy el panel solo permite enviar viajes nuevos. → backlog #6.
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
- **Room: `CotDatabase` en version 14.** Con MIGRATIONS REALES (`addMigrations(MIGRATION_13_14)`).
  El `fallbackToDestructiveMigration` FUE ELIMINADO (Pieza 4 paso 1) — ya no es deuda de prod.
  La entidad `Jornada` persiste el snapshot completo (7 campos del desglose). El sync de
  arranque corre incondicional en MainScreen/HomeScreen, así que Room es caché reconstruible
  desde Supabase (fuente de verdad durable). Las jornadas cerradas que vienen por sync ahora
  hidratan TAMBIÉN sus viajes en la tabla `viajes` de Room (fix 23/06), no solo el snapshot.
- **Sync direccional: PULL-ONLY.** `sincronizarDesdeSupabase` trae datos; NO hay push de
  salida. `syncStatus` se escribe pero no se lee para empujar. Deuda registrada en #9.
- **OJO — tabla `viajes` de Supabase está MUERTA.** Solo 3 filas de mayo, nadie escribe ahí
  hoy. NO confundir con la tabla `viajes` de Room (esa sí se usa). La verdad del laudo en
  Supabase vive en `jornadas.data.travels` (JSONB), no en la tabla `viajes`.

---

## PUNTEROS (no mezclar con este archivo)

- **Reglas de negocio y constantes** → `REGLAS_NEGOCIO.md`. (Autoritativos: laudo
  $8.0122/km, viático $455.26. Los $7.637/$455 de RUTAUY_CONTEXT están OBSOLETOS.)
- **Diseño multi-empresa** → `MULTIEMPRESA.md` + `ESTRATEGIA_MULTIEMPRESA.md` (diseño, no
  implementado).
- **Esquema de tablas Supabase** → RUTAUY_CONTEXT.md (SOLO como mapa de esquema; valores de
  cálculo obsoletos).
- **RPC actualizar_viaje_en_jornada** → AHORA VERSIONADA en
  `supabase/functions/actualizar_viaje_en_jornada.sql` (una sola firma de 5 params; la de 4
  fue dropeada el 26/06). Las funciones de `travel_stats` (`ts_cod_lugar`, `ts_a_ms`,
  `ts_franja`, `registrar_en_travel_stats`, `estimar_llegada`) siguen SIN versionar — pendiente
  guardarlas en `supabase/functions/travel_stats.sql`. Estimación APAGADA a propósito
  (9 buckets / 9 muestras al 18/06, lejos del umbral c_min=5).
- **Historial sprints 1-5 (port JS→Kotlin)** → PLAN_DESARROLLO_KOTLIN.md (histórico, cerrado).

---

## CHANGELOG (solo crece — NO reescribir, agregar arriba)
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
  escritura a Supabase falla por señal real, se pierde sin huella. → Próximos pasos #9 (frente
  "dónde vive la lógica" / sync de salida robusto).
- **Confirmado: tabla `viajes` de Supabase está muerta** (3 filas de mayo, nadie escribe). La verdad
  del laudo vive en `jornadas.data.travels`. Anotado en Arquitectura para no volver a confundir.
- **Sumado a próximos pasos: anti-solapamiento (#1) queda como cabeza de cola** — atado a este fix:
  el fantasma del 23/06 coexistió con el real (77ms) porque la app permite crear viaje encima de
  viaje. La cancelación robusta cierra "la cancelación se propaga"; el anti-solapamiento es la red
  de fondo que impide el solapamiento en origen. Sesión propia (junto con bugs de guardia).
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