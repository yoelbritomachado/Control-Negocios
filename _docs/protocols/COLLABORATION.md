# 🤝 PROTOCOLO_DE_COLABORACION.md

> **Guía de coordinación entre Antigravity (Usuario/Desarrollador Principal) y Kimi Claw (Agente Remoto)**
> 
> **Versión:** 1.0
> **Fecha:** 2026-02-17
> **Estado:** Activo

---

## 👥 Roles Definidos

| Rol | Nombre | Responsabilidad |
|-----|--------|-----------------|
| **Desarrollador Principal** | Antigravity / Yoel Brito | Toma de decisiones arquitectónicas, desarrollo principal, revisión final |
| **Agente Remoto** | Kimi Claw | Soporte de desarrollo, documentación, tareas específicas, mantenimiento |

---

## 🔄 Flujo de Trabajo Git (OBLIGATORIO)

### Para Antigravity (antes de empezar a trabajar):

```bash
# SIEMPRE ejecutar esto antes de hacer cambios
git pull origin main

# Si hay conflictos, resolver antes de continuar
```

### Para Antigravity (después de terminar):

```bash
# Agregar cambios
git add .

# Commit con mensaje descriptivo
git commit -m "tipo: descripción del cambio"

# Subir al repositorio
git push origin main
```

### Convención de Commits:

| Tipo | Uso | Ejemplo |
|------|-----|---------|
| `feat:` | Nueva funcionalidad | `feat: agregar módulo de reportes` |
| `fix:` | Corrección de bug | `fix: corregir cálculo de totales` |
| `docs:` | Documentación | `docs: actualizar README` |
| `style:` | Cambios de estilo (CSS) | `style: mejorar responsive del POS` |
| `refactor:` | Refactorización | `refactor: simplificar lógica de carrito` |
| `chore:` | Tareas de mantenimiento | `chore: actualizar dependencias` |

---

## 📝 Registro de Cambios (IMPORTANTE)

### Formato para notificar cambios:

Cuando Antigravity haga cambios, debe actualizar esta sección:

```markdown
## Registro de Cambios Recientes

### 2026-02-17 - Antigravity
- **Archivos modificados:** `src/pages/POSPage.jsx`, `src/components/Cart.jsx`
- **Tipo:** `feat`
- **Descripción:** Agregada funcionalidad de descuentos por volumen
- **Breaking Changes:** Ninguno
- **Requiere revisión de Kimi:** No

### 2026-02-17 - Kimi Claw
- **Archivos modificados:** `DESIGN_SYSTEM.md`, `src/pages/DashboardPage.jsx`
- **Tipo:** `docs`, `fix`
- **Descripción:** Creado sistema de diseño, eliminados títulos duplicados
- **Breaking Changes:** Ninguno
- **Requiere acción de Antigravity:** Ejecutar `git pull`
```

---

## 🚫 Zonas Protegidas

### NO MODIFICAR sin consultar al otro:

| Archivo/Área | Responsable | Razón |
|--------------|-------------|-------|
| `MEMORIA_PROYECTO.md` | Ambos (append-only) | Memoria compartida del proyecto |
| `CLAW_PROJECT_MANIFEST.md` | Kimi Claw | Manifiesto técnico del agente |
| `DESIGN_SYSTEM.md` | Kimi Claw | Documentación de diseño |
| `server/inventory.db` | Antigravity | Base de datos de producción |
| `src/components/Header.jsx` | Coordinado | Afecta a todas las páginas |
| `src/components/MainLayout.jsx` | Coordinado | Estructura base de la app |

### Libre para modificar (con git sync):

- `src/pages/*` (páginas individuales)
- `src/components/*` (componentes específicos)
- `src/api.js` (endpoints de API)
- Archivos de estilo específicos

---

## 🔄 Protocolo de Sincronización

### Escenario 1: Antigravity quiere hacer cambios

1. **Antes de empezar:**
   ```bash
   git pull origin main
   ```

2. **Revisar este archivo:** Verificar si Kimi dejó alguna nota en "Registro de Cambios"

3. **Después de terminar:**
   ```bash
   git add .
   git commit -m "tipo: descripción"
   git push origin main
   ```

