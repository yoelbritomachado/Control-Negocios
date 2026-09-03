# KANBAN MASTER: MISS CHULERÍAS CRM - SPRINT DE MEJORAS TOTALES
**Última actualización:** 28 de Agosto, 2026
**Modo de Ejecución:** Autónomo / Paralelo por Bloques

---

## 📌 COLUMNA 1: BACKLOG / PLANIFICACIÓN
*Todos los requisitos relevados y agrupados por dominios funcionales.*

---

## 🚀 COLUMNA 2: EN PROGRESO (WIP)

### 🧱 BLOQUE A: NÚCLEO POS & RENDIMIENTO (Cero latencia + Anti-duplicados)
- [ ] **[POS-01]** Cuello de botella en checkout: Diagnosticar y erradicar demoras/congelamientos al presionar 'Proceder al Pago' y 'Confirmar'.
- [ ] **[POS-02]** Protección Anti-Doble Clic: Deshabilitar botón de cobro al instante + Spinner animado + Idempotency Key para evitar tickets duplicados.
- [ ] **[POS-03]** Fondo Inicial de Caja: Apertura con float rastreable separado de ventas + Registro de 'Inyección de Fondo' durante el turno.

### 🔄 BLOQUE B: DEVOLUCIONES & MERMAS (Offline + Rápido + Auditoría)
- [ ] **[DEV-01]** Búsqueda Offline Ultrarrápida: Búsqueda en memoria/IndexedDB al vuelo sin timeouts de red.
- [ ] **[DEV-02]** Buscador Modular Reutilizable: Integrar panel estándar por nombre, código y código de barras.
- [ ] **[DEV-03]** Contención de Dropdown: Evitar desbordamiento visual de la lista de resultados.
- [ ] **[DEV-04]** Registro 100% Offline & Evidencias: Guardar en `pending_returns` en IndexedDB con fotos locales.
- [ ] **[DEV-05]** Devolución con Producto Sin Existencia / Antiguo: Crear/reactivar ficha con foto, cantidad, costo, precio e inventario destino.
- [ ] **[DEV-06]** Flujo de Auditoría: Ticket pendiente en la sesión para aprobación/rechazo de Dueño/Admin en el arqueo.

### 💰 BLOQUE C: GASTOS & COMPRA DE DIVISAS
- [ ] **[EXP-01]** Tipos de Gasto Offline: Persistir en IndexedDB para disponibilidad 100% desconectado.
- [ ] **[EXP-02]** Gastos con Pago Híbrido: Soportar Efectivo, Transferencia o Mixto desglosado.
- [ ] **[FX-01]** Módulo Compra de Divisas (USD / EUR / MXN): Ticket de compra con divisa, cantidad, tasa, método de pago y liquidación en bóveda.

### 📊 BLOQUE D: CIERRE DE TURNO & SALARIOS MATEMÁTICOS
- [ ] **[SES-01]** Arqueo y Desglose Financiero Matemático: Cálculo transparente (Ventas - Gastos ± Devoluciones = Total a entregar por método).
- [ ] **[SES-02]** Acumulador de Salario del Vendedor & Checkbox de Cobro: Salario del turno + acumulado histórico + Checkbox 'Solicitar cobro de salario'.
- [ ] **[SES-03]** Liquidación de Salario desde Efectivo del Turno: Descontar de la entrega si hay saldo suficiente o diferir a caja central.
- [ ] **[SES-04]** Regla de Redondeo a Centenas (±$100 CUP) & Desglose de Pago (Efectivo/Transf) por Administración.

### 📱 BLOQUE E: INTERFAZ MÓVIL, HEADER & TICKETS
- [ ] **[UI-01]** Indicador Móvil de Conexión: Icono circular compacto de señal WiFi en header para celulares.
- [ ] **[UI-02]** Notificaciones Deep Linking: Marcar como leída y navegar directo al evento/recurso.
- [ ] **[UI-03]** Rediseño Visual de Tickets de Venta: Cero spanglish ('SALE'), badge ONLINE/OFFLINE, cabecera limpia, carrusel táctil de fotos y quitar botón de QR individual.
- [ ] **[UI-04]** Barra de Filtros y Búsqueda Sticky en Inventario: `sticky top-0` con backdrop blur al scrollear.

---

## ✅ COLUMNA 3: COMPLETADO / VERIFICADO
*(Se irán moviendo aquí tras cada build y verificación en código)*
