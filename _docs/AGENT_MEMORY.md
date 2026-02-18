# AGENT MEMORY - Memoria de Decisiones del Proyecto

> **IMPORTANTE**: Este archivo contiene una síntesis de todas las decisiones importantes, requerimientos y especificaciones que el usuario me ha indicado a lo largo del tiempo. Se debe consultar antes de realizar cambios que puedan contradecir decisiones previas.

---

## 📋 DECISIONES DE DISEÑO Y FUNCIONALIDAD

### 2026-02-18 - Menú de Configuración: Tipos de Gastos
**Status**: Pendiente implementación

**Requerimiento**: Crear un menú de configuración donde se puedan gestionar los tipos de gastos del negocio.

**Especificaciones técnicas**:
- Tabla con columnas: Nombre del gasto | Valor (MN)
- Funcionalidades: Crear, Editar, Borrar
- Ejemplo: "Limpieza" | 100 MN
- Los gastos configurados deben aparecer en la lista de gastos del POS

**Razón**: Los montos predefinidos (Pago de Área $3000, Limpieza $100) estaban hardcodeados. Se necesita flexibilidad para que el dueño los configure.

**Relacionado con**: `SYSTEM_LOGIC_RULES.md` sección 3 - los montos predefinidos deben ser editables.

---

## 🔄 ESTADO ACTUAL DEL SISTEMA

- **Sistema de gastos**: Implementado con tabla `expense_types` (SQLite)
- **Tipos actuales**: Pago de Área ($3000), Limpieza ($100), Otros (manual)
- **Interfaz de config**: NO EXISTE - necesita crearse

---

## ⚠️ REGLAS DE CONTRADICCIÓN

Si en el futuro se solicita algo que contradiga lo anterior, el agente debe:
1. Consultar este archivo
2. Notificar al usuario sobre la contradicción
3. Esperar confirmación antes de proceder

---

*Última actualización: 2026-02-18*