4. **Notificar a Kimi:** (si es necesario) mencionar en conversación

### Escenario 2: Kimi hace cambios

1. **Kimi ejecuta:**
   ```bash
   git add .
   git commit -m "tipo: descripción"
   git push origin main
   ```

2. **Kimi notifica a Antigravity:** Mensaje explícito con cambios realizados

3. **Antigravity debe:**
   ```bash
   git pull origin main
   ```

---

## 🚨 Resolución de Conflictos

### Si `git pull` muestra conflictos:

1. **NO hacer `git push` forzado** (`git push --force` está prohibido)

2. **Opción A - Mantener cambios locales (Antigravity):**
   ```bash
   git stash                    # Guardar cambios locales
   git pull origin main         # Obtener cambios de Kimi
   git stash pop                # Re-aplicar cambios locales
   # Resolver conflictos manualmente si los hay
   git add .
   git commit -m "merge: resolver conflictos con cambios de Kimi"
   git push origin main
   ```

3. **Opción B - Descartar cambios locales (si son irrelevantes):**
   ```bash
   git checkout -- .            # Descartar cambios locales
   git pull origin main         # Obtener versión limpia
   ```

4. **Después de resolver:** Notificar al otro para confirmar sincronización

---

## 📋 Checklist Pre-Cambios

### Antes de hacer cualquier modificación importante:

- [ ] Ejecuté `git pull origin main`
- [ ] Revisé el "Registro de Cambios Recientes" en este archivo
- [ ] Verifiqué que no estoy modificando una "Zona Protegida" sin consultar
- [ ] Mi cambio no rompe la estructura definida en `DESIGN_SYSTEM.md`
- [ ] Haré `git push` después de terminar
- [ ] Notificaré al otro si el cambio es significativo

---

## 💬 Comunicación

### Canales:

1. **Git (Principal):** Los commits y mensajes de commit son la fuente de verdad
2. **Mensajes directos:** Para coordinación rápida o dudas
3. **Este archivo:** Para dejar notas persistentes sobre cambios importantes

### Cuándo notificar al otro:

| Situación | Notificar |
|-----------|-----------|
| Cambio en Zona Protegida | ✅ Sí, obligatorio |
| Nuevo componente reutilizable | ✅ Sí, para agregar a DESIGN_SYSTEM |
| Fix de bug crítico | ✅ Sí |
| Cambio de estilo menor | ❌ No, solo commit |
| Documentación | ❌ No, solo commit |
| Refactorización interna | ⚠️ Solo si afecta API |

---

## 🤖 Validación Automática (GitHub Actions)

El repositorio tiene configurado un **workflow de validación automática** que se ejecuta en cada push/PR:

### Qué valida:
1. **Sintaxis JS** - Detecta errores de parseo
2. **Shadowing** - Variables que ocultan globales (`posCart`, `db`, `currentUser`)
3. **Funciones duplicadas** - Código zombie que puede causar bugs
4. **Referencias globales** - Funciones usadas en `onclick` deben estar expuestas en `window`
5. **Archivos críticos** - Que existan `MEMORIA_PROYECTO.md`, etc.

### Cómo ver resultados:
- Ve a la pestaña **Actions** en GitHub
- Revisa el estado de la última ejecución
- Si hay errores (❌), el PR no debería mergearse hasta corregirlos

### Si falla la validación:
```bash
# 1. Revisa los logs en GitHub Actions
# 2. Corrige los errores localmente
# 3. Commit y push de nuevo
git add .
git commit -m "fix: corrige shadowing y funciones duplicadas"
git push origin main
```

---

## 📚 Recursos de Referencia

| Recurso | Ubicación | Propósito |
|---------|-----------|-----------|
| `MEMORIA_PROYECTO.md` | Raíz | Reglas de negocio, leyes del sistema |
| `CLAW_PROJECT_MANIFEST.md` | Raíz | Manifiesto técnico para Kimi |
| `DESIGN_SYSTEM.md` | Raíz | Guía de diseño y componentes |
| `PROTOCOLO_DE_COLABORACION.md` | Raíz | Este archivo - coordinación |

