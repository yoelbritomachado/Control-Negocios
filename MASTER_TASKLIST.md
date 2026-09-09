# 📋 LISTA MAESTRA — Michulerías CRM (D:\mch_crm_full)

> **Lista viva de trabajo** — persistente en disco y en memoria Engram (`moltbot_bunker`).
> Yoe va dictando items; se agregan al final de "Pendientes". Al completar, se mueven a "Hecho (reciente)" con fecha.
> Prioridad acordada con Yoe: la marcamos 🔥 cuando él la pide explícitamente para ya.

**Última actualización:** 2026-09-08 (revisión exhaustiva de historial 06-30 → 09-08, 24 sesiones, 167 mensajes reales del usuario)

---

## ✅ HECHO Y VERIFICADO (código presente + build OK)

### 🧱 Bloque A — Núcleo POS & Rendimiento
- [x] **POS-01** Cuello de botella en checkout → eliminado (queries preparadas 1 sola vez por ticket; commit `ba0de99`)
- [x] **POS-02** Anti-doble clic + idempotencia → columna `idempotency_key` + índice único; POST duplicado = 1 venta (commit `72424ce`)
- [x] **POS-03** Fondo Inicial de Caja → `initial_cash` + `cash_injections` + carryover por sede (ver KANB-F)

### 🔄 Bloque B — Devoluciones & Mermas (PARCIAL)
- [x] **DEV-01 búsqueda offline** — implementada (SearchDropdown + IndexedDB, sin bloqueo de red)
- [x] **DEV-02 buscador modular** — `SearchDropdown` reutilizable
- [x] **DEV-03 contención dropdown** — implementada en el componente
- [x] **DEV-04 registro 100% offline + fotos** — `ReturnsModule.jsx` con captura de foto (`capture="environment"`) y evidencia fotográfica
- [x] **DEV-05 devolución con producto sin existencia / antiguo** — presente en ReturnsModule (tipos new/damaged/used con efecto stock)
- [ ] **DEV-06 auditoría** — el ticket pendiente en la sesión para aprobación Dueño/Admin en el arqueo **NO está** (pendiente real)

### 💰 Bloque C — Gastos & Divisas (PARCIAL)
- [ ] **EXP-01 tipos de gasto offline** en IndexedDB — **NO verificado** (pendiente)
- [ ] **EXP-02 gastos con pago híbrido** (efectivo/transferencia/mixto) — **NO** (pendiente; requiere columna payment_method en expenses y modal)
- [x] **FX-01 compra de divisas** — `CurrencyPurchaseModal.jsx` (USD/EUR/MXN, tasa default de settings, editable; ticket feed; descuenta MN de la caja en el momento); fix arqueo suma fondo inicial (`ba0de99`)

### 📊 Bloque D — Cierre de Turno & Salarios (COMPLETO salvo SES-04 en curso)
- [x] **SES-01 arqueo financiero matemático** — Ventas−Gastos±Devoluciones por método; total calculado NO editable (a pedido de Yoe)
- [x] **SES-02 salario vendedor acumulado + checkbox cobro** — FUSIONADO (merge 01764ca): sección en CloseSessionModal con acumulado turno/histórico + checkbox
- [x] **SES-03 liquidación salario desde efectivo del turno** — FUSIONADO: settled vs deferred verificado E2E (venta 400 → wage 20 → efectivo 480)
- [ ] **SES-04 redondeo a centenas ±$100** — subagente trabajando en worktree E (feat/redondeo-cierre)

### 📱 Bloque E — Interfaz Móvil, Header & Tickets (COMPLETO)
- [x] **UI-03 rediseño tickets** — badge ONLINE/OFFLINE ausente → se usa "Venta contingencia" en stock ≤ 0 (pendiente decisión de Yoe sobre badge visible)
- [x] **UI-04 barra filtros sticky en inventario** — presente (sticky top-0 en ProductGrid/PurchaseSection)
- [x] **UI-01 indicador móvil de conexión** — FUSIONADO (merge c3dbad6): ConnectionIndicator.jsx + useConnectionStatus.js en header
- [x] **UI-02 notificaciones deep linking** — FUSIONADO: clic en notificación navega al evento y marca leída
- [x] **Aviso medianoche vendedor** — FUSIONADO: useMidnightWarning.js (banner desde 23:00)

