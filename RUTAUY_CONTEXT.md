# RutaUY / DriverLog — Contexto General del Sistema

## 1. ¿Qué es?

**RutaUY** (nombre comercial) / **DriverLog** (nombre técnico) es un sistema de gestión de flota para empresas de transporte de pasajeros de Uruguay. El piloto actual está siendo desarrollado con **COT** (Compañía Oriental de Transporte) como cliente target.

El objetivo a largo plazo es convertirlo en un **SaaS multi-tenant** para vender a otras empresas de transporte uruguayas (Turil, Copay, Cynsa, Rutas del Sol, Agencia Central, etc.).

---

## 2. Stack Tecnológico

### App del Chofer (Android)
- **Framework:** Capacitor 6 (Vanilla JS/HTML/CSS — sin frameworks frontend)
- **Repo:** `claudio3964/app-kilometros-completa` branch `dev-rebuild-core`
- **Directorio web:** `/www`
- **Plugins nativos:**
  - `@capacitor-community/background-geolocation@1.2.26` — GPS en background
  - `@capacitor/filesystem` — manejo de archivos
  - `@capacitor/push-notifications` — FCM push
  - `@capacitor/share` — compartir PDF
- **App ID:** `com.driverlog.app`
- **App Name:** `DriverLog`

### Backend
- **Base de datos:** Supabase (`frjeivfpldcigklwepqt.supabase.co`)
- **Push notifications:** Firebase FCM (proyecto `driverlog-280da`)
- **Edge Functions:** Supabase Edge Functions (Deno)
- **Cron:** pg_cron en Supabase (job ID 2, cada minuto)

### Panel Admin
- **URL producción:** `cot-driver-admin.netlify.app`
- **Deploy:** Netlify, branch `dev-rebuild-core`
- **Stack:** HTML/CSS/JS vanilla (archivo único `www/admin/index.html`)

---

## 3. Estructura de Archivos `/www`

```
www/
├── index.html              # App principal del chofer
├── style.css               # Estilos globales
├── app_bootstrap.js        # Bootstrap principal, motores, OTA check
├── core/core.js            # Lógica de negocio central
├── ui_registro.js          # Pantalla de registro del chofer
├── ui_travels.js           # UI de viajes
├── ui_guards.js            # UI de guardias
├── ui_mensajes.js          # Sistema de mensajes push
├── ui_navigation.js        # Navegación entre pantallas
├── ui_summary.js           # Resumen de jornada
├── geo_terminal.js         # Motor GPS / detección de terminales
├── guardia_monitor.js      # Monitor de duración de guardias
├── sync.js                 # Sincronización con Supabase
├── sync_rotacion.js        # Sync de rotación
├── routes_catalog.js       # Catálogo de rutas
├── schedules_cot.js        # Horarios COT
├── push_notifications.js   # Manejo de push FCM
├── travel_stats.js         # Estadísticas de viajes
├── jspdf.umd.min.js        # Generación de PDF
└── admin/index.html        # Panel admin completo
```

---

## 4. Base de Datos (Supabase)

### Tablas principales

#### `jornadas`
Registro diario de trabajo del chofer.
```json
{
  "date": "2026-05-08",
  "closed": false,
  "guards": [...],
  "legajo": "4112",
  "travels": [...],
  "createdAt": 1778228269914,
  "baseInicio": "Montevideo",
  "syncStatus": "synced",
  "orderNumber": "4112-20260508",
  "tomeCeseGenerado": false,
  "totalsSnapshot": {...}
}
```

#### `choferes`
Registro de choferes registrados.
- `legajo` — número de legajo (identificador único)
- `nombre` — nombre completo
- `tipo` — `efectivo` | `contratado`
- `base` — terminal base (Montevideo, Colonia, etc.)
- `device_id` — ID del dispositivo
- `fcm_token` — token para push notifications
- `empresa_id` — `cot` (para multi-tenant futuro)

#### `mensajes`
Mensajes del panel admin hacia los choferes.
- `tipo` — `mensaje` | `asignacion` | `urgente` | `guardia`
- `para` — legajo del chofer o `todos`
- `leido` — boolean
- `cerrado` — boolean (solo superadmin puede cerrar)
- `cerrado_por` — email del admin
- `data` — JSON con datos del viaje o guardia asignada

