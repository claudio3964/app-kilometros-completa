# Estrategia de Ejecución — Multi-empresa (Kotlin)

> Cómo aplicar `MULTIEMPRESA.md` **por etapas, sin romper al cliente en producción**.
> Cada etapa es independiente, enviable y reversible. Se sigue en orden.
> Documento complementario, no reemplaza a `MULTIEMPRESA.md`.

---

## La plataforma es multi-tenant. COT es solo el primer cliente.

Esto no es "la app de COT con soporte para más empresas". Es **una plataforma SaaS multi-empresa** donde COT es el primer inquilino.

- **Cero literales de empresa en el código.** En el estado final no queda ningún `"cot"` en `.kt` ni en `.ts`. (Las etiquetas `Log.e("COT", …)` no cuentan — son texto de log, no identidad de empresa.)
- **COT vive como dato en Supabase, nunca como constante de código.** Los valores hardcodeados de hoy sirven para **una sola cosa**: sembrar la fila de COT en la DB. Una vez sembrada, manda la DB.
- **Una empresa existe en la plataforma solo cuando contrata el servicio.** El alta la hace el super-admin (filas en `empresas` + `reglas_empresa` + puntero al `laudo`). Antes de eso, esa empresa no existe para el sistema.
- **Un chofer solo puede registrarse contra una empresa ya existente y activa.** Si la empresa no contrató, no hay nada a lo que el chofer se asocie → el registro se rechaza.

---

## Principios que no se negocian

1. **El cliente en producción calcula idéntico en todas las etapas.** Hoy ese cliente es COT. El seed usa los valores reales del código, así que "leer de la DB" da exactamente lo mismo que "leer de la `const`". Nunca debe existir una etapa donde el monto del cliente vivo pueda cambiar.
2. **No se toca Room (`CotDatabase`).** Usa `fallbackToDestructiveMigration()` → cualquier cambio de versión **borra los datos del celular del chofer**. La config multiempresa vive en Supabase y se lee en runtime; jamás se persiste como entidad Room.
3. **Solo cambios aditivos en Supabase.** Tablas y columnas nuevas. Nada destructivo. La tabla vieja `configuracion` se deja viva hasta que el nuevo loader esté validado, después se retira.
4. **No hay fallback a una empresa hardcodeada.** La config siempre se resuelve desde la empresa del chofer logueado. El respaldo offline es **la última config cacheada de esa misma empresa** (por `empresa_id`), nunca una empresa fija. Si no hay caché ni red y no se puede resolver la empresa → **fail safe**: la app no inventa números, avisa "configuración no disponible". Para una app que calcula pago, fallar fuerte es más seguro que pagar mal.
5. **Una etapa = un commit = un `gradlew assembleDebug` verde.** Compilar antes de cada commit. Cada etapa tiene su verificación antes de darla por cerrada.

---

## Dos hallazgos del código que afinan el plan

### A. Ya existe un mecanismo de config remota a medio construir
`ViajeRepository` (líneas 468–471 y 649) ya llama a `supabase.getConfiguracion()`, que lee una tabla **`configuracion`** (plana, `clave`/`valor`, **global, sin `empresa_id`**) y saca `precio_km_conductor` y `viatico_comida`.

**Implicancia:** el seam ya existe pero es global (mono-empresa). El nuevo loader de 3 capas lo **reemplaza** (no se duplica). `configuracion` queda como fallback temporal y se retira al cerrar la Etapa 3.

### B. `PdfGenerator` se saltea la config (bug latente)
`PdfGenerator.kt:42` llama `LaudoCalculator.calcular(jornada)` **sin** config → usa los `const`. Hoy coincide; el día que la config remota difiera, **el PDF mostraría un monto distinto al de la pantalla**. La Etapa 0 lo unifica.

---

## Estrategia de inicio: arrancar por el refactor (Etapa 0)

`MULTIEMPRESA.md` pone las tablas primero. Recomiendo invertir y arrancar por el **refactor de `LaudoCalculator` → `LaudoConfig`**:

