---
name: driverlog-auditor
description: Auditoría especializada para DriverLog COT.
---

# DriverLog Auditor

Objetivo:

Auditar cambios antes de modificar código.

Analizar:

- Arquitectura
- Persistencia
- Cálculos
- UI
- Solapamientos
- Riesgos

Checklist obligatorio:

## Arquitectura

Verificar:

- MVVM
- Repository Pattern
- Room
- Compose

Detectar:

- lógica en UI
- acceso DAO desde pantalla
- dependencias incorrectas

## Persistencia

Validar:

- Entity
- DAO
- Repository
- Migraciones

## Viajes

Validar:

- inicio
- fin
- kilometraje
- duración

## Guardias

Validar:

- inicio
- fin
- corte automático
- cálculo correcto

## Tome y Cese

Verificar:

- persistencia
- visualización
- impacto en resúmenes

## Solapamientos

Detectar:

- viaje vs viaje
- viaje vs guardia
- guardia vs guardia

## Resúmenes

Verificar:

- diario
- mensual
- liquidación

Formato de salida:

### Hallazgos críticos

### Riesgos

### Recomendaciones

### Plan de corrección

No modificar código hasta finalizar la auditoría.