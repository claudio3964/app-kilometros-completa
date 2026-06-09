# ESTADO PROYECTO COT DRIVER — 09/06/2026 (cierre noche, sesión RLS)

App Android (Kotlin nativo, `com.driverlog.app`, branch `main`) para digitalizar
jornadas de choferes de transporte en Uruguay. Backend Supabase + FCM.
Panel admin web (Vanilla JS, hosteado en cot-driver-admin.netlify.app).
La lógica de negocio se centraliza server-side (RPCs con `jsonb_set`).

> NOTA DE MÉTODO: el asistente NO ve el repo ni Supabase. Solo ve archivos subidos.
> Trabajar paso a paso, validar cada cambio antes de seguir, una cosa a la vez.

---

## ✅ HECHO HOY (09/06 noche) — SEGURIDAD SUPABASE

### 1. crear_admin — CERRADO (era el agujero crítico)
- Bug original: guard usaba `!=` con `auth.uid()` que para anon da NULL → el IF
  no disparaba y cualquiera con el anon key podía crearse un superadmin.
- Arreglado: REVOKE EXECUTE de anon/public, GRANT solo a authenticated. Guard nuevo
  con `auth.uid() IS NULL OR (...) IS DISTINCT FROM 'superadmin'` + `activo IS TRUE`.
  search_path pineado (`public, auth, pg_temp`).
- El panel la llama por Edge Function `/functions/v1/crear-admin`, NO como RPC directa
  → el REVOKE no rompió el panel. Validado: se creó admin de prueba y se logueó OK.

### 2. RPCs convertidas a SECURITY DEFINER + search_path=public,pg_temp (cuerpo intacto)
Validado, sin cambios de lógica. Era necesario para que sigan funcionando cuando se
prenda RLS en jornadas/travel_stats (corren como owner, saltean RLS):
- `finalizar_guardia_en_jornada` ✓
- `agregar_guardia_a_jornada` ✓
- `actualizar_viaje_en_jornada` (4 args, la vieja) ✓
- `actualizar_viaje_en_jornada` (5 args, la que usa la app + llama a registrar_en_travel_stats) ✓
  Ya eran DEFINER de antes: `agregar_viaje_a_jornada`, `cerrar_jornada`, `crear_jornada`,
  `eliminar_guardia_de_jornada`.
- NOTA: `pg_stat_user_functions` da calls=NULL (track_functions apagado) → no sirve
  para saber si la de 4 args se usa. Se dejó (no se borró) por decisión conservadora.

### 3. RLS prendido + políticas {anon}/{authenticated} con criterio
- ESCALÓN 1 (tablas que la app NO usa): RLS + `*_panel` authenticated en
  admins, audit_log, comandos_dispositivo, empresas, asignaciones, rotacion,
  servicios_rotacion, coches_taller, viajes. Validado (panel funciona).
- ESCALÓN 2 (tablas que la app SÍ usa), hecho y validado:
  - `configuracion`: anon SELECT (app lee config). Panel lee+edita. ✓
  - `mensajes`: anon SELECT + UPDATE (lee/marca leído). Panel todo. ✓ (push llegó al celu)
  - `registro_alertas`: anon INSERT (alerta de clonación). Panel lee+resuelve. ✓
    (probado con INSERT simulado como rol anon desde SQL Editor)
  - `comandos_dispositivo`: agregado anon SELECT (la política panel ya estaba del E1). ✓

---

## 🚨 HALLAZGO IMPORTANTE — capa vieja de políticas {public} (PRÓXIMO CHAT = Escalón 3)
Al inventariar aparecieron **60 políticas**. Hay una capa VIEJA de políticas con rol
`{public}` (el "ya están escritas" del md viejo) conviviendo con las nuevas. Como RLS
combina políticas con OR, las viejas `{public}` con `qual=true`/`check=true` le ABREN a
anon puertas que creíamos cerradas. NO todas son peligrosas (muchas tienen
`qual=(auth.role()='authenticated')` que en la práctica solo deja pasar al panel).
El riesgo real son las `{public}` con `qual=true` o `check=true`.

### Políticas {public} PELIGROSAS a eliminar (tabla por tabla, con DROP POLICY):
- **comandos_dispositivo** (LA SENSIBLE): `comandos_insert` (anon manda comandos a
  cualquier celu), `chofer_read`/`comandos_select`/"dispositivo puede leer sus comandos"
  (3 SELECT redundantes), `chofer_update`/`comandos_update`/"dispositivo puede actualizar
  sus comandos" (3 UPDATE → anon modifica comandos). Dejar: `comandos_panel` +
  `comandos_anon_select`. Evaluar `admin_full` (redundante).
- **registro_alertas**: `alertas_acceso` (ALL public qual=true → anula detección de
  clonación). `alertas_insert` (redundante). Dejar: `registro_alertas_panel` +
  `registro_alertas_anon_insert`.
- **mensajes**: `mensajes_select` y `mensajes_update` (public qual=true, redundantes).
  `mensajes_insert` permite anon insertar (el .kt no lo hace). Dejar los 3 nuevos.
- **jornadas**: `jornadas_update` (public, permite a anon UPDATE DIRECTO, salteando las
  RPCs DEFINER que blindamos). Sacar UPDATE para anon. Revisar select/insert/delete.
