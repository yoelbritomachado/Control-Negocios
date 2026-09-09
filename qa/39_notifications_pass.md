# ESC-11 — Notificaciones con deep linking (UI-02) — PASS

**Fecha:** 2026-09-09 ~13:47 | **Página:** POS

## Flujo verificado

1. Badge "9+" en header → click abre panel **Notificaciones** con lista (con botón "Marcar todo").
2. Notificaciones presentes (había datos):
   - "Sesión auto-cerrada (medianoche)" — sesión #5, $2200.00
   - "Sesión aprobada" — sesión #3, hace 15h
   - más históricas de sesiones #2/#3
3. Click en "Sesión auto-cerrada (medianoche)" (id **42**):
   - **Navega** de `/pos` → `/historial` (deep link al evento) ✓
   - **Marca como leída**: `PUT /api/notifications/42/read → 200 {"success":true}` ✓
4. Sin errores de consola.

## API observada

```
GET  /api/notifications → 200 (lista con type session_pending)
PUT  /api/notifications/42/read → 200 {"success":true}
```

## Evidencia

- `qa/39_notifications_panel.png` — panel abierto con lista
- `qa/40_notification_deeplink.png` — navegación a /historial tras el click
- `qa/40_notification_deeplink.txt` — URLs antes/después
