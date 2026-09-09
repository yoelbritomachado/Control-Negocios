# QA E2E CRM Miss Chulerías — Sesión 2 (escenarios 5-12)
**Fecha:** 2026-09-09 13:10-13:52 (GMT-4) | **Tester:** agente QA (reemplazo) | **App:** localhost:5173 / backend :3002

## Contexto inicial
- Sesión de anoche (#5) auto-cerrada a medianoche, status `pending_review`.
- Se abrió sesión nueva **#6** (owner yoelbritomachado, fondo $1000) — **se deja ABIERTA**.

## Resultados

| # | Escenario | Resultado | Evidencia |
|---|---|---|---|
| 5 | Gasto mixto EXP-02 | **PASS** | 16-21, 24-26 |
| 6 | Devolución + auditoría DEV-06 | **PASS** | 22-31 |
| 7 | Salario en cierre SES-02/03 | **PASS** | 27, 32-33 |
| 8 | Control de Efectivo | **FAIL** (crash página) | 34 |
| 9 | Indicador WiFi | **PASS** | 35-37 |
| 10 | Aviso medianoche | **PASS** (fuera de horario) | 38 |
| 11 | Notificaciones deep linking | **PASS** | 39-40 |
| 12 | Regresión F5 | **PASS** | 41 |

---

### 5. GASTO MIXTO — PASS
- Modal gasto: tipo "Otros" + monto $250 → método Mixto → desglose Efectivo $100 / Transferencia $150 (UI muestra "✓ cuadra").
- POST `/api/expenses` → `{"id":5,"payment_method":"mixed","amount_cash":100,"amount_transfer":150}`.
- DB `expenses` id=5: `amount=250, payment_method=mixed, amount_cash=100, amount_transfer=150, session_id=6` ✓ desglosado.
- Gotcha UX: cambiar el tipo de gasto DESPUÉS de elegir Mixto resetea el método (handleTypeChange hace setPaymentMethod al default del tipo). Orden correcto: tipo → monto → mixto.
- Submit: el botón "Registrar" solo dispara el submit del form con click real dentro del form (Playwright: dispatch `submit` o click real).

### 6. DEVOLUCIÓN + AUDITORÍA — PASS
- **Dev #1 (id=4):** tipo "Devolución con Producto Nuevo", CREYON PERM 5 x2 ($1400), foto obligatoria OK (aceptó PNG de prueba), notas "QA-DEV-1".
  - POST `/api/returns` → 200 `{id:4, status:"pending"}`.
  - **PENDIENTE verificado:** `stock_restored=0`, stock DB sigue 23, sale_id=null, dinero no sale.
- Modal cierre de sesión: sección **"Devoluciones pendientes de auditoría"** con swipe **Aprobar/Rechazar** (SwipeToConfirm, knob arrastrable ≥75% del track).
- **APROBAR:** swipe → `POST /api/returns/4/approve → 200`, `stock_restored:1` → stock DB 23→**25** (+2 unidades) ✓, salida de efectivo reflejada en el arqueo (Efectivo en Caja recalculó a -$400 con la dev pendiente de $700; la de $1400 aprobada descontó del efectivo del turno) ✓.
- **Dev #2 (id=5):** CREYON PERM 5 x1 ($700), foto, notas "QA-DEV-2 para rechazar".
  - **RECHAZAR:** swipe → `POST /api/returns/5/reject → 200` → `status=rejected, stock_restored=0`, stock DB sigue 25 (no afecta nada) ✓.
- Lista pendiente actualiza a "0 · No hay devoluciones pendientes" tras procesar.

### 7. SALARIO EN CIERRE — PASS
- Modal cierre muestra **"TU SALARIO ACUMULADO (5 SESIONES): $7010.79"** (Esta sesión $0 + anteriores $7010.79 = Total a cobrar) y "CÁLCULO ESTA SESIÓN ... × 5%".
- Checkbox de cobro: para owner no hay checkbox, hay botón **"Cobrar"** (el checkbox `requestWagePayment` es del flujo vendedor `isSeller`).
- **Cancelar:** cierra modal, `POST /api/sessions/close` **NO** se dispara, sesión #6 sigue `open` (verificado por API) ✓.

### 8. CONTROL DE EFECTIVO — FAIL ❌
- Ruta `/cash-control` (menú lateral u URL directa) → **pantalla en blanco total** (`#root` vacío).
- Error exacto: `Uncaught ReferenceError: Icon is not defined — CashControlPage.jsx (bundle lineno 899; source línea 386)`.
- Causa: la tabla "Bolsas de Moneda" renderiza `<Icon/>` pero el `.map()` de `BAG_META` no destructura `icon` y no existe un componente `Icon` importado → crash de página entera.
- Backend OK: `GET /api/cash-control` 200 con 4 bolsas (mn/transfer/usd/eur con saldo_anterior/ingresos/egresos/saldo). Solo falla el front.
- No se pudo probar conteo físico (la página no carga). Detalle en `34_cash_control_fail.md`.

### 9. UI WIFI — PASS
- Header: pill "Conectado" `bg-green-500/20 text-green-700` (verde).
- `dispatchEvent(new Event('offline'))` + navigator.onLine=false → **"Sin conexión"** (gris/rojo).
- `new Event('online')` → vuelve a verde "Conectado". Sin errores.

### 10. AVISO MEDIANOCHE — PASS (fuera de horario)
- 09:45 GMT-4: banner "00:00" no visible (esperado fuera de 23:00-00:10), hook montado sin pageerrors.
- Evidencia indirecta de funcionamiento real: la sesión #5 de anoche fue auto-cerrada con nota "[Auto-cierre medianoche]" a las 00:00 reales.

### 11. NOTIFICACIONES DEEP LINKING — PASS
- Badge "9+" → panel con 9 notificaciones (había datos).
- Click en "Sesión auto-cerrada (medianoche)" (id 42): navega `/pos` → **`/historial`** (deep link al evento) ✓ y `PUT /api/notifications/42/read → 200` (marcada leída) ✓.

### 12. REGRESIÓN F5 — PASS
- Reload en `/pos` con sesión activa: sin pantalla blanca, 0 pageerrors, POS renderiza completo.

---

## Datos de prueba creados
| Dato | ID | Estado final |
|---|---|---|
| Sesión (fondo $1000) | **6** | **ABIERTA** (se deja así) |
| Gasto mixto $250 (100/150) | 5 | **ELIMINADO** (DELETE /api/expenses/5 → 200) |
| Devolución "producto nuevo" x2 $1400 | 4 | approved (procesada — parte del flujo) |
| Devolución "producto nuevo" x1 $700 | 5 | rejected (procesada — parte del flujo) |
| Notificación leída | 42 | leída |
| Fotos evidencia | qa/evidence_qa1.png, qa/evidence_qa2.png | subidas a /uploads/returns/ |

## Limpieza
- Gasto mixto id 5 eliminado vía API.
- Devoluciones: ya procesadas (aprobada/rechazada), no corresponde borrarlas.
- Stock producto 151 (mch1): quedó en **25** (23 original + 2 por la devolución aprobada). El "eliminar venta restaura stock" no aplica: no se crearon ventas de prueba en esta sesión.
- Sesión owner #6: **ABIERTA** (pedido del dueño).

## Errores de consola encontrados
1. `Icon is not defined` (CashControlPage.jsx) — FATAL, pantalla blanca en Control de Efectivo. **Único bug real encontrado.**

## Bugs/observaciones menores
- `handleTypeChange` del gasto resetea el método de pago al cambiar tipo después de elegir Mixto (UX mejorable, no rompe).
- El crash de CashControlPage fue documentado sin modificar código (solo diagnóstico).
