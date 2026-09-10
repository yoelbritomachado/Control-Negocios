# ESPEC: Selector de Empresas + Inventario linkeado a Empresa (Yoe, 10-sep v2)

> Actualiza docs/FASE_RESET_MULTIEMPRESA.md §3. Trabajo en la DB ACTUAL (ya reseteada, 0
> inventarios). Estado: APROBADO por Yoe. NO eliminar empresas desde UI de selector.

## 1. Post-reset LIMPIO (bug corregido)

Tras Reset de Fábrica, el selector "Inventario activo" debe desplegar SOLO la opción de crear
inventario nuevo ("+ Nuevo inventario"). NADA más: ni MCH1/MCH2/Almacén (cache offline de la UI
debe limpiarse con el logout que ya hace el reset), ni sedes re-sembradas por migraciones
(server: flag `seed_mr_inventories_done` en settings — el reset no toca settings, así que la
migración Fase A no vuelve a correr).

## 2. Selector de EMPRESA (arriba de "Inventario activo")

En el Sidebar, ENCIMA del selector "Inventario activo", un segundo selector:
- Label: "Empresa". Muestra la empresa activa.
- Si hay empresas, lista + botón "+ Crear empresa" al final.
- Si no hay ninguna (post-reset), SOLO botón "+ Crear empresa" (con label descriptivo).

## 3. Empresas — reglas

- **NO existe eliminar empresa en este selector** (Yoe lo hará vía "Limpieza / Reset selectivo"
  en Configuración, más adelante). Cero botones de eliminar aquí.
- Editar: cambiar nombre y logo de la empresa (UI simple: nombre + logo → guardar).
- La empresa por defecto del sistema es **Miss Chulerías**. Como la DB está recién reseteada
  (0 inventarios, 1 usuario dueño), crearla como única empresa inicial con sus settings.
- Futuro: borrar una empresa = borrar su árbol completo (almacén + POS + vendedores) — se
  implementará como "Reset selectivo" en Configuración. NO ahora.

## 4. Inventario linkeado a empresa (obligatorio)

- inventories.company_id (FK → companies.id). Un inventario SIN empresa no aparece en el
  selector (regla de negocio del árbol).
- Al crear inventario (botón "+" actual): se crea linkeado a la empresa ACTIVA del selector.
- Al cambiar de empresa en el selector: refrescar lista de inventarios (solo los de esa
  empresa) y limpiar el inventario activo si no pertenecía a la nueva empresa.

## 5. Nexus Node (aprovechar el árbol)

- La vista Nexus ya es un árbol de nodos. El selector de empresa del sidebar es el punto de
  entrada; crear/editar inventarios puede hacerse también desde el árbol Nexus (nodo empresa →
  nodos inventario).
- Mínimo viable ahora: el selector de empresa en sidebar + linkeo de inventarios. La gestión
  desde el árbol Nexus queda como mejora siguiente (TODO en código).

## 6. Bug visual conocido (arreglar en este pase)

- El botón de colapsar del sidebar (flechita): al colapsar queda en modo icono y al pulsarlo
  de nuevo NO vuelve al modo con texto. Debe alternar icono ↔ icono+texto correctamente.