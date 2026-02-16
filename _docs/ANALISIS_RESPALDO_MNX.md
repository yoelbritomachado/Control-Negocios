# Análisis de Respaldo Legacy (`.mnx`)

**Fecha del Análisis:** 2026-02-15
**Archivo Fuente:** `uploads/backup.mnx`
**Agente Responsable:** Antigravity

## 1. Estructura del Archivo
El archivo `.mnx` es un contenedor **ZIP** comprimido (renombrado). Al descomprimirlo, revela:
- Múltiples bases de datos **SQLite** (`.db`) con timestamps en el nombre.
- Imágenes (`.jpg`, `.png`) en una carpeta plana.
- Archivo `controller.fn8` (propósito desconocido, posiblemente binario de control).

### Archivos Clave Detectados
- **DB Principal:** `bd_1712805230389_xxmn.db` (Fecha aprox: Abril 2024, archivo más reciente y relevante).
- **Imágenes:** `img_*.jpg` (Fotos de productos).

## 2. Esquema de Base de Datos (SQLite)
La base de datos contiene la información crítica del negocio. Las tablas están desacopladas en "Definición" (`item`) e "Inventario/Precios" (`producto`).

### Tablas Principales

#### A. `item` (Catálogo de Nombres)
Contiene la definición base de los productos.
- **Columnas:** `id`, `nombre`, `clave`, `status`, `prototipo`.
- **Ejemplo:** `{"id": 1, "nombre": "SAYAS", "status": 1}`.

#### B. `producto` (Precios y Stock)
Contiene los valores financieros y cantidades. **Nota:** No tiene columna de nombre, se vincula por `id` a la tabla `item`.
- **Columnas:** `id`, `costo`, `precio`, `cantidad` (stock), `costo_promedio`, `reserva`.
- **Ejemplo:** `{"id": 1, "precio": 2500, "costo": 2448}`.

#### C. `transaccion` (Historial)
Registro de movimientos.
- **Columnas:** `id`, `fecha`, `tipo`, `info` (posible JSON), `status`.

## 3. Estrategia de Migración (Para Kimi Claw)
Para importar estos datos al nuevo sistema (`inventory.db`), se recomienda la siguiente consulta SQL (JOIN):

```sql
SELECT 
    i.id as legacy_id,
    i.nombre as name,
    p.precio as sale_price,
    p.costo as cost,
    p.cantidad as stock
FROM item i
JOIN producto p ON i.id = p.id
WHERE i.status = 1;
```

### Notas Importantes
1.  **Relación 1:1:** Existe una fuerte correlación entre `item.id` y `producto.id`. Ambos tienen el mismo conteo de filas (69 registros).
2.  **Imágenes:** Las imágenes `img_XXX.jpg` probablemente corresponden al ID del producto o item. Se requiere verificar visualmente si `img_127.jpg` corresponde al `item` con id 127.

## 4. Ubicación de Archivos Extraídos
Los archivos descomprimidos se encuentran temporalmente en:
`d:\J work\Documentos\Miss Chulerías\business_control_system\uploads\temp_mnx\`

---
**Instrucciones para Kimi:**
Si necesitas ejecutar una migración, utiliza el driver `better-sqlite3` para conectar a `bd_1712805230389_xxmn.db` y ejecuta la query de unión mencionada arriba.
