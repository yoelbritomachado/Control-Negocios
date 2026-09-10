# ESPEC: Árbol de habilitación post-reset (Yoe, 10-sep v3)

> Modelo de dependencias dictado por Yoe tras resetear de nuevo. Estado: APROBADO — implementar.
> DB actual: 0 empresas, 0 inventarios, 1 usuario (dueño). Server ya ajustado: sin seed de
> empresa default; inventario sin company_id es válido ("suelto").

## 1. Modelo de dependencias (reglas de Yoe)

- **Empresa**: opcional. Un inventario puede existir sin empresa (suelto). Si pertenece a una,
  responde a ella; si no, no.
- **Inventario activo**: requiere al menos UN inventario creado y SELECCIONADO. Sin inventario
  creado, no hay inventario activo posible.
- **Productos**: se cargan a un inventario creado y seleccionado. Sin inventario activo →
  bloqueado (no hay dónde cargarlos).
- **Traslados**: requieren ≥2 inventarios creados (cualquier combinación: 2 kioscos, 2 almacenes,
  kiosco+almacén). Con 1 solo inventario: deshabilitado.
- **Usuarios**: INDEPENDIENTE de inventarios/empresas. El menú de usuarios y sus funciones
  siempre habilitados (crear usuarios, roles, etc.).
- **Historiales**: siempre VISIBLES pero naturalmente VACÍOS post-reset (ventas 0, traslados 0,
  mermas 0). No se deshabilitan — muestran vacío. (Comportamiento actual correcto, mantener.)

## 2. UI post-reset limpio (0 empresas, 0 inventarios)

- Selector **Empresa**: solo muestra botón **"+ Crear empresa"** (sin lista, sin empresa activa).
- Selector **Inventario activo**: DESHABILITADO (grisado, con tooltip "Creá un inventario
  primero") — pero el botón **"+ Crear inventario"** SÍ está habilitado. Al crear el primer
  inventario, se selecciona como activo automáticamente.
- **POS / ventas**: deshabilitado sin inventario activo (no hay dónde vender ni cargar productos).
- **Productos**: deshabilitado sin inventario activo.
- **Traslados**: deshabilitado con <2 inventarios (mensaje: "Necesitás al menos 2 inventarios
  para trasladar").
- **Usuarios**: habilitado siempre.
- **Historiales**: habilitados siempre (vacíos post-reset).
- **Configuración / Reset**: siempre habilitado (por definición).

## 3. Gradualidad (se habilita al cumplirse la condición)

| Función | Condición para habilitar |
|---|---|
| Crear empresa | siempre |
| Crear inventario (+) | siempre |
| Seleccionar inventario activo | ≥1 inventario creado |
| Productos / nuevo producto | inventario activo seleccionado |
| POS / vender | inventario activo seleccionado (kiosco) |
| Traslados | ≥2 inventarios (ambos con productos en origen; el server ya valida stock) |
| Usuarios | siempre |
| Historiales | siempre (vacíos si no hay movimientos) |
| Control de efectivo | siempre (muestra ceros sin movimientos) |

## 4. Detalles

- "Crear empresa" NO deshabilita nada per se; solo habilita el filtro de empresa en inventarios.
- El inventario creado SIN empresa se muestra en el selector con badge "Sin empresa" (gris).
- Cuando existan empresas, el selector de empresa lista las existentes + "+ Crear empresa" al final.
- Al seleccionar inventario activo, sincronizar también el estado global (localStorage) y
  refrescar vistas que dependen de inventario (POS, productos, traslados).