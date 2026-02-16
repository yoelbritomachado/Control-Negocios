# REGLAS DEL SISTEMA MCH CONTROL (SAGRADO)
> **IMPORTANTE:** Este archivo contiene la lógica de negocio inmutable del sistema. Debe leerse antes de realizar cualquier modificación estructural o funcional. No borrar ni alterar sin autorización explícita.

## 1. Gestión de Sesiones de Venta
*   **Estado Inicial:** Si no hay sesión abierta, la pantalla muestra **únicamente** un botón central "Abrir Sesión de Venta" con la Hora y Fecha en tiempo real.
*   **Apertura:** Al abrir sesión, se carga la interfaz completa del POS.
*   **Cierre:** Al cerrar sesión, el sistema vuelve al estado inicial (Botón "Abrir Sesión").
*   **Aprobación:** Todas las sesiones y eventos críticos (cierres, pagos) requieren aprobación del Administrador/Dueño.

## 2. Funcionalidad POS (Punto de Venta)
*   **Botón GUARDAR (Pausar):** Permite "pausar" o "apartar" la venta actual para atender a otro cliente y recuperarla posteriormente. No es una reserva de stock permanente, solo temporal en sesión.
*   **Botón COBRAR:**
    *   Abre ventana de pago.
    *   Permite seleccionar método: **Efectivo** o **Transferencia**.
    *   Calcula y muestra el **Cambio** a devolver.
*   **Barra Superior:** Muestra "HOLA [Usuario]" y "FECHA/HORA" en tiempo real constante.

## 3. Gestión de Gastos
*   El botón "GASTOS" registra salidas de efectivo de la caja.
*   **Tipos de Gasto:**
    1.  **Pago de Área:** Monto predefinido (actualmente $3000).
    2.  **Limpieza:** Monto predefinido (actualmente $100).
    3.  **Otros:** Campo abierto para "Detalle" y "Monto" manual.
*   *Nota:* Los montos predefinidos deben ser editables en un futuro Panel de Administración.

## 4. Política de Devoluciones (Tipos y Flujos)
En todos los casos de devolución es **OBLIGATORIO** adjuntar evidencia fotográfica (Cámara o Galería).

### A. Rotura (Devolución de Dinero - Producto Roto)
*   **Causa:** El producto se rompió (responsabilidad del negocio/transporte).
*   **Acción:** Se devuelve el dinero al cliente.
*   **Flujo de Dinero:** Se resta de la venta original (si existe en sesión) o se paga del efectivo del negocio (Admin).
*   **Inventario:** El producto **NO** reingresa al inventario (se descarta).

### B. Devolución por Gusto (Producto Bueno)
*   **Causa:** Al cliente no le gustó.
*   **Condición:** Producto en buenas condiciones.
*   **Acción:** Se devuelve el dinero al cliente.
*   **Inventario:** El producto **SÍ** reingresa al inventario.

### C. Cliente Devuelve Roto (Mal uso/Daño)
*   **Causa:** Cliente devuelve producto pero está roto.
*   **Acción:** Se devuelve el dinero (política de satisfacción).
*   **Flujo de Dinero:** Se resta de la venta o efectivo negocio.
*   **Inventario:** El producto **NO** reingresa al inventario.

## 5. Salarios y Pagos a Trabajadores
*   **Cálculo:** El salario es el **5% de la GANANCIA** (Venta - Costo), no del total vendido.
*   **Acumulación:** Se acumula a través de varias sesiones del mismo trabajador.
*   **Solicitud:** Al cerrar sesión (o en interfaz dedicada), el trabajador puede "Solicitar Pago".
*   **Aprobación:** El Administrador debe aprobar el pago.
*   **Fuente:** El pago sale del **Efectivo del Negocio**.

## 6. Roles y Permisos
*   **Administrador/Dueño:** Acceso total. Aprueba sesiones, pagos de salario y devoluciones complejas.
*   **Vendedor:** Abre/Cierra sesiones, registra ventas, pausas y sube evidencias.
