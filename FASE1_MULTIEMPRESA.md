# Fase 1 — Multi-empresa (Kotlin)

> Plan de build para sacar la configuración hardcodeada del código y moverla a
> Supabase, alimentada desde el panel web, dejando la app lista para dar de alta
> empresas nuevas.
> **Alcance:** solo la app nativa Kotlin (`main`). La app JS (`dev-rebuild-core`) queda obsoleta.

---

## 0. Decisiones tomadas

- **Refactor una sola vez**, sobre la app Kotlin. La JS no se toca.
- Del repo JS se rescata **un solo dato**: `www/routes_catalog.js` → siembra la tabla `rutas`. La Kotlin no tiene catálogo de rutas (usa km manual), así que ese array es la fuente.

### La fuente de verdad es el panel → Supabase (NO el código)

Los valores se cargan/editan desde el **panel web** y se guardan en Supabase; la
app Kotlin los lee de ahí. El código deja de tener valores de negocio.

Los valores hardcodeados de hoy (`LaudoCalculator.kt` / `core.js`) **NO son la
verdad futura** — sirven para una sola cosa: la **carga inicial (seed) de COT**,
para que el día que se prenda la lectura desde Supabase COT siga calculando
idéntico. Una vez sembrado, manda el panel; el código no.

> El `RUTAUY_CONTEXT.md` está desactualizado (laudo 7.637, regla de viático "8 h") — no usar como referencia de valores.

---

## 1. Modelo de 3 capas

El cálculo es un **motor parametrizable**, no constantes. Tres capas, cada una con su dueño:

| Capa | Qué es | Quién la configura |
|------|--------|--------------------|
| **1. Laudo** | Tarifas oficiales (Consejo de Salarios, norma nacional aprobada por el Poder Ejecutivo): $/km, viático, km/hora guardia, tome/cese. Por categoría + subgrupo + vigencia. | **Vos** (super-admin). Solo-lectura para empresas. |
| **2. Reglas de empresa** | *Cómo* aplica el laudo cada empresa: % de km que paga, qué componentes usa (guardia especial sí/no, acoplado, tome/cese). | **Vos**, al dar de alta el contrato (afecta el pago → no lo edita la empresa). |
| **3. Datos operativos** | Rutas + km, terminales, branding, flota, choferes. | **Cada empresa**, en su panel. |

`monto = tarifas(capa 1) × reglas(capa 2) × datos de la jornada(capa 3)`

---

## 2. Esquema de tablas Supabase

### `laudos` — tarifas oficiales (central, nacional)
```sql
create table laudos (
  id            bigserial primary key,
  categoria     text not null,            -- grupo, ej '13'
  subgrupo      text not null,            -- ej '02'
  variante      text not null,            -- 'general' | 'ley_19942' | 'no_ley_19942' | 'maldonado'
  vigencia_desde date not null,            -- historial: qué laudo regía cuándo
  laudo_km                 numeric not null,
  monto_viatico            numeric not null,
  guardia_comun_km_hora    numeric not null,
  guardia_especial_km_hora numeric not null,
  tome_cese_km             numeric not null,
  acoplado_extra_km        numeric not null,
  -- reglas de viático (hoy clavadas en determinarViatico)
  horas_minimas_viatico    numeric not null default 9,
  franja_viatico_1         int     not null default 14,
  franja_viatico_2         int     not null default 23,
  horas_min_franja         numeric not null default 3.5,
  minutos_tome_cese        int     not null default 45,
  decreto_ref   text,                      -- respaldo oficial (opcional)
  unique (categoria, subgrupo, variante, vigencia_desde)
);
```
> Grupo 13, Subgrupo 02 = Transporte Terrestre de Personas Internacional (COT).
> El cálculo elige la fila vigente: misma categoría/subgrupo/variante de la
> empresa, con `vigencia_desde <= fecha_jornada`, la más reciente.

### `empresas` — identidad / branding + a qué laudo apunta
```sql
create table empresas (
  id            text primary key,          -- ej: 'cot'
  nombre        text not null,
  razon_social  text,
  rut           text,
  laudo_categoria text not null,           -- → laudos.categoria ('13')
  laudo_subgrupo  text not null,           -- → laudos.subgrupo ('02')
  laudo_variante  text not null,           -- → laudos.variante
  logo_url      text,
  color_primario   text,
  color_secundario text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
```

### `reglas_empresa` — capa 2 (1:1 con empresa)
```sql
create table reglas_empresa (
  empresa_id           text primary key references empresas(id),
  pct_km_pasajero      numeric not null default 100,    -- 100, 50, etc.
  usa_guardia_comun    boolean not null default true,
  usa_guardia_especial boolean not null default true,   -- COT: true
  usa_tome_cese        boolean not null default true,
  usa_acoplado         boolean not null default true,
  tipos_con_tome_cese  text[]  not null,
  tipos_con_acoplado   text[]  not null,
  updated_at           timestamptz not null default now()
);
```
> A resolver: si el % es uno solo o por componente. Empezar con `pct_km_pasajero` y extender si hace falta.

