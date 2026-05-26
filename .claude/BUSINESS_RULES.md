# BUSINESS RULES - DriverLog COT

## Objetivo

DriverLog COT es un ecosistema de gestión operativa compuesto por:

- Aplicación móvil para choferes.
- Futuro panel administrativo web.
- Motor de cálculo y validación de jornadas.
- Futuro backend de sincronización y análisis.

El objetivo es registrar, validar y gestionar:

- Jornadas laborales.
- Viajes.
- Guardias.
- Tome y cese.
- Kilómetros recorridos.
- Viáticos.
- Liquidaciones.
- Información administrativa y operativa.

Toda la información registrada por el chofer debe ser compatible con futuras funciones del panel administrativo y con los procesos de liquidación.

---

## Reglas críticas

Nunca romper:

1. Integridad de jornadas.
2. Integridad de viajes.
3. Integridad de guardias.
4. Persistencia y consistencia de datos en Room.
5. Resúmenes diarios.
6. Resúmenes generales.
7. Cálculo de viáticos.
8. Liquidación mensual.
9. Coherencia temporal de todos los registros.

---

# Viajes

## Objetivo

Registrar servicios realizados por el chofer durante una jornada.

Los viajes forman parte del cálculo operativo de la aplicación e impactan directamente en:

- Resúmenes diarios.
- Resúmenes generales.
- Viáticos.
- Estadísticas.
- Futuras liquidaciones.

---

## Datos principales

Cada viaje puede contener:

- Origen.
- Destino.
- Hora de salida.
- Hora final operativa.
- Kilómetros.
- Observaciones (futuro).

---

## Consideración importante

La hora final registrada actualmente NO representa necesariamente la hora real de llegada al destino.

La hora final operativa es utilizada principalmente para:

- Cálculo de duración.
- Validaciones internas.
- Detección de solapamientos.
- Generación de estadísticas.
- Construcción futura de modelos de estimación.

---

## Evolución futura

El sistema deberá soportar simultáneamente:

- Hora de salida.
- Hora de llegada estimada.
- Hora de llegada real.

La llegada real permitirá construir un sistema inteligente basado en históricos para:

- Estimar tiempos de viaje.
- Detectar desvíos.
- Mejorar cálculos automáticos.
- Generar promedios confiables por ruta.

---

## Validaciones

Todo viaje debe cumplir:

- Hora de salida válida.
- Hora final operativa posterior a la salida.
- Kilómetros mayores o iguales a cero.
- Coherencia temporal dentro de la jornada.
- Compatibilidad con reglas de solapamiento.
- Consistencia con tome y cese cuando corresponda.