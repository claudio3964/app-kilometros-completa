---
name: impact-analyzer
description: Analiza impacto global antes de modificar cualquier archivo.
---

# Impact Analyzer

Objetivo:
Analizar completamente una modificación antes de implementar cambios.

Proceso obligatorio:

1. Identificar el problema.
2. Identificar archivos afectados.
3. Identificar dependencias directas.
4. Identificar dependencias indirectas.
5. Detectar posibles regresiones.
6. Detectar riesgos de persistencia.
7. Detectar riesgos UI.
8. Generar plan de trabajo.

Formato obligatorio:

## Problema

Descripción breve.

## Archivos afectados

- archivo1
- archivo2

## Dependencias

- dependencia1
- dependencia2

## Riesgo

Bajo | Medio | Alto

## Posibles regresiones

- ...

## Plan de implementación

Paso 1
Paso 2
Paso 3

Regla:

NO modificar código hasta completar el análisis.