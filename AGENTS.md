# 🤖 AGENTS.md - Miss Chulerías Business Control System

> **📍 ATENCIÓN AGENTE:**
> Este archivo es un **RESUMEN RÁPIDO**. La documentación completa está en `/_docs/AGENTS.md`.

---

## 🚀 INICIO RÁPIDO (30 segundos)

### 1. Leer PRIMERO (Obligatorio)
```
_docs/memory/CURRENT_STATE.md   ← Estado actual del proyecto
```

### 2. Entender la Estructura
```
_docs/
├── README.md              ← Mapa de toda la documentación
├── AGENTS.md              ← REGLAS COMPLETAS (lea esto)
├── memory/
│   ├── CURRENT_STATE.md   ← Estado actual (LEER PRIMERO)
│   ├── history/           ← Historial por meses
│   └── modules/           ← Detalles por módulo
├── architecture/          ← Diseño técnico
└── protocols/             ← Protocolos de trabajo
```

### 3. Reglas de Oro
| ❌ NUNCA | ✅ SIEMPRE |
|---------|-----------|
| Crear archivos `.md` en la raíz | Usar `_docs/` para documentación |
| Borrar archivos de `history/` | Mantener histórico intacto |
| Ignorar `CURRENT_STATE.md` | Leerlo PRIMERO siempre |
| Commit sin mensaje claro | Mensajes descriptivos |

---

## 🔄 Flujo de Trabajo

### Al Iniciar
```bash
git pull
# Leer _docs/memory/CURRENT_STATE.md
# Identificar tarea
```

### Durante
```bash
# Hacer cambios
# Probar localmente
```

### Al Finalizar
```bash
# Actualizar _docs/memory/CURRENT_STATE.md
git add .
git commit -m "Tipo: Descripción clara"
git push
```

---

## 🏗️ Estructura del Proyecto

```
client/          ← Frontend React (Vite) → localhost:5173
server/          ← Backend Node.js → localhost:3001 (API-only en dev)
_docs/           ← DOCUMENTACIÓN (aquí)
backups/         ← Respaldos DB
registro-screenshots/  ← Capturas de pantalla
```

**IMPORTANTE:** En desarrollo local, backend y frontend son servidores SEPARADOS.

---

## 🧠 Lógica de Negocio Clave

### Roles
- `owner` - Acceso total
- `admin` - Gestión y reportes
- `seller` - Solo POS

### Cálculo de Salario
```
Salario = 5% de (Ventas Totales - Costos Totales)
```

### Estados de Sesión
```
[ABIERTA] → [PENDIENTE REVISIÓN] → [CERRADA]
   ↑ Vendedor                    ↑ Admin/Dueño
```

---

## 📚 Documentación Completa

| Archivo | Contenido | Prioridad |
|---------|-----------|-----------|
| `/_docs/AGENTS.md` | **REGLAS UNIVERSALES** | ⭐⭐⭐ MÁXIMA |
| `/_docs/README.md` | Guía de navegación | ⭐⭐⭐ Alta |
| `/_docs/memory/CURRENT_STATE.md` | Estado actual | ⭐⭐⭐ PRIMERA |
| `/_docs/memory/modules/POS.md` | Módulo POS | Según tarea |
| `/_docs/architecture/DESIGN_SYSTEM.md` | UI/UX | Para diseño |

---

## 🆘 Ayuda

- **Documentación completa:** `/_docs/AGENTS.md`
- **Estado del sistema:** `/_docs/memory/CURRENT_STATE.md`
- **Contexto histórico:** `/_docs/memory/history/`

---

**Para humanos:** Ver `README.md` (en raíz) para información general del proyecto.

---

*Documentación mantenida por todos los agentes del proyecto.*  
*Última actualización: 2026-02-20*