### ⚙️ KANB-F/G/D + Fixes (verificados en vivo)
- [x] **KANB-F Parte 1** — fondo heredado + inyecciones en apertura/cierre; destino SOLO decisión (no editable)
- [x] **KANB-F Parte 2** — página Control de Efectivo (`/control-efectivo`), 5/5 rangos OK con datos reales
- [x] **KANB-G** — auto-cierre de sesiones a medianoche + stale-on-boot (verificado: sesión #2 auto-cerrada)
- [x] **KANB-D** — auditoría de sesiones `pending_review` (badge + filtro + aprobación)
- [x] Fix crashes: `finalCash` (CloseSessionModal) y `sale.inventory` null (backfill DB + invLabel fallback)
- [x] **Partículas al confirmar swipe** — `BurstFeedback.jsx` integrado en `SwipeToConfirm` (aprobación verde/check, eliminación rojo/menos, estallido de 12 chispas; overlay fuera del carril + acción diferida 600ms)
- [x] **Venta Rápida/Contingencia eliminada** del header (orden 05/09, confirmada en código)

---

## 📌 PENDIENTES REALES (actualizado post-fusión 08/09 20:55)

1. **SES-04 Redondeo a centenas (±$100)** — en curso (worktree E, subagente). 🔥
2. **QA E2E integral con Playwright** — ventas, gastos, devoluciones+auditoría, salarios, bolsas de moneda, UI. Se lanza al fusionar SES-04. 🔥
3. **UI-03 badge ONLINE/OFFLINE visible** — requiere decisión de Yoe (hoy: "Venta contingencia" solo en stock ≤ 0).
4. **Origen de fecha configurable** — server local / internet / dispositivo. En espera de VPS.
5. ~~DEV-06~~ ✅ fusionado (2ee05fa) · ~~SES-02/03~~ ✅ (01764ca) · ~~Control moneda + EXP-01/02~~ ✅ (b68c342) · ~~UI-01/02 + aviso medianoche~~ ✅ (c3dbad6)

---

## ❓ CONFLICTOS / DECISIONES PENDIENTES (preguntar a Yoe)

1. **SES-02 vs Bloque D**: el panel de salarios existe pero **no está integrado al cierre de turno** — ¿lo integramos al modal de cierre (con checkbox "Solicitar cobro de salario") o lo dejamos como panel aparte?
2. **UI-03 ticket**: ¿querés que el ticket muestre **badge ONLINE/OFFLINE visible** en la cabecera? (hoy el tipo interno "SALE" no se muestra; el spanglish ya no aparece)
3. **DEV-06**: ¿la aprobación de devoluciones va en el **mismo arqueo** (pendientes a un lado del cierre) o en una pestaña separada de **auditoría**?
4. **Control definitivo por moneda**: ¿los **saldos anteriores de mes** se cargan manualmente por Yoe al cambiar de mes, o se auto-heredan del cierre del mes previo?
5. **Prioridad global**: de los 11 pendientes, ¿querés arrancar por **DEV-06 + cierre (SES-02/03/04)** o por el **Control definitivo por moneda**? (ambos marcados 🔥)

---

## ⚙️ REGLAS DE NEGOCIO FIJAS (acordadas — no re-discutir)

- La sesión es UN día de trabajo: dura menos de un día, nunca más. Medianoche = corte.
- El Efectivo Total en Caja es un **valor calculado** — jamás editable.
- El destino del efectivo al cerrar es una **decisión binaria**: entregar todo al admin O dejar todo de fondo.
- El fondo dejado se hereda automáticamente a la próxima apertura de esa sede (MCH1/MCH2) y se acepta implícitamente (no reversible).
- Las inyecciones de efectivo y el fondo inicial son parte de la caja; salen de ella al usarse (gasto/divisa/devolución).
- Sesiones abiertas = dinero circulante: NO entra al saldo final hasta cierre + aprobación admin.
- Las compras de divisas descuentan de la caja en el momento.
- Comisiones vendedor: 5% de la ganancia real.
- `hermes verify` debe mantenerse `ok: true`; lint sin errores críticos.
- BD activa: `server/inventory.db`. Backend: `server/index.js` (puerto 3002). Frontend: Vite 5173.

## 🔧 NOTAS TÉCNICAS

- Backend reinicio: matar PID del puerto 3002 → `Start-Process node index.js -WorkingDirectory D:\mch_crm_full\server`
- `hermes verify --json` se cuelga si va sin `--skip-start` (phase start sin teardown) → usar `hermes verify --skip-start` o `--json --skip-start` (PASS ~25s); runtime boot = arrancar server + poll `/api/health`
- Migraciones de columnas: `PRAGMA table_info` + `ALTER TABLE` idempotente en arranque del server
- Fuentes históricas consultadas: estado de DB de sesiones (24 sesiones CRM), KANBAN.md 28/08, sesiones 01/09 y 02/09 (KANB-A/B/C), 05/09 (estado del Kanban), commits `ba0de99`/`72424ce`/`d4b433a`