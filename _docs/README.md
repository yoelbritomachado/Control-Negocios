# 📚 Documentación del Proyecto - Miss Chulerías

> **⚠️ REGLA DE ORO PARA AGENTES:**
> TODA la documentación del proyecto vive en esta carpeta (`_docs/`). La raíz del proyecto debe mantenerse LIMPIA.
> Solo excepciones: `README.md` (para humanos) y `AGENTS.md` (que apunta aquí).

---

## 🗺️ Mapa de Documentación

### 1. AGENTS.md (Reglas Universales)
**Ubicación:** `/AGENTS.md` (raíz) y `/_docs/AGENTS.md`

Este es el archivo MÁS IMPORTANTE. Contiene:
- Protocolos de colaboración entre agentes
- Convenciones de código
- Jerarquía de decisiones
- Reglas de seguridad

**TODO agente DEBE leer este archivo antes de hacer cualquier cambio.**

---

### 2. memory/ (Memoria del Proyecto)
Estado actual e histórico del desarrollo.

#### 2.1 CURRENT_STATE.md
**¿Qué leer?** PRIMERO. Siempre.

Resumen ejecutivo de:
- Estado actual del proyecto (estable/en desarrollo/roto)
- Últimos cambios aplicados
- Pendientes críticos
- Decisiones arquitectónicas recientes

**Regla:** Si solo puedes leer UN archivo, lee este.

#### 2.2 history/
Archivos por mes con el historial completo de cambios:
- `2026-02.md` - Febrero 2026
- `2026-01.md` - Enero 2026
- ...

#### 2.3 modules/
Documentación específica por módulo:
- `POS.md` - Punto de Venta
- `INVENTORY.md` - Inventario
- `PURCHASES.md` - Compras/Entradas
- `RETURNS.md` - Devoluciones
- `CASH_CONTROL.md` - Control de Efectivo
- `USERS.md` - Gestión de Usuarios
- `SETTINGS.md` - Configuración

---

### 3. architecture/
Documentación técnica y de diseño:

- `DESIGN_SYSTEM.md` - Sistema de diseño UI/UX
- `PWA_OFFLINE.md` - Implementación Offline-First
- `DATABASE_SCHEMA.md` - Esquema de base de datos
- `API_ENDPOINTS.md` - Documentación de API
- `SECURITY.md` - Consideraciones de seguridad

---

### 4. protocols/
Protocolos y manifiestos de colaboración:

- `COLLABORATION.md` - Protocolo de colaboración multi-agente
- `SYSTEM_LOGIC.md` - Reglas de lógica de negocio
- `GIT_WORKFLOW.md` - Flujo de trabajo Git

---

## 🔄 Flujo de Trabajo para Agentes

### Al INICIAR una sesión:
1. **Leer** `/_docs/memory/CURRENT_STATE.md`
2. **Leer** `/AGENTS.md` (si hay dudas de protocolo)
3. **Verificar** si hay archivos `.md` nuevos en `_docs/memory/`

### Durante el desarrollo:
1. **Actualizar** `CURRENT_STATE.md` con cambios realizados
2. **Documentar** decisiones importantes en `history/YYYY-MM.md`
3. **Actualizar** documentación de módulos afectados en `modules/`

### Al FINALIZAR una sesión:
1. Asegurar que `CURRENT_STATE.md` refleje el estado actual
2. Si hay cambios arquitectónicos importantes, actualizar `architecture/`
3. Hacer commit con mensaje descriptivo

---

## 📋 Convenios de Nomenclatura

### Archivos
- Usar MAYÚSCULAS para archivos principales (`CURRENT_STATE.md`)
- Usar snake_case para archivos secundarios (`purchase_flow.md`)
- Usar YYYY-MM.md para archivos históricos

### Formatos
- Encabezados con `#` para títulos principales
- Fechas en formato ISO: `2026-02-20`
- Estados con emojis: ✅ Completado | 🚧 En progreso | ❌ Pendiente | ⚠️ Crítico

---

## 🌐 Colaboración Multi-Agente

### Versión Local (Tú)
- Trabajas directamente en los archivos
- Haces cambios inmediatos
- Sincronizas con Git

### Versión Online (Otro Agente)
- Lee esta estructura para entender el proyecto
- Sigue los mismos protocolos
- No crea archivos en la raíz
- Propone cambios vía GitHub Issues/PRs

---

## 🚨 No Hagas Esto

❌ Crear archivos `.md` en la raíz del proyecto
❌ Modificar archivos sin actualizar `CURRENT_STATE.md`
❌ Borrar archivos de `history/` (son el registro histórico)
❌ Ignorar `AGENTS.md`

✅ Mantener la raíz limpia
✅ Documentar cambios inmediatamente
✅ Seguir la estructura de carpetas
✅ Leer `CURRENT_STATE.md` primero

---

**Última actualización:** 2026-02-20
**Mantenido por:** Todos los agentes del proyecto
