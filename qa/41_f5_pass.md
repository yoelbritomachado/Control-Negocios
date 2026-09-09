# ESC-12 — Regresión F5 en POS — PASS

**Fecha:** 2026-09-09 ~13:49

## Resultado

- `page.reload()` (F5) en `/pos` con sesión activa:
  - **Sin pantalla blanca** (DOM renderiza completo: "Punto de Venta", "TOTAL", carrito, sidebar)
  - **Sin errores fatales de consola** (0 pageerror)
  - La sesión #6 sigue abierta tras el reload (estado restaurado desde backend)

## Evidencia

- `qa/41_f5_regression.png` — POS renderizado tras F5
- `qa/41_f5_regression.txt` — resultados del chequeo
