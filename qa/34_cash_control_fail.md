# ESC-08 — Control de Efectivo — **FAIL** (crash total de la página)

**Fecha:** 2026-09-09 ~13:42 | **App:** http://localhost:5173 (Vite) | **Ruta:** `/cash-control` (también vía menú lateral "Control de Efectivo")

## Resultado: FAIL — pantalla en blanco (root vacío, 0 nodos)

El crash es **fatal y de página completa**: `#root` queda con 0 bytes de HTML y `document.body.innerText` vacío.

## Error exacto

```
PAGEERROR: Uncaught ReferenceError: Icon is not defined
  {filename: http://localhost:5173/src/pages/CashControlPage.jsx, lineno: 899, colno: 36}
  at react-dom_client.js
```

## Causa raíz (solo diagnóstico, NO se modificó código)

`client/src/pages/CashControlPage.jsx`, línea 386 (equivale al lineno 899 del bundle Vite):
la tabla "Control Definitivo · Bolsas de Moneda" renderiza `<Icon className="w-4 h-4" /> {label}`.
`BAG_META` (línea 301) define `icon: Wallet / Coins / CircleDollarSign / Landmark` para las 4 bolsas
(MN, USD, EUR, Transferencias), pero el destructuring del `.map()` es:

```jsx
{BAG_META.map(({ key, label, symbol, color, header }) => { ... <Icon .../> ... })}
```

Falta `icon` en el destructuring y no existe ningún componente `Icon` importado con ese nombre →
ReferenceError en el primer render de la tabla → la página entera muere.

## Lo que NO se pudo verificar por el crash

- 4 bolsas MN / USD / EUR / Transferencias (existen en código, líneas 302-305, pero no renderizan)
- Columnas saldo_anterior / ingresos / egresos / saldo (estructura presente en código, no renderiza)
- Fila efectivo real vs diferencia
- Input de conteo físico (no probable: la página no carga)

## Evidencia

- `qa/34_cash_control.png` — screenshot pantalla en blanco
- API backend OK (no es problema de servidor): `GET /api/cash-control` devuelve 200 con las 4 bolsas
  (mn saldo_anterior 43.161.180, transfer 1.500, usd 5, eur 0) — verificado con token de owner.

## Pasos para reproducir

1. Login owner (yoelbritomachado / 1234)
2. Menú lateral → "Control de Efectivo" (o ir a `/cash-control`)
3. Pantalla en blanco + error en consola
