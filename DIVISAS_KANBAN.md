# DIVISAS_KANBAN.md — Kanban de Trabajo Paralelo (CRM Michulerías D:\mch_crm_full)

## ⚠️ REGLA DE ORO: SIN PISARSE
Cada agente trabaja SOLO en sus archivos exclusivos. Prohibido tocar archivos de otros.
- Agente A: SOLO `server/index.js` (secciones Returns + Notifications + currency_purchases)
- Agente B: SOLO `client/src/components/CurrencyPurchaseModal.jsx` (archivo NUEVO, nadie más lo toca)
- Agente C: SOLO `client/src/components/POSLayout.jsx` (importa el modal de B, espera a que B termine)
- Agente D: NO toca código; documenta en este archivo la nota para integrar (pendiente futura)
- Agente E: NO toca código; documenta en este archivo la nota para integrar (pendiente futura)
- Agente F (Yo/MichuSourcing): build final + reinicio + verificación, SOLO DESPUÉS de A, B y C.

## Contratos de interfaz (para que encajen sin verse)
### Backend (Agente A entrega):
- `GET /api/sessions/available-cash` → `{ success, available, breakdown: { initial_cash, cash_sales, cash_expenses, cash_returns, currency_purchases } }` (YA EXISTE, A solo corrige: columna is_read en notifications, columna payment_method en returns, y que /api/returns registre payment_method del body y descunte del efectivo)
- `POST /api/currency-purchase` → body `{ amount_divisas, cost_per_divisa, currency, payment_method }` → `{ success, id, total_mn, available_after }` (YA EXISTE; A corrige is_read → usar columna `is_read` NO `read`; validar que returns tenga payment_method para el cálculo)
- Settings de tasas: `RATE_USD_MN` (default 550), `RATE_EUR_MN` (590), `RATE_MXN_MN` (17.3) — via `GET /api/settings`

### Frontend (Agente B entrega):
- Export default `CurrencyPurchaseModal({ open, onClose, onSaved })`
- Al abrir: `api.get('/sessions/available-cash')` para mostrar disponible y `api.get('/settings')` para tasa default según divisa elegida
- Campos: divisa (USD/EUR/MXN), cantidad, costo por divisa (editable, default de settings), total calculado automático
- Validación client-side: total ≤ disponible (además de la del server)
- Botón guardar: `api.post('/currency-purchase', { amount_divisas, cost_per_divisa, currency, payment_method: 'cash' })`, feedback y `onSaved()`

### Integración (Agente C entrega):
- En POSLayout.jsx: import CurrencyPurchaseModal, estado `showCurrency`, botón "Divisas" en Quick Actions (grid 3→4 cols o fila extra), render del modal con `onSaved={() => { refresh disponible; cerrar }}`
- En pestaña/sección Devolución del POS: mostrar aviso "La devolución descuenta del efectivo del turno" (solo texto/UI, la lógica ya es backend)

## TAREAS
### [KANB-A] Backend — CORRECCIONES (in_progress) → Agente A
1. En `/api/currency-purchase` y todo index.js: INSERT de notifications usa columna `read` — CORREGIR a `is_read` (la tabla real tiene `is_read`).
2. Migración: `ALTER TABLE returns ADD COLUMN payment_method TEXT DEFAULT 'cash'` (con chequeo de columnas como las migraciones existentes, ej. patrón exchange_rate línea ~3143).
3. Endpoint `/api/returns`: aceptar `payment_method` del body y guardarlo.
4. En `available-cash` y cierre de sesión: devoluciones en efectivo ya se restan (verificar consistencia `amount_returned` con payment_method='cash').
5. NO tocar nada más. NO hacer build (lo hace F).

### [KANB-B] Frontend — Modal Divisas NUEVO (in_progress) → Agente B
1. Crear `client/src/components/CurrencyPurchaseModal.jsx` según contrato.
2. Estilo consistente: glass-card, motion, lucide-react (DollarSign/Coins), colores cyan/blue del proyecto.
3. NO tocar ningún otro archivo. Probar sintaxis con `npx eslint` solo si existe config, si no dejar listo.

### [KANB-C] Frontend — Integración POS (in_progress) → Agente C
1. Esperar señal de que B terminó (revisar que exista CurrencyPurchaseModal.jsx con export default).
2. POSLayout.jsx: import + estado + botón en Quick Actions + render modal + refrescar fondo tras guardar.
3. Texto en Devolución: "Descuenta del efectivo del turno".
4. NO tocar backend ni PaymentModal.

### [KANB-D] Notificación pendientes de revisión (pending) → Agente D (solo documentar)
- Nota para integrar después: al abrir sesión como admin, banner "Tienes N sesiones pendientes de revisión" consultando `GET /api/sessions/pending-review` (verificar si existe; si no, es tarea futura). NO escribir código ahora; dejar especificación aquí abajo.
- Especificación: endpoint sugerido `GET /api/sessions/pending-count` → `{ count }`; UI: badge en header admin.

### [KANB-E] Salario por período sugerido (pending) → Agente E (solo documentar)
- Especificación para backlog: vendedor al cerrar sesión puede sugerir "págame del período 25/7 al 28/7"; guardar en tabla nueva `wage_requests (id, seller_id, period_start, period_end, amount, status, created_at)`; admin ve lista y aprueba/rechaza. NO escribir código ahora.

### [KANB-F] Integración final (pending) → F (yo)
1. Tras A+B+C: `cd client && npm run build` (debe salir exit 0).
2. Reiniciar server (script C:\LumenRouter\scratch\restart_mch_server.ps1) y verificar /api/health 200.
3. Probar `POST /api/currency-purchase` y `GET /api/sessions/available-cash` con curl.
4. Marcar todos completed y guardar resumen en memoria.

## ESTADO
- KANB-A: [x] done | is_read corregido, payment_method migrado, endpoints verificados
- KANB-B: [x] done | CurrencyPurchaseModal.jsx creado (13 KB), eslint 0 errores
- KANB-C: [x] done | POSLayout integrado: import, showCurrency, botón Divisas, texto devolución
- KANB-D: [x] especificado (backlog, sin código)
- KANB-E: [x] especificado (backlog, sin código)
- KANB-F: [x] done | build ✓ (10.2s), server reiniciado ✓ (health 200), tablas migradas ✓ (currency_purchases + returns.payment_method)

## FIX POST-DEPLOY (17:08)
- BUG: available-cash devolvía 0 porque NO sumaba cash_injections (inyecciones de fondo del admin, $6000 en sesión 2).
- Corregido en: GET /api/sessions/available-cash, POST /api/currency-purchase y cierre de sesión.
- Regla de negocio (Yoe): Disponible = fondo inicial + inyecciones + ventas efectivo - gastos - devoluciones - compras divisas.
- finalCash del cierre también resta currency_purchases.
- RATE_USD_MN real en settings = 750 (no el default 550).
- Build ✓ 12s, health 200, disponible simulado = 8400 correcto.
