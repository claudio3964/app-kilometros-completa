---
name: architecture-guardian
description: Protector de arquitectura DriverLog Kotlin MVVM.
---

# Architecture Guardian

Objetivo:

Garantizar que toda modificación respete la arquitectura del proyecto.

## Flujo obligatorio

UI
↓
ViewModel
↓
Repository
↓
DAO
↓
Room

## Reglas

- No lógica de negocio en Compose.
- No acceso DAO desde UI.
- No acceso Room desde pantallas.
- Toda persistencia pasa por Repository.
- Mantener separación de responsabilidades.
- No duplicar modelos.
- No crear dependencias circulares.

## Verificaciones

### UI

Detectar:

- lógica compleja
- cálculos de negocio
- acceso a persistencia

### ViewModel

Permitir:

- coordinación
- estados UI

Evitar:

- acceso directo DAO

### Repository

Responsable de:

- reglas de acceso a datos
- integración Room

### Room

Validar:

- Entity
- DAO
- índices
- consultas

## Resultado

### Violaciones detectadas

### Riesgos

### Recomendaciones

No modificar código hasta completar la revisión.