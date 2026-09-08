# KANBAN MASTER: MISS CHULERÍAS CRM - SPRINT DE MEJORAS TOTALES
**Última actualización:** 8 de Septiembre, 2026 (estado REAL verificado en código)
**Modo de Ejecución:** Autónomo / Paralelo por Bloques
**Detalle completo de cada tarea:** ver `MASTER_TASKLIST.md` (fuente única de verdad)

---

## ✅ COLUMNA 3: COMPLETADO / VERIFICADO

### 🧱 BLOQUE A: NÚCLEO POS & RENDIMIENTO — COMPLETO
- [x] **[POS-01]** Checkout sin cuello de botella (queries preparadas 1x por ticket) — commit `ba0de99`
- [x] **[POS-02]** Anti-doble clic + idempotency key + índice único — commit `72424ce`
- [x] **[POS-03]** Fondo Inicial de Caja + Inyección de Fondo (KANB-F)

### 💰 BLOQUE C: PARCIAL
- [x] **[FX-01]** Compra de Divisas USD/EUR/MXN completa (tasa editable, ticket feed, descuenta caja, fix arqueo)

### 📊 BLOQUE D: PARCIAL
- [x] **[SES-01]** Arqueo financiero matemático transparente por método de pago

### 🔄 BLOQUE B: PARCIAL
- [x] **[DEV-01]** Búsqueda offline ultrarrápida
- [x] **[DEV-02]** Buscador modular reutilizable (SearchDropdown)
- [x] **[DEV-03]** Contención de dropdown
- [x] **[DEV-04]** Registro 100% offline con evidencias fotográficas
- [x] **[DEV-05]** Devolución con producto sin existencia / antiguo

### 📱 BLOQUE E: PARCIAL
- [x] **[UI-04]** Barra de filtros sticky en inventario
- [x] **[UI-03]** Tickets sin spanglish (render limpio; badge visible = pendiente de decisión de Yoe)

### ⚙️ Extras del sprint
- [x] KANB-F Control de Efectivo (`/control-efectivo`) con rangos y tiempo real
- [x] KANB-G Auto-cierre medianoche + stale-on-boot (verificado en vivo)
- [x] KANB-D Auditoría sesiones pending_review (badge + filtro + aprobación)
- [x] Partículas al confirmar swipe (BurstFeedback: verde/check aprobar, rojo/menos eliminar)
- [x] Venta Rápida/Contingencia eliminada (orden 05/09)

---

## 🚀 COLUMNA 2: EN PROGRESO / SIGUIENTE

### 🔥 Prioridad inmediata (preguntar a Yoe el orden)
- [ ] **[DEV-06]** Auditoría de devoluciones: ticket pendiente en sesión para aprobación/rechazo de Dueño/Admin en el arqueo
- [ ] **[SES-02]** Salario vendedor: integrar WageRequestsPanel al modal de cierre (acumulado + checkbox cobro)
- [ ] **[Control-Moneda]** Control definitivo por moneda: MN / USD / EUR / Transferencias con saldos por columna (Excel de Yoe)

---

## 📌 COLUMNA 1: BACKLOG

### 💰 BLOQUE C: RESTANTE
- [ ] **[EXP-01]** Tipos de gasto offline (IndexedDB)
- [ ] **[EXP-02]** Gastos con pago híbrido (efectivo/transferencia/mixto)

### 📊 BLOQUE D: RESTANTE
- [ ] **[SES-03]** Liquidación de salario desde efectivo del turno (o diferir a caja central)
- [ ] **[SES-04]** Redondeo a centenas (±$100 CUP) + desglose de pago por administración

### 📱 BLOQUE E: RESTANTE
- [ ] **[UI-01]** Indicador móvil de conexión (icono WiFi compacto en header)
- [ ] **[UI-02]** Notificaciones deep linking (marcar leída + navegar al evento)

### ⚙️ UX / Infra
- [ ] Aviso visual al vendedor cuando su sesión cruza medianoche
- [ ] Origen de fecha configurable (server/internet/dispositivo) — en espera de VPS
