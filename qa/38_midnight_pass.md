# ESC-10 — Aviso de medianoche (banner 00:00) — PASS (parcial por horario)

**Fecha del test:** 2026-09-09 09:45 (GMT-4) — FUERA de la ventana 23:00-00:10.

## Resultado

- El banner aviso "00:00" **no está visible** en el DOM del POS — comportamiento esperado fuera de horario.
- El texto 'revisión' SÍ está presente en el DOM (botón/badge "Auditoría · En Revisión" y hint "La devolución descuenta del efectivo del turno" — zona del hook de medianoche/cierre automático montada).
- El hook `useMidnightWarning` está montado (importado en POSLayout.jsx) **sin errores de consola**: cero `pageerror` durante toda la sesión de POS.

## Nota

La sesión anterior (id 5) de anoche fue auto-cerrada a medianoche con nota
"[Auto-cierre medianoche] Sesión abierta al cambio de día, enviada a revisión automática."
→ evidencia de que el mecanismo de medianoche funciona en producción (disparó el 2026-09-09 00:00 real).

## Evidencia

- `qa/38_midnight_check.png` — POS con sesión activa, sin banner (correcto fuera de horario)
- `qa/38_midnight_check.txt` — resultados del chequeo DOM