#### `admins`
Administradores del panel.
- `rol` — `superadmin` | `despachador` | `supervisor`
- `activo` — boolean

#### `registro_alertas`
Alertas de dispositivos duplicados (chofer instala en nuevo celu).

#### `audit_log`
Log de auditoría (en desarrollo).

#### `rotacion`
Tabla de rotación de choferes efectivos.

#### `servicios_rotacion`
Servicios asignados según posición en rotación.

#### `coches_taller`
Coches en taller con motivo.

---

## 5. Estructura de un Viaje (`travel`)

```json
{
  "id": "TRV-1778228269916",
  "coche": "924",
  "turno": "PASAJERO",
  "kmAuto": 178,
  "origen": "Montevideo",
  "status": "programado",
  "destino": "Colonia",
  "acoplado": false,
  "tomeCese": false,
  "createdAt": 1778228269916,
  "kmEmpresa": 178,
  "acopladoKm": 0,
  "inicioReal": null,
  "syncStatus": "local",
  "arrivalTime": "08:00",
  "hoursWorked": 2,
  "tipoServicio": "PASAJERO",
  "departureTime": "06:00",
  "llegadaEstimada": 1778238000000,
  "inicioProgramado": 1778230800000,
  "llegadaReal": null,
  "duracionMinutos": 120
}
```

### Estados de un viaje
- `programado` — creado, esperando inicio
- `en_curso` — viaje activo
- `finalizado` — completado
- `cancelado` — cancelado

### Tipos de servicio
- `TURNO` — servicio regular
- `DIRECTO` — sin paradas intermedias
- `EXPRESO` — rápido
- `PASAJERO` — servicio de pasajeros
- `CONTRATADO` — servicio contratado privado
- `SEMI` — semi-directo

---

## 6. Estructura de una Guardia (`guard`)

```json
{
  "id": "GRD-1777987690966",
  "dia": "2026-05-05",
  "fin": "16:00",
  "type": "especial",
  "hours": 5,
  "inicio": "11:00",
  "status": "finalizada",
  "viatico": false,
  "createdAt": 1777987690966,
  "kmGuardia": 200,
  "syncStatus": "local",
  "cortadaAuto": true,
  "descripcion": "Contrato reyna reyes"
}
```

### Tipos de guardia
- `comun` — guardia estándar, 30 km/hora
- `especial` — guardia especial/contrato, 40 km/hora

### Estados de guardia
- `programada` — asignada, hora futura
- `en_curso` — activa
- `finalizada` — completada

---

## 7. Reglas de Negocio

### 7.1 Tome y Cese
- Se aplica en el **primer viaje del día** cuando el chofer sale desde su base
- Genera km adicionales calculados según la distancia entre terminales
- **Fórmula:** km de tome y cese según tabla de distancias entre terminales
- Se marca con `tomeCese: true` en el viaje
- Solo se genera una vez por jornada (`tomeCeseGenerado`)
- El campo `baseInicio` define desde dónde sale el chofer

### 7.2 Viáticos
- Se genera cuando una guardia supera las **8 horas continuas**
- Valor: **$455 por viático**
- Una guardia puede generar máximo **1 viático**
- Se marca con `viatico: true` en la guardia
- El monitor de guardia avisa 5 minutos antes de cumplir 8h, 9h, 10h...
- Si el chofer no responde en 10 minutos → la guardia se cierra automáticamente a la hora exacta del umbral

### 7.3 Acoplados
- Cuando el coche lleva acoplado se registra `acoplado: true`
- Genera km adicionales: `acopladoKm` (por defecto 30 km)
- Se suma al total de km de la jornada

### 7.4 Km por tipo de guardia
- Guardia **común:** 30 km/hora
- Guardia **especial:** 40 km/hora

### 7.5 Cálculo de monto
- **Tarifa base:** $7.637 por km
- **Fórmula:** `kmTotal × 7.637`
- `kmTotal = kmViajes + kmGuardias + kmTomeCese + kmAcoplados`

### 7.6 Cierre de jornada
- Puede cerrarse **manualmente** por el chofer
- Límite de **8 horas** → puede cerrar sin restricción
- Límite de **9 horas** → requiere confirmación adicional
- Al cerrar → genera `totalsSnapshot` con todos los totales
- El PDF de jornada se genera al cerrar

---

## 8. Sistema de GPS / Terminales

### Terminales configuradas
Las coordenadas están en `geo_terminal.js`:
- **Montevideo:** lat -34.894149, lng -56.167112
- **MVDEO (terminal interna):** lat -34.894149, lng -56.167112
- **Punta del Este:** lat -34.95738, lng -54.938867
- **Colonia:** lat -34.4726414, lng -57.8425142
- **Piriápolis:** lat -34.8613073, lng -55.2746958
- **La Paloma:** lat -34.6565574, lng -54.159223
- **Rocha:** lat -34.4833, lng -54.3333
- **Maldonado:** lat -34.9024, lng -54.9576
- Y más...

### Lógica de inicio automático de viaje
1. Motor JS corre cada 15 segundos (foreground)
2. Compara GPS actual con coords de terminal de origen
3. Radio: 50 metros
4. Si está dentro del radio + hora de salida llegó → inicia viaje

### Lógica de cierre automático de viaje
1. Una vez iniciado el viaje, monitorea terminal destino
2. Cuando llega al radio de 50m → espera 15 segundos de quietud
3. Cierra el viaje automáticamente

### Modo Prueba
- Simula coordenadas GPS de Montevideo
- Permite probar el sistema sin moverse
- Botón visible en la app (pendiente ocultarlo con toque secreto)

---

## 9. Sistema de Push FCM

### Flujo
1. **Cron Supabase** (pg_cron, cada minuto) → llama Edge Function `enviar-push-viaje`
2. Edge Function busca jornadas abiertas con viajes programados
3. **Pre-salida:** Si `inicioProgramado` está entre ahora y +5 min → manda push "Tu viaje sale en 5 minutos"
4. **Pre-llegada:** Si `llegadaEstimada` está entre ahora y +10 min → manda push "Verificando llegada a terminal"

### Edge Function `enviar-push-viaje`
- URL: `https://frjeivfpldcigklwepqt.supabase.co/functions/v1/enviar-push-viaje`
- Autenticación: JWT RS256 con Firebase Admin
- Proyecto Firebase: `driverlog-280da`

### Pendiente
- Evitar push duplicado (mandar más de una vez en la ventana)
- Service Worker ejecute `verificarViajesProgramados()` al recibir push sin abrir app

---

## 10. Sistema OTA (Over The Air Update)

- **Bucket Supabase Storage:** `app-updates`
- **Archivo:** `version.json`
- **URL:** `https://frjeivfpldcigklwepqt.supabase.co/storage/v1/object/public/app-updates/version.json`
- **Versión actual:** `2.1.2`
- Al arrancar la app → compara versión local con Supabase
- Si hay diferencia → modal "Nueva versión disponible"
- El chofer toca "Actualizar" → recarga la app

### Para actualizar
1. Cambiar `APP_VERSION` en `app_bootstrap.js`
2. Subir `version.json` nuevo a Supabase Storage
3. Compilar y distribuir APK nuevo

---

## 11. Sistema de Mensajes Admin → Chofer

### Tipos de mensaje
- `mensaje` — texto libre
- `asignacion` — asignación de viaje con datos completos
- `urgente` — mensaje urgente
- `guardia` — asignación de guardia (común o especial)

### Flujo de asignación de viaje
1. Admin selecciona chofer, origen, destino, hora, coche, tipo servicio
2. Se guarda en tabla `mensajes`
3. Polling cada 30s en la app detecta el mensaje
4. App muestra notificación con botones Aceptar/Rechazar
5. Al aceptar → se agrega el viaje a la jornada activa
6. Si no hay jornada → se crea automáticamente

