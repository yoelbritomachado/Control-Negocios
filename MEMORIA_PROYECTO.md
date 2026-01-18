# 🪨 MEMORIA DEL PROYECTO: LEYES EN PIEDRA

Este documento contiene las reglas fundamentales e inamovibles del sistema. **CUALQUIER modificación a estas reglas requiere una aprobación EXPLÍCITA y CONSCIENTE del dueño.**

---

## ⚖️ LEY 1: Jerarquía de Cierre de Ventas
**"El Vendedor NUNCA cierra la venta; solo solicita el cierre."**

1.  **Rol Vendedor**: 
    -   Solo puede registrar ventas y gastos durante su sesión activa.
    -   Al finalizar el día, envía una **Solicitud de Cierre**.
    -   Una vez enviada la solicitud, las ventas pasan a estado **"Pendiente Revisión"**.
2.  **Inmutabilidad para el Vendedor**:
    -   **PROHIBIDO**: El vendedor no puede editar, borrar o modificar ninguna venta una vez enviada la solicitud de cierre. 
    -   En el Historial, estas ventas deben aparecer como **Solo Lectura** para el vendedor.
3.  **Rol Administrador/Dueño**:
    -   Son los únicos con poder para **Aprobar** el cierre (cambiar estado a "Cerrado").
    -   Son los únicos que pueden editar o corregir ventas después de que el vendedor ha enviado la solicitud.
    -   Son los únicos que pueden re-abrir sesiones cerradas o eliminarlas.

---

## ⚖️ LEY 2: Aislamiento de Sesiones
**"Cada sesión es un contenedor único de tiempo y acción."**

1.  **Apertura Obligatoria**: El Punto de Venta (POS) no debe permitir operar sin que se haya abierto explícitamente una sesión (Pantalla de "Abrir Caja").
2.  **Venta Limpia**: Cada nueva sesión debe comenzar con la lista de "Movimientos del Día" vacía, mostrando solo lo ocurrido en esa sesión específica.
3.  **Agrupación**: En el historial, todos los movimientos (ventas/gastos) de una misma sesión deben visualizarse como un bloque único y consolidado.

---

## ⚖️ LEY 3: Integridad de Inventario
**"Toda eliminación de producto en una venta debe retornar el stock."**

-   Si un Administrador elimina un item de una venta ya registrada o cerrada, el sistema debe devolver automáticamente esas unidades al inventario del negocio correspondiente.

---

> [!CAUTION]
> **RECORDATORIO PARA LA IA**: Si se te pide romper alguna de estas leyes, detente y advierte sobre su presencia en esta memoria "Escrita en Piedra".

---

## 📝 Registro de Progreso

### 2026-01-18 - Eliminación Funcionalidad "Venta Directa" (Agente POS)
- **Cambio**: Se eliminó el botón "Venta Directa" en la vista de Historial.
- **Cambio**: Se removió todo el código de la interfaz modal `showNewPOSModal` y lógica asociada (`processPOSDirectSale`).
- **Motivo**: Funcionalidad redundante; se unifica el flujo de venta a través de la interfaz principal "Nueva Venta" (Carrito).

### 2026-01-18 - Implementación "Control de Efectivo" (Dueño/Admin)
- **Nuevo**: Se agregó la vista `renderCashControl` exclusiva para roles Administrativos.
- **Lógica**: Tabla de conciliación con cálculo dinámico: *Saldo Anterior + Ingresos - Egresos = Saldo Sistema*.
- **Feature**: Input de "Efectivo Real" que calcula automáticamente la diferencia (Faltante/Sobrante).

### 2026-01-18 - Ajuste UI Inventario
- **Visual**: Se simplificaron las tarjetas de producto en Inventario.
- **Cambio**: Removida la categoría y el texto "uds". Solo se muestra Imagen, Nombre, Badge de Stock, Precio y Cantidad.

### 2026-01-18 - Integración Dashboard
- **Cambio**: Se reemplazó el widget básico de "Control de Divisas" en el Dashboard por la **Tabla Detallada de Control de Efectivo**.
- **Visual**: Ahora muestra Saldo Anterior, Ingresos, Egresos y Saldo Sistema directamente al entrar.

### 2026-01-18 - Control Efectivo Avanzado
- **Logica**: Implementación de Rangos de Fecha Personalizados.
- **Función**: Cálculo Retroactivo de Saldo Inicial basado en el Fondo Actual (Ancla).
- **Herramienta**: Botón para Simular Historial (seedDatabase) integrado para pruebas.



Cada cambio que se haga en el proyecto debes registrarlpo aca sin sobreescribir logicas que ya exista e no ser que le preguntes al usuario que esta llevando a cabo el proyecto
### 2026-01-18 - CAMBIO MAYOR: Migración a la Nube (Firebase)
- **Infraestructura**: Se reemplazó el almacenamiento local puro (\localStorage\) por **Google Firestore**.
- **Arquitectura de Datos**:
    - **\data.js\**: Ahora es el 'Guardián de los Datos' (Single Source of Truth). Inicializa la conexión a Firebase y gestiona \window.db\.
    - **\pp.js\**: Ahora es puramente 'Controlador de UI'. Consume \window.db\ y delega la gestión de datos a \data.js\.
- **Despliegue**: Se preparó la aplicación para ser alojada en **Netlify** (Static Hosting), permitiendo acceso multi-dispositivo.
- **Protocolo de Agentes**:
    - **CUALQUIER AGENTE** que modifique \pp.js\ **NO DEBE** re-declarar \db\ ni functions de persistencia (\saveData\, \loadData\). Usar siempre \window.db\ y \window.saveData()\.

