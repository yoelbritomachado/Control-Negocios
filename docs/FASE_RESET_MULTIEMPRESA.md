# ESPEC: Reset de Fábrica REAL + Multi-Empresa (spec de Yoe, 10-sep)

> Dictado por Yoe tras revisar la app. Estado: ESPEC APROBADA — pendiente decisión de alcance
> (multi-empresa ahora vs después) antes de implementar. Pendiente explícito: seguridad del
> primer login (ver §5).

## 1. Reset Total de Fábrica (el botón actual NO hace esto)

El botón de "Reset de fábrica" en Configuración debe resetear la aplicación COMPLETA:

**SÍ se borra:**
- Inventarios: TODOS (almacén, puntos de venta, nombres incluidos — "no existen nombres de
  almacenes ni Michulerías, nada"). Quedan en cero.
- Historia de ventas, gastos, devoluciones, compras, traslados, mermas
- Divisas, entregas de efectivo, ingresos externos, conteos físicos, salario admin
- Salarios/pagos, notificaciones, cambios de precio
- Usuarios: TODOS menos el dueño (yoelbritomachado)

**NO se borra:**
- **Backups** (sección "Backup disponible" queda intacta — son la red de seguridad)
- El usuario DUEÑO (yoelbritomachado queda logueado/autorizado)
- Configuración del sistema (settings/tasas)

**Flujo del reset (obligatorio):**
1. Diálogo: "¿Querés hacer un backup? El último backup es del <FECHA>" con Sí/No.
2. Si SÍ → backup COMPLETO (ventas, usuarios, fotos de productos, todo) y luego reset.
   Si NO → reset directo (con advertencia de que no habrá vuelta atrás).
3. Al resetear: cerrar sesiones activas, dejar solo al dueño, e ir a pantalla limpia.
4. Después del reset: pestaña Inventario muestra TODO en cero → botón "Nuevo producto" para
   empezar de cero; "Inventario activo" sin ninguna sede.

## 2. Crear inventario nuevo (botón "+" en el selector)

Donde dice "Inventario activo" (despliega MCH1, MCH2, Almacén) → agregar un **"+"** al final:

- Formulario: **nombre** + **tipo**: `Punto de Venta` (kiosk) o `Almacén` (warehouse)
- Los puntos de venta se nutren del almacén (traslados); el almacén no vende (ya es el modelo actual)
- El inventario se crea dentro de la **empresa por defecto** (Miss Chulerías)
- Al crearlo queda seleccionado como activo y se puede empezar a cargar productos

## 3. Multi-Empresa (futuro cercano, diseño importante)

- Cada EMPRESA tiene: sus inventarios (almacén + puntos de venta), sus usuarios/trabajadores,
  sus estadísticas, su Control de Efectivo, su Nexus Node.
- Botón "Cambiar de empresa" en el menú lateral: al cambiar, TODO lo que se ve corresponde a
  la otra empresa.
- **DECISIÓN DE YOE (vigente): por ahora MCH y M&R se mantienen JUNTAS** — el mismo vendedor
  vende productos de ambas en la misma venta, comparten flujo. Solo las CUENTAS van separadas
  (inventario por negocio, Control de Efectivo por negocio, salario por negocio) — exactamente
  como el Excel. Esto ya está implementado en Fase A/B (columna `business`).
- Lo nuevo sería la entidad EMPRESA para negocios futuros: mismo modelo (almacén + POS que se
  nutren de él), con switch limpio entre empresas.
- Nexus Node: funciona igual dentro de cada empresa (nodos por empresa).

## 4. Relación con el modelo Excel (recordatorio)

Mezcla del Excel + app "Mi Negocio": el Excel lleva cuentas SEPARADAS por negocio (Control de
Efectivo MCH y M&R, salarios por negocio) pero operación compartida (el mismo vendedor le vende
a ambas). Eso es exactamente el modelo `business` que ya implementamos. La entidad EMPRESA es
el paso siguiente cuando haya un negocio totalmente aparte.

## 5. PENDIENTE (explícito de Yoe): seguridad del primer login

"Lo que me preocupa es que va a entrar alguien desde fuera" — el flujo de reset deja solo al
dueño autorizado. Cómo manejar el acceso cuando NO esté logueado el dueño (crear usuario y
contraseña por primera vez sin que cualquiera pueda) queda **EN ANÁLISIS**. No implementar
apertura de registro público. Solución actual: siempre queda el dueño autorizado.