### Flujo de asignación de guardia
1. Admin selecciona chofer, hora inicio, tipo (común/especial)
2. App recibe mensaje → evalúa si la hora es futura o pasada
3. Si es futura → `status: "programada"` → se activa cuando llega la hora
4. Si ya pasó → `status: "en_curso"` → inicia inmediatamente
5. Motor verifica guardias programadas cada 60 segundos

---

## 12. Panel Admin

### Roles
- **superadmin** — acceso total, puede cerrar mensajes, gestionar admins
- **despachador** — acceso a mensajes, jornadas, choferes, rotación, flota
- **supervisor** — acceso limitado (sin rotación, flota ni mensajes)

### Tabs disponibles
- **Dashboard** — estadísticas generales, alertas recientes
- **Choferes** — lista de choferes, comando limpiar jornadas
- **Jornadas** — historial con filtros, exportar JSON
- **Alertas** — dispositivos duplicados, autorizar/rechazar
- **Rotación** — rotación efectivos Montevideo
- **Flota** — estado de coches (servicio/libre/taller)
- **Estadísticas** — duración real de rutas, velocidad promedio
- **Mensajes** — enviar mensajes/asignaciones, archivar (superadmin)
- **Admins** — gestión de administradores (solo superadmin)

---

## 13. Multi-tenant (Futuro)

Todas las tablas tienen `empresa_id` — actualmente siempre es `"cot"`. Para onboarding de nueva empresa:
- Crear registro en tabla `empresas`
- Configurar terminales propias
- Generar admins con su `empresa_id`
- Customizar branding (logo, colores)

---

## 14. Cómo usar este archivo en Claude y Claude Code

### En chats de Claude (claude.ai)
Al inicio de cada sesión, pegá este bloque:

```
Contexto del proyecto: Ver archivo RUTAUY_CONTEXT.md adjunto.
Stack: Vanilla JS + Supabase + Capacitor Android + Firebase FCM
Repo: claudio3964/app-kilometros-completa branch dev-rebuild-core
```

Luego adjuntá este archivo `.md` en el chat. Claude va a tener todo el contexto sin necesidad de subir archivos JS.

### En Claude Code (terminal)
Al iniciar Claude Code en el proyecto, usá este prompt:

```
Lee el archivo RUTAUY_CONTEXT.md en la raíz del proyecto para entender 
el contexto completo antes de hacer cualquier cambio. Este archivo tiene 
las reglas de negocio, estructura de datos y stack técnico.
```

### Ubicación recomendada del archivo
Guardá `RUTAUY_CONTEXT.md` en la **raíz del repo**:
```
app-kilometros-completa/
├── RUTAUY_CONTEXT.md   ← acá
├── www/
├── android/
└── capacitor.config.ts
```

### Tips para usar en sesiones
1. **Siempre adjuntá el .md** al inicio del chat antes de hacer preguntas
2. **Para Claude Code:** el archivo en la raíz del repo es suficiente, Claude Code lo lee automáticamente con `ls` y `cat`
3. **Para nuevas features:** referenciá la sección relevante ("ver sección 7.2 Viáticos")
4. **Para bugs:** describí el problema y referenciá el archivo JS afectado
5. **Actualizá el .md** cuando agregues nuevas funcionalidades importantes

---

## 15. Pendientes al 08/05/2026

- [ ] Fix push FCM duplicado — guardar `pushEnviadoAt` en el viaje
- [ ] Service Worker ejecute inicio de viaje al recibir push (sin abrir app)
- [ ] Ocultar botón Modo Prueba (toque secreto en logo)
- [ ] Rediseño glassmorphism + bus animado en pantalla registro
- [ ] Filtro "Archivados" en mensajes (solo superadmin)
- [ ] Poblar tabla `audit_log`
- [ ] Script de deploy automático con bump de versión
- [ ] Refactor repo neutro RutaUY (sacar hardcodeos de COT)
- [ ] Panel super-admin multi-empresa
- [ ] Instructivo PDF para choferes y admins
- [ ] OTA web-based para actualizar sin reinstalar APK

---

*Última actualización: 08/05/2026*
*Versión app: 2.1.2*
*Versión panel admin: deploy automático desde dev-rebuild-core*