### `rutas` — catálogo por empresa (capa 3)
```sql
create table rutas (
  id           bigserial primary key,
  empresa_id   text not null references empresas(id),
  origen       text not null,
  destino      text not null,
  km           int  not null,
  acoplado_km  numeric,          -- null = usa laudos.acoplado_extra_km
  cartel_a     text,             -- carrocería marcopolo (opcional)
  cartel_b     text,             -- carrocería neobus (opcional)
  unique (empresa_id, origen, destino)
);
```
> Los casos especiales de acoplado de `calcularAcopladoKm` (`la pedrera → 37.5`,
> `chuy → 0.0`) pasan a ser **datos**: esas filas llevan su `acoplado_km`. El
> resto queda en null → toma el valor del laudo.

---

## 3. Seed de COT (valores reales del código Kotlin)

```sql
-- Capa 1: laudo — Grupo 13, Subgrupo 02 (Transporte Terrestre Personas Internacional)
insert into laudos (
  categoria, subgrupo, variante, vigencia_desde,
  laudo_km, monto_viatico,
  guardia_comun_km_hora, guardia_especial_km_hora,
  tome_cese_km, acoplado_extra_km
) values (
  '13', '02', 'no_ley_19942', '2026-01-01',  -- COT no comprendida en Ley 19942 (confirmar si MTSS la archiva como 'general')
  8.0122, 455.26,                           -- viático oficial vigente (lo que COT paga hoy)
  30, 40,
  42.5, 30
);

-- Capa: identidad
insert into empresas (id, nombre, laudo_categoria, laudo_subgrupo, laudo_variante)
values ('cot', 'Compañía Oriental de Transporte', '13', '02', 'no_ley_19942');

-- Capa 2: reglas de COT (km completo, ambas guardias activas)
insert into reglas_empresa (
  empresa_id, pct_km_pasajero,
  usa_guardia_comun, usa_guardia_especial, usa_tome_cese, usa_acoplado,
  tipos_con_tome_cese, tipos_con_acoplado
) values (
  'cot', 100,
  true, true, true, true,
  '{TURNO,SEMIDIRECTO,DIRECTO,DIRECTISIMO,EXPRESO,CONTRATADO}',
  '{DIRECTO,DIRECTISIMO}'
);
```
Las rutas (capa 3) se siembran desde `routes_catalog.js` (script: parsear `window.routes` y generar inserts con `empresa_id='cot'`).

---

## 4. Refactor de `LaudoCalculator.kt`

Reemplazar las `const` privadas por una config inyectable. `calcular()` ya recibe
`laudoKm` y `montoViatico` como parámetros → extender el patrón a todo.

La app **compone** las capas 1 y 2 en un solo objeto que alimenta el cálculo
(el split en 3 tablas es por dueño/normalización; el motor recibe todo junto):

```kotlin
data class LaudoConfig(
    // Capa 1 — laudo oficial
    val laudoKm: Double,
    val guardiaComunKmHora: Double,
    val guardiaEspecialKmHora: Double,
    val tomeCeseKm: Double,
    val acopladoExtraKm: Double,
    val montoViatico: Double,
    val horasMinimasViatico: Double = 9.0,
    val franjaViatico1: Int = 14,
    val franjaViatico2: Int = 23,
    val horasMinFranja: Double = 3.5,
    val minutosTomeCese: Int = 45,
    // Capa 2 — reglas de empresa
    val pctKmPasajero: Double = 100.0,
    val usaGuardiaComun: Boolean = true,
    val usaGuardiaEspecial: Boolean = true,
    val usaTomeCese: Boolean = true,
    val usaAcoplado: Boolean = true,
    val tiposConTomeCese: Set<String>,
    val tiposConAcoplado: Set<String>
)

object LaudoConfigDefaults {
    // Fallback = COT, por si no hay config remota
    val COT = LaudoConfig(
        laudoKm = 8.0122,
        guardiaComunKmHora = 30.0,
        guardiaEspecialKmHora = 40.0,
        tomeCeseKm = 42.5,
        acopladoExtraKm = 30.0,
        montoViatico = 455.26,
        tiposConTomeCese = setOf("TURNO","SEMIDIRECTO","DIRECTO","DIRECTISIMO","EXPRESO","CONTRATADO"),
        tiposConAcoplado = setOf("DIRECTO","DIRECTISIMO")
    )
}
```

`fun calcular(jornada, config: LaudoConfig = LaudoConfigDefaults.COT)` → lee todo
de `config`. Con el default = COT, **nada se rompe** mientras se migra.

---

## 5. Puntos donde `empresa_id` está clavado en `"cot"`

Solo 4 lugares. Todos deben leer el `empresa_id` de la sesión (chofer logueado).

| # | Archivo | Línea | Contexto |
|---|---------|-------|----------|
| 1 | `SupabaseService.kt` | 116 | `p_empresa_id` en RPC `crear_jornada` |
| 2 | `SupabaseService.kt` | 432 | insert en `registro_alertas` (device duplicado) |
| 3 | `SupabaseService.kt` | 728 | insert en `choferes` (registro del chofer) |
| 4 | `supabase/functions/crear-admin/index.ts` | 55 | insert en `admins` — recibir `empresa_id` por body |

