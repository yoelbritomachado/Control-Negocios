# Memoria del Proyecto - Business Control System (Miss Chulerías)

## Fecha de actualización: 2026-02-16

---

## Lógica de Ventas y Edición

### Estados de Venta

| Estado | Descripción | Editable | Items Guardados |
|--------|-------------|----------|-----------------|
| **Guardada** | Venta pendiente de cobro | ✅ Sí | ✅ Sí |
| **Cobrada** | Venta pagada en sesión abierta | ✅ Sí (hasta cerrar sesión) | ✅ Sí (debe guardarse) |
| **Histórica** | Venta en sesión cerrada | ⚠️ Solo admin/dueño | ✅ Sí |

### Flujo de Ventas

1. **Crear venta**: Se agregan productos al carrito
2. **Guardar venta**: Se guarda como pendiente (items guardados)
3. **Cobrar venta**: Se procesa el pago (items deben guardarse)
4. **Editar venta**: 
   - Mientras sesión esté abierta: Todos los usuarios pueden editar
   - Después de cerrar sesión: Solo admin/dueño pueden editar
5. **Cerrar sesión**: Las ventas pasan a historial

### Permisos de Edición

| Rol | Ventas Guardadas | Ventas Cobradas (sesión abierta) | Ventas Históricas |
|-----|------------------|----------------------------------|-------------------|
| Todos | ✅ Editar | ✅ Editar | ❌ No |
| Admin | ✅ Editar | ✅ Editar | ✅ Editar |
| Dueño | ✅ Editar | ✅ Editar | ✅ Editar |

---

## Cambios Pendientes

### Backend
- [ ] Modificar endpoint `/sales` para guardar items de ventas cobradas
- [ ] Crear endpoint para editar ventas históricas (solo admin)
- [ ] Guardar historial de ediciones

### Frontend
- [ ] Actualizar POS para guardar items al cobrar
- [ ] Actualizar lógica de edición para permitir editar ventas cobradas
- [ ] Implementar permisos en historial de ventas

---

## Notas Técnicas

- Las ventas deben guardar `items` array con: `product_id`, `quantity`, `price`, `cost`
- Al editar, se carga el carrito con los items y se elimina la venta original
- Al cerrar sesión, las ventas se archivan y requieren permisos especiales para editar