- **Kotlin puro, cero DB, cero datos de producción.** Imposible romper Supabase o el celular de un chofer.
- **Define el contrato.** El `data class LaudoConfig` es exactamente lo que las tablas deberán entregar; el SQL de la Etapa 1 se diseña para encajar.
- **Reversible y aislado.** Si algo no convence, se revierte un commit.

> Durante la Etapa 0 hace falta un valor inicial para que `LaudoConfig` tenga con qué calcular antes de que exista la DB. Ese valor es un **scaffold transitorio** = los valores hardcodeados de hoy, **sin nombre de empresa**, marcado `// TEMPORAL — eliminar en Etapa 3`. No es "el default de COT": es andamiaje que se demuele cuando entra la carga remota. El estado final no tiene ningún valor de empresa en el código.

---

## Etapas

| # | Etapa | Toca | Riesgo | Enviable solo |
|---|-------|------|--------|---------------|
| 0 | Refactor `LaudoCalculator` → `LaudoConfig` | Kotlin (3 archivos) | Mínimo | ✅ |
| 1 | 4 tablas + seed de la 1ª empresa (COT) | Supabase (SQL) | Bajo | ✅ |
| 2 | Migrar `routes_catalog.js` → `rutas` | Script + Supabase | Bajo | ✅ |
| 3 | Cargar `LaudoConfig` remoto + demoler scaffold | Kotlin + Supabase | Medio | ✅ |
| 4 | `empresa_id` dinámico + gate de registro | Kotlin + Edge fn | Medio | ✅ |
| 5 | RLS en todas las tablas | Supabase | **Alto** | ✅ |
| 6 | Panel (capas 1/2 y 3) | Repo web (otro) | — | — |

---

### Etapa 0 — Refactor `LaudoCalculator` → `LaudoConfig`
- **Objetivo:** sacar las `const` de negocio y reemplazarlas por un `LaudoConfig` inyectable.
- **Archivos:** `LaudoCalculator.kt`, `ViajeRepositoy.kt` (call sites 471 y 649), `PdfGenerator.kt` (línea 42).
- **Qué se hace:**
  - Crear `LaudoConfig` (tal cual §4 del plan) y un scaffold transitorio con los valores actuales, marcado para eliminar.
  - `calcular(jornada, config)` lee todo de `config`.
  - Propagar `config` a `calcularAcopladoKm()` y `determinarViatico()` — ahí están enterrados 45 min de tome/cese, franjas 14/23, 3.5 h, 9 h y los casos `chuy`/`la pedrera`.
  - Unificar `PdfGenerator` para usar el mismo `config` (cierra el hallazgo B).
- **Por qué no rompe:** el scaffold reproduce los `const` byte a byte. Cero contacto con Supabase o Room.
- **Verificación:** jornada de control conocida (ej. Colonia, $2692) → mismo monto al centavo antes y después.

### Etapa 1 — Crear 4 tablas + seed de la primera empresa
- **Objetivo:** materializar `laudos`, `empresas`, `reglas_empresa`, `rutas` y sembrar COT como dato.
- **Archivos:** SQL en Supabase (versionado en `supabase/migrations/`).
- **Qué se hace:** DDL + seed del §2 y §3 del plan. El seed = valores exactos del scaffold (laudo 8.0122, viático 455.26, 30/40 km/h, tome/cese 42.5, acoplado 30, tipos). COT entra acá, como cualquier empresa futura entrará después.
- **Por qué no rompe:** la app todavía no lee estas tablas. DDL aditivo puro.
- **Verificación:** query que devuelva la fila de COT con los valores esperados.

### Etapa 2 — Migrar `routes_catalog.js` → `rutas`
- **Objetivo:** poblar la capa 3 (rutas/km) de COT.
- **Archivos:** script de migración (parsea `www/routes_catalog.js` de `dev-rebuild-core`) + inserts en `rutas`.
- **Qué se hace:** inserts con `empresa_id='cot'`; acoplados especiales (`la pedrera → 37.5`, `chuy → 0`) van como `acoplado_km`, el resto `null`.
- **Por qué no rompe:** la app usa km manual, no lee `rutas` todavía.
- **Verificación:** filas insertadas vs. entradas del catálogo; spot-check de 3–4 rutas.