---

## 6. Resolver `empresa_id` + cargar config en runtime

1. Al **registrar** el chofer se asocia su empresa → la fila en `choferes` guarda `empresa_id`.
2. Al **login**, la app trae: `empresa_id` → su `reglas_empresa` (capa 2) + el `laudo` vigente de su categoría/subgrupo (capa 1) → compone un `LaudoConfig` y lo guarda en sesión.
3. `SupabaseService` y `LaudoCalculator` leen de ahí en vez de `"cot"`.

---

## 7. Seguridad — RLS (obligatorio antes de la 2ª empresa)

Activar Row Level Security en todas las tablas con `empresa_id` y política por
empresa. `laudos` es de lectura para todas las empresas pero escritura solo
super-admin. Mientras es solo COT con anon key compartida el riesgo es bajo;
apenas entra otra empresa, esto es lo que impide que una vea datos de la otra.

---

## 8. Paneles — quién escribe qué

| Panel | Edita | Capas |
|-------|-------|-------|
| **Tu panel (super-admin)** | Laudos oficiales + alta de empresa + reglas de contrato | 1 y 2 |
| **Panel de cada empresa** | Rutas/km, terminales, branding, flota, choferes | 3 |

**Flujo (una sola fuente de verdad):**
```
Panel (capas 1 y 2)  ─┐
                      ├─→  Supabase  ──→  app Kotlin lee al login y calcula
Panel empresa (cap 3) ─┘
```

> Migración futura del panel: Vanilla JS → **React/Next**. NO cambia Supabase —
> mismo proyecto, mismas tablas, mismo "link". Con Next se puede usar la service
> key del lado servidor (mejora de seguridad).

---

## 9. Organización de repos (recomendación)

No meter el panel web en el repo Kotlin (mezclar Gradle + npm es desprolijo y no
se comparten tipos: uno es Kotlin, otro TS). **Dos repos:**

| Repo | Contiene | Deploy |
|------|----------|--------|
| `rutauy-android` | App Kotlin, solo Android | Play Store / APK |
| `rutauy-web` | Panel Next **+** carpeta `supabase/` (migraciones + edge functions) | Vercel / Netlify |

Lo único compartido entre Android y web es el esquema de Supabase (SQL) → su lugar
es el lado web/backend. Hoy `crear-admin` está en el repo Kotlin; conviene moverla
al repo web.

> Reorganizar repos es pura organización de código — no afecta el flujo de datos (todo se integra vía Supabase).

---

## 10. Orden de ejecución

1. Crear las 4 tablas (`laudos`, `empresas`, `reglas_empresa`, `rutas`) + seed de COT.
2. Refactor `LaudoCalculator` → `LaudoConfig` (default = COT, no rompe nada).
3. Cargar config remota al login (laudo vigente + reglas) → inyectarla en `calcular()`.
4. Hacer dinámico el `empresa_id` en los 4 puntos.
5. Script: migrar `routes_catalog.js` → tabla `rutas`.
6. RLS en todas las tablas.
7. Edge function `crear-admin` recibe `empresa_id` por parámetro.
8. Panel: Configuración (capas 1 y 2) que escribe en las tablas.

> Con esto hecho, la **alta de empresa nueva** es casi gratis: es el mismo
> formulario partiendo de filas vacías.

---

## 11. Cosas a resolver (no urgen)

- ✅ Categoría/subgrupo: **Grupo 13, Subgrupo 02** (Transporte Terrestre de Personas Internacional). Ajuste vigente: enero 2026.
- ✅ Variante: COT **no comprendida en Ley 19942** (`no_ley_19942`). Confirmar solo si el MTSS archiva sus tablas bajo la etiqueta "General".
- ✅ Viático de COT: **455.26** (oficial vigente, lo que paga hoy). El `455` de la app JS era valor viejo → se descarta con esa app.
- Si el % de km es único (`pct_km_pasajero`) o por componente (km pasajero / guardia / etc. por separado). Recién importa con una 2ª empresa que pague distinto.

> **Qué es la Ley 19942:** exoneración de aportes jubilatorios patronales (2021,
> alivio COVID) para ciertas actividades (escolares, turismo, remises, taxis,
> apps). NO es una regla salarial. COT (línea regular interdepartamental) no está
> en esa lista → no comprendida. El subgrupo 02 separa "comprendidas" vs "no
> comprendidas" porque sus tablas salariales difieren.
>
> El `laudo_km = 8.0122` ya es oficial: viene del ajuste enero 2026, transcrito al
> actualizar la app (comentario "actualizado laudo 01/01/2026").

---

*Fuentes verificadas en el repo: `LaudoCalculator.kt`, `SupabaseService.kt`,
`viaje.kt`, `JornadaCompleta.kt`, `crear-admin/index.ts` (rama `main`);
`core.js`, `routes_catalog.js` (rama `dev-rebuild-core`).*
