# ESC-09 — Indicador WiFi / conexión (header) — PASS

**Fecha:** 2026-09-09 ~13:44 | **Página:** POS (http://localhost:5173/pos)

## Estados verificados

| Estado | Etiqueta | Clases del pill |
|---|---|---|
| Online | "Conectado" | `border bg-green-500/20 text-green-700` → **verde** |
| Offline (dispatch `window.dispatchEvent(new Event('offline'))` + navigator.onLine=false) | "Sin conexión" | cambia a estado desconectado → **gris/rojo** |
| Online de nuevo (`new Event('online')`) | "Conectado" | `bg-green-500/20 text-green-700` → **verde** |

## Detalle técnico

- Pill en header: `flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-green-500/20 text-green-700`
- El listener reacciona al evento `offline`/`online` de window (probado con page.evaluate)
- Sin errores de consola durante la transición

## Evidencia

- `qa/35_wifi_online.png` — pill verde "Conectado"
- `qa/36_wifi_offline.png` — pill offline "Sin conexión"
- `qa/37_wifi_back_online.png` — vuelve a verde
- `qa/35_wifi_states.txt` — estados DOM capturados
