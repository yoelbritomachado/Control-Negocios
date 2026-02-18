# AGENT MEMORY - Memoria de Decisiones del Proyecto

> **IMPORTANTE**: Este archivo contiene una síntesis de todas las decisiones importantes, requerimientos y especificaciones que el usuario me ha indicado a lo largo del tiempo. Se debe consultar antes de realizar cambios que puedan contradecir decisiones previas.

---

## 📋 DECISIONES DE DISEÑO Y FUNCIONALIDAD

### 2026-02-18 - Módulo de Traslados (Transferencias entre Inventarios)
**Status**: ✅ Implementado

**Requerimiento**: Crear un módulo para transferir mercancía entre almacenes y puntos de venta.

**Ubicación**: Menú Gestión → "Traslados" (solo visible para Admin/Dueño)

**Interfaz**: Similar al POS pero simplificada, solo para transferencias:
- Selector de inventario ORIGEN
- Selector de inventario DESTINO  
- Carrito de productos a trasladar
- Confirmación de transferencia

**Tipos de traslado posibles**:
- Almacén → Punto de Venta
- Punto de Venta → Almacén
- Almacén → Almacén
- Punto de Venta → Punto de Venta

**Sistema de Notificaciones**:

| Quién hace el traslado | Tipo de traslado | Notificación a |
|------------------------|------------------|----------------|
| **Administrador** | Cualquier tipo | Dueño (siempre) |
| **Dueño** | Almacén → Almacén | Nadie |
| **Dueño** | Cualquier tipo a PV | Vendedores del PV destino |
| **Dueño** | Al mismo PV donde está | No aplica (no hay destino) |

**Reglas de notificación**:
1. Si el **Dueño** hace un traslado → NO se notifica a él mismo
2. Si el **Administrador** hace un traslado → SIEMPRE notificar al **Dueño**
3. Si el traslado va a un **Punto de Venta** → Notificar a los **vendedores** de ese PV
4. Traslados entre almacenes no generan notificaciones a vendedores

**Estados del traslado**:
- `pending`: Pendiente de aprobación/envío
- `in_transit`: En tránsito
- `received`: Recibido en destino
- `rejected`: Rechazado

**Permisos**:
- Solo **Dueño** y **Administrador** pueden crear traslados
- **Vendedores** NO ven el módulo de Traslados
- Los vendedores solo reciben notificaciones cuando les llega mercancía a su PV

---

### 2026-02-18 - Menú de Configuración: Tipos de Gastos
**Status**: ✅ Implementado

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
- **Interfaz de config**: ✅ EXISTE - SettingsPage.jsx
- **Módulo de Traslados**: En desarrollo

---

## ⚠️ REGLAS DE CONTRADICCIÓN

Si en el futuro se solicita algo que contradiga lo anterior, el agente debe:
1. Consultar este archivo
2. Notificar al usuario sobre la contradicción
3. Esperar confirmación antes de proceder

### 2026-02-18 - Restructuración del Menú de Gestión
**Status**: ✅ Implementado

### 2026-02-18 - Historial de Ventas con Edición de Sesiones
**Status**: ✅ Implementado

**Requerimiento**: Crear historial de ventas con datos de ejemplo y permitir editar sesiones sin perder el carrito actual.

**Funcionalidad implementada**:
1. **Ventas de ejemplo**: 7 ventas con diferentes estados (abiertas, pendientes, cerradas)
2. **Diseño tipo lista expandible**: Click para ver detalles de productos
3. **Botón "Editar Sesión"**:
   - Si hay carrito actual → Pregunta si guardar como ticket pendiente
   - Carga la sesión seleccionada en el POS
   - Muestra banner indicando sesión en edición
4. **Múltiples sesiones**: Cada sesión es independiente, no interfieren entre sí

**Estados de venta**:
- `open` (EN PROCESO): Azul, sesión activa editable
- `pending_review` (EN REVISIÓN): Amber, esperando aprobación
- `closed` (CERRADA): Verde, venta completada

**Datos guardados en localStorage**:
- `editing_session`: Info de sesión en edición
- `mch_saved_sales`: Tickets pendientes guardados

**Requerimiento**: Eliminar el menú "Historial" general y crear menús independientes para cada tipo de historial.

**Cambios en el menú (Gestión)**:
- ❌ Eliminar: "Historial" (general)
- ✅ Agregar: "Historial de Ventas"
- ✅ Agregar: "Historial de Compras"  
- ✅ Agregar: "Historial de Mermas"
- ✅ Agregar: "Mermas" (módulo para registrar pérdidas/roturas)

**Funcionalidad de Mermas**:
- Debe existir un módulo independiente para registrar mermas (fuera del POS)
- También debe haber acceso rápido desde el POS para registrar mermas
- Tipos de mermas (según SYSTEM_LOGIC_RULES.md):
  1. **Rotura Interna**: Disminuye stock, sin movimiento de dinero
  2. **Devolución Producto Nuevo**: Aumenta stock, devuelve dinero
  3. **Devolución Producto Dañado**: Stock neutral, devuelve dinero

---

*Última actualización: 2026-02-18*
