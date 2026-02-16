# MEMORIA_PROYECTO.md

## Registro de Progreso

### 1. Sistema de Control de Acceso y Seguridad
- **Autenticación:**
  - Login por Usuario/PIN o Código de Correo (OTP).
  - Verificación de sesión activa cada 2 segundos para expulsión inmediata (Kick/Ban).
- **Gestión de Usuarios (Admin):**
  - **Ban (Bloqueo):** Impide el acceso pero mantiene al usuario en la base de datos.
  - **Kick (Expulsión):** Cierra la sesión activa forzando re-login.
  - **Delete (Eliminación):** Borra al usuario permanentemente.
  - **Lista Negra (Persistent Ban):**
    - Si se elimina un usuario que estaba **Baneado**, su correo se añade automáticamente a una *Lista Negra*.
    - Los correos en Lista Negra no pueden volver a registrarse.
- **Feedback de Login:**
  - Mensajes claros diferenciando "PIN incorrecto" de "Usuario no existe".

### 2026-02-05 - Agente Ventas (Especialista de POS)
- **Tarea**: Implementar lógica de negocio desde hoja de cálculo.
- **Cambios**:
  - Actualizada tabla `products` con columna `cost_mx`.
  - Backend calcula automáticamente Costo USD, Costo MN y Venta Sugerida.
  - Frontend muestra cálculos en tiempo real y soporta auto-backup.
  - Gestión física de imágenes al borrar productos.
  - Implementada exportación a PDF y Excel con imágenes.

### 2026-02-07 - Especialista de POS (Manejo de Crisis & Mejoras)
- **Tarea**: Depuración de Error de Sintaxis Crítico (500 Babel Failure).
- **Cambios**:
  - Identificado y resuelto desbalance estructural en el árbol JSX de `App.jsx`.
  - Corregido error de "Unterminated template literal" provocado por caracteres invisibles.
  - Reconstrucción incremental del componente principal para asegurar paridad total.
- **Tarea**: Implementación de Dashboard de Resumen Financiero.
- **Cambios**:
  - Añadido bloque de estadísticas en tiempo real sobre el inventario filtrado.
  - Métricas: Costo Total MN, Venta Total Estimada, Ganancia Bruta y Rentabilidad (Markup).
- **Tarea**: Refinamiento Visual del Header y Selector.
- **Cambios**:
  - Renombrado el título principal a "Registro de compras".
  - Eliminada la marca "MCH".
  - Rediseño del Selector de Inventario: Añadida etiqueta aclaratoria ("Seleccionar Inventario:") y resaltado visual con bordes y sombras para facilitar su identificación como elemento crítico.
- **Tarea**: Mejora de Accesibilidad y Contraste (Cero Textos Oscuros).
- **Cambios**:
  - Global: Actualizado `index.css` con variantes de color de texto y fondo específicas para `dark mode`.
  - Formularios: Forzado de color de texto blanco (`dark:text-white`) y aclarado de placeholders (`dark:placeholder-gray-400`) en todos los inputs.
  - Dashboard: Aumentado el contraste de etiquetas secundarias y unidades (MN/USD) en modo oscuro.
- **Estado**: Sistema Restaurado, Mejorado y 100% Funcional (v2.3).

### 2026-02-10 - Especialista de POS (Parche de Robustez Auth v2.4)
- **Tarea**: Corrección de fallo de verificación y saneamiento de entradas.
- **Cambios**:
  - **Backend**: Implementado `.trim()` y normalización de minúsculas en todos los endpoints de autenticación (`/api/login`, `/api/register`, `/api/auth`).
  - **Redirección Inteligente**: El login ahora informa si la cuenta requiere verificación y ofrece redirigir al usuario automáticamente al flujo de código.
  - **Frontend**: Los inputs de usuario, correo y PIN se limpian de espacios antes de enviarse al servidor.
  - **Manual Fix**: Activada cuenta de usuaria `keilitapd371@gmail.com` directamente en DB.
- **Estado**: Auth blindada contra errores de espacio y Case (v2.4).

### 2026-02-10 - Especialista de POS (Optimización de FPS Galería v2.7)
- **Tarea**: Eliminación de "temblores" y optimización de rendimiento.
- **Cambios**:
  - **Aislamiento de Componente**: Galería extraída a `Gallery.jsx` para evitar re-renders globales durante el swipe.
  - **Aceleración GPU**: Implementado `translate3d` para forzar el procesamiento por tarjeta de video.
  - **Fluidez**: Movimiento de 60fps constantes al seguir el dedo del usuario.
- **Estado**: Rendimiento nivel profesional (v2.7).