---

## ✅ Checklist Pre-Commit (OBLIGATORIO)

> **Antes de hacer `git commit`, verifica estos puntos para evitar errores comunes:**

### Validación de Código JS/React
- [ ] **No hay variables duplicadas** (shadowing): Buscar `let posCart`, `let db`, `let currentUser` - deben usar `window.`
- [ ] **No hay funciones zombie**: Al refactorizar, buscar y eliminar la definición antigua de la función
- [ ] **Funciones expuestas globalmente**: Las funciones usadas en `onclick` deben tener `window.nombreFuncion = nombreFuncion`
- [ ] **Referencias a window**: Variables globales deben usarse como `window.variable`, no directamente
- [ ] **Keys únicas en listas React**: Al usar `.map()`, cada elemento debe tener `key={item.id}` único
- [ ] **No usar índice como key**: Evita `key={index}` a menos que sea estrictamente necesario

### Validación de Estructura
- [ ] **Orden de scripts**: `data.js` debe cargar antes que `app.js` / `pos.js`
- [ ] **No hay funciones duplicadas**: Buscar `function nombreFuncion` dos veces en el mismo archivo
- [ ] **Leyes de Negocio respetadas**: Cambios en ventas/inventario deben respetar `SYSTEM_LOGIC_RULES.md`

### Validación de Git
- [ ] **Hice `git pull origin main` antes de empezar**
- [ ] **No modifico Zonas Protegidas** sin consultar al otro
- [ ] **Mensaje de commit descriptivo** siguiendo la convención (`feat:`, `fix:`, etc.)

### Errores Comunes a Evitar (Ver Registro)
| Error | Causa | Solución |
|-------|-------|----------|
| `X is not defined` | Shadowing o falta `window.` | Usar `window.X` |
| `function already declared` | Código zombie no eliminado | Borrar definición antigua |
| Función no responde | No expuesta globalmente | Agregar `window.func = func` |
| Pantalla blanca/negra | Orden de carga incorrecto | Verificar `<script>` en HTML |
| `two children with the same key` | Keys duplicadas/undefined en listas React | Usar: `key={item?.id \|\| item?.code \|\| `unique-${index}`}` |
| `Each child in a list should have unique key` | Falta prop `key` en map() | Agregar `key` con fallback seguro |

#### 🚨 Patrón OBLIGATORIO para Keys en React
Siempre usar **optional chaining + fallback** para evitar keys undefined:

```jsx
// ❌ PROHIBIDO - Key puede ser undefined
{items.map(item => <div key={item.id}>...</div>)}

// ❌ PROHIBIDO - Usar índice solo (causa bugs al reordenar)
{items.map((item, i) => <div key={i}>...</div>)}

// ✅ CORRECTO - Con fallback seguro
{items.map((item, index) => (
  <div key={item?.id || item?.code || `unique-${index}`}>...</div>
))}
```

**Regla**: Si el objeto viene de una API, SIEMPRE asume que el ID puede ser null/undefined.

---

## ✅ Estado de Sincronización Actual

**Última sincronización:** 2026-02-17 14:22 GMT+8

**Cambios pendientes de revisión:**
- ✅ Kimi: Creado `DESIGN_SYSTEM.md` con sistema de diseño completo
- ✅ Kimi: Eliminados títulos duplicados en páginas
- ✅ Kimi: Creado `PROTOCOLO_DE_COLABORACION.md` (este archivo)

**Próxima acción requerida:**
- 🔄 Antigravity: Ejecutar `git pull` para obtener todos los cambios

---

## 🎯 Principios Fundamentales

1. **Git es la fuente de verdad:** Si no está en Git, no existe.

2. **Comunicación proactiva:** Mejor preguntar antes que romper algo.

3. **Documentación viva:** Actualizar los archivos `.md` cuando cambien las cosas.

4. **Respeto de roles:** Antigravity tiene la última palabra en decisiones arquitectónicas.

5. **Sin sorpresas:** Notificar antes de cambios grandes, no después.

---

**Documento mantenido por:** Kimi Claw y Antigravity
**Revisión periódica:** Semanal o cuando cambien los flujos de trabajo