### Etapa 3 — Cargar `LaudoConfig` remoto + demoler el scaffold
- **Objetivo:** que la app componga el `LaudoConfig` desde las tablas (capa 1 + 2) **al login**, lo cachee por `empresa_id`, y **eliminar el scaffold transitorio**.
- **Archivos:** `SupabaseService.kt` (loader nuevo que reemplaza `getConfiguracion()`), `ViajeRepositoy.kt`.
- **Qué se hace:**
  - Loader nuevo: resuelve la empresa del chofer → trae su `reglas_empresa` + el `laudo` vigente → compone `LaudoConfig` → lo cachea en sesión (SharedPreferences, keyed por `empresa_id`).
  - Orden de resolución: (1) config remota fresca → (2) caché de esa empresa → (3) fail safe. **Nunca** una empresa fija.
  - Una vez verificado, **borrar el scaffold** de la Etapa 0 y retirar `configuracion`.
- **Por qué no rompe:** mientras el scaffold sigue como fallback hasta el final de esta etapa, no hay momento sin fuente válida. COT lee de la DB valores idénticos a los que tenía hardcodeados.
- **Verificación:** con red OK → mismo monto. Sin red, con caché → mismo monto. Sin red ni caché → mensaje de "configuración no disponible", **no** un monto inventado.

### Etapa 4 — `empresa_id` dinámico + gate de registro
- **Objetivo:** eliminar los 4 literales `"cot"` y hacer que el `empresa_id` salga de la sesión.
- **Archivos y líneas (verificadas):**
  - `SupabaseService.kt:116` — `p_empresa_id` en RPC `crear_jornada`
  - `SupabaseService.kt:432` — insert en `registro_alertas`
  - `SupabaseService.kt:728` — insert en `choferes`
  - `crear-admin/index.ts:55` — insert en `admins` → **requiere `empresa_id` por body, sin default**
- **Qué se hace:**
  - Los 3 puntos Kotlin leen el `empresa_id` de la sesión del chofer.
  - **Gate de registro:** el chofer solo se registra si su `empresa_id` existe en `empresas` y está `activo`. Si no, se rechaza ("empresa no habilitada").
  - `crear-admin` exige `empresa_id` explícito (sin `'cot'` por default).
- **Por qué no rompe:** mientras solo exista COT, resolver desde sesión da `"cot"` igual → comportamiento neutro.
- **Verificación:** registro + cierre de jornada de prueba → llega con `empresa_id` correcto. Y el chequeo definitivo: `grep -rni "'cot'\|\"cot\"" app/src supabase --include=*.kt --include=*.ts | grep -vi "com.driverlog"` devuelve **vacío**.

### Etapa 5 — RLS (la de mayor riesgo)
- **Objetivo:** aislar datos por empresa antes de la 2ª.
- **Por qué es delicada:** la app usa la **anon key compartida**. RLS mal escrito **rompe lecturas/escrituras** (login, `crear_jornada`, `registro_alertas`, `choferes`, loader de config). `laudos` = lectura para todas / escritura solo super-admin.
- **Cómo blindarla:** escribir políticas, probar **cada operación** en un Supabase de staging ANTES de activar en producción. Activar solo con las 5 operaciones en verde.
- **Verificación:** checklist de las 5 operaciones con RLS prendido.

### Etapa 6 — Panel
- Fuera del repo Kotlin. Va en el repo web (`rutauy-web` con Next + `supabase/`, §9 del plan). Mover `crear-admin` ahí. Se planifica aparte.

---

## Regla de cierre de cada sesión

En el commit (o en `PLAN_DESARROLLO_KOTLIN.md`) dejar anotado:
1. En qué etapa quedamos y si está cerrada o a medias.
2. Resultado de la verificación de esa etapa.
3. La próxima sub-tarea concreta.

---

## Resumen de arranque

**Primera jugada: Etapa 0** — refactor `LaudoCalculator` → `LaudoConfig` con un scaffold transitorio (sin nombre de empresa, marcado para eliminar en Etapa 3), incluyendo unificar `PdfGenerator`. Es lo más seguro, define el contrato y no toca ni Supabase ni Room. El estado final no tiene ningún `"cot"` en el código: COT vive solo como dato sembrado, igual que cualquier empresa que contrate después.