- **configuracion**: `config_select` (redundante con configuracion_anon_select).
  config_update/delete están bien.

### Políticas {public} que están BIEN (filtran por rol/empresa, casi no tocar):
admins_* (subquery superadmin), choferes_* (filtran empresa_id='cot'; choferes_insert
permite anon registrarse = ES EL FLUJO de auto-registro, DEJAR; choferes_delete qual=false),
coches_taller_* (qual=authenticated), rotacion/servicios_rotacion.

### Tablas YA LIMPIAS (solo *_panel): viajes, asignaciones, empresas.

### PENDIENTE en Escalón 3:
- Confirmar si RLS está enabled en `choferes` y `jornadas` (tienen políticas viejas
  pero no las prendimos nosotros) y limpiarlas.
- `travel_stats`: falta prender RLS (anon nada, authenticated SELECT, escritura solo RPC).
- VALIDAR CON UN VIAJE REAL en celu el flujo completo (activar→finalizar→travel_stats
  registra→json vuelve) cuando se toque jornadas. Es la prueba grande.

---

## ⚠️ DEUDAS DE SEGURIDAD ANOTADAS (no urgentes hoy)
- **Rotar service_role key**: quedó expuesto en un screenshot del cron job
  `disparar-viajes-programados` (corre cada minuto, llama a Edge Function
  `enviar-push-viaje`). Revisar si está hardcodeado en `cron.job.command` o en env vars.
  El cron NO toca jornadas directo (solo push), corre con service_role → saltea RLS.
- Mover `insertarAlertaAcceso` y `registrarChofer` a RPCs DEFINER (hoy la app inserta
  directo → permite alertas/choferes falsos desde el anon key).
- Borrar overload viejo `actualizar_viaje_en_jornada` de 4 args (cosmético).
- Limpiar filas de prueba en `registro_alertas` (PRUEBA-RLS y otras de prueba).

---

## PENDIENTES DE LA APP (del md anterior, siguen abiertos)
- VALIDACIÓN BATERÍA EN RUTA REAL (Colonia): confirmar en logcat COT_GEO
  `modoInicial=BAJO`, `Crucero —`, `Escalando a ALTA — distancia=Xm` (ese número ajusta
  coords de checkpoints Juan Lacaze/Plaza Cuba, hoy APROXIMADAS). Confirmar permiso
  "Permitir todo el tiempo". El modo prueba NO valida ahorro (arranca en ALTA).
- Capa de TIEMPO del GPS: worker pasa `llegadaEstimada=0L`. Cuando travel_stats tenga
  ≥5 muestras, meter estimada real en inputData del worker. Encender capa de tiempo.
- Decidir `radioM` por checkpoint (5km) vs global `APROX_DISTANCIA_M` (20km).
- Más checkpoints: Chuy, Rocha (La Paloma/La Pedrera), Cabo Polonio (Aguas Dulces).
- Producción: `RECEIVE_BOOT_COMPLETED` (falta en manifest), Migrations reales (sacar
  `fallbackToDestructiveMigration` de CotDatabase.kt, hoy en version=13).
- Confirmar reglas de convenio (tipos con tome/cese, viático). OJO: el md "Fase 1
  Multi-empresa" fijó viático COT = 455.26 y laudo_km = 8.0122 (ajuste enero 2026).
- `arrivalTime` no se puebla (no bloquea). Doble activación (worker local Y cron).
  Inconsistencia Room↔Supabase (PATCH cron sobrescribe data entero).
- Sprint 5: MensajesScreen + PIN/BiometricPrompt/AuthLockScreen.

---

## 🏗️ PROYECTOS GRANDES (con su propio md / momento)
- **Migración panel Vanilla JS → React/Next**: habilita identidad server-side
  (service key del lado servidor). "el otro romedero de cabeza" del usuario.
- **Multi-empresa** (md "Fase 1 Multi-empresa" aparte): tablas laudos/empresas/
  reglas_empresa/rutas, refactor LaudoCalculator→LaudoConfig, empresa_id dinámico.
  VA JUNTO/DESPUÉS de Next (necesita identidad real; el aislamiento entre empresas
  hoy es por filtro de cliente, no forzado por base).
- **Identidad real por token de chofer**: la app hoy NO usa auth, "login" = legajo +
  device_id, sin identidad server-side → todas las políticas anon son `using(true)`,
  no filtran "su propia fila". Se resuelve con Next. Es el techo de lo que se puede
  asegurar con el diseño actual.
- ÚLTIMO: refactor a core único (caso prueba #1: jornada 07/06 632,5 km).

---

## CÓMO SEGUIR (orden sugerido)
1. (NUEVO CHAT) Escalón 3: limpiar las 60 políticas tabla por tabla (empezar por
   comandos_dispositivo). Prender RLS en choferes/jornadas/travel_stats. Validar con
   viaje real en celu. → esto CIERRA el lockdown, recién ahí distribuir el APK.
2. Corrida REAL en ruta Colonia (validación batería).
3. Limpieza de filas de prueba + deudas de seguridad anotadas.
4. Migración a React/Next.
5. Multi-empresa.
6. Producción app (BOOT_COMPLETED, Migrations reales).