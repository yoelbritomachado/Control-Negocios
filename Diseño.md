MANUAL DE IDENTIDAD Y ESPECIFICACIONES TÉCNICAS: PROYECTO BIZCONTROL (DASHBOARD MCH 1)

REFERENCIAS VISUALES:
- Todas las imágenes y capturas de referencia se encuentran en la carpeta local: img (en minúsculas).
- Consulta siempre esta carpeta para verificar alineaciones y estados visuales.

1. ARQUITECTURA GLOBAL Y ESTRUCTURA (LAYOUT):
- Layout: Interfaz de dos columnas con Sidebar lateral izquierdo (288px) y Panel Principal derecho.
- Radio de Curvatura (Redondeo): Uso obligatorio de bordes muy redondeados (border-radius: 40px o rounded-[2.5rem]) en contenedores principales y tarjetas.
- El sistema debe presentarse como una "ventana flotante" con sombra profunda y un borde blanco fino de 1px.

2. MODO CLARO (LIGHT MODE):
- Sidebar: Fondo sólido oscuro #121417.
- Fondo Principal: Gris extra claro #F8FAFC.
- Tarjetas: Fondo blanco puro #FFFFFF con sombra suave (shadow-sm) y borde sutil #F1F3F4.
- Tipografía: Títulos en Gray-800 o Gray-900. Textos secundarios en Gray-400.

3. MODO OSCURO (DARK MODE):
- Sidebar: Fondo oscuro #0F1115.
- Fondo Principal: Negro profundo #08090A.
- Tarjetas: Fondo #16191F con borde fino rgba(255, 255, 255, 0.05).
- Acento Primario: Color Rosa #FF3377. Debe tener un efecto de "resplandor" (Pink Glow) en iconos activos.

4. COMPONENTES CRÍTICOS Y REGLAS DE DISEÑO:

A. SIDEBAR Y LOGO:
- El logo debe estar compuesto por un icono rosa y el texto "BizControl".
- IMPORTANTE: El logo y el icono deben estar perfectamente centrados verticalmente entre sí. No debe haber desplazamientos extraños.
- Items de navegación: El item activo debe tener fondo rosa sólido (#FF3377) y sombra. Los inactivos deben ser grises y volverse blancos al hacer hover, desplazándose sutilmente a la derecha (4px-6px).

B. TARJETAS DE MÉTRICAS:
- Altura fija: 176px (11rem).
- Los números grandes deben usar fuente font-black (Extra Bold) con tracking-tight para evitar que el texto se vea separado.
- Cada tarjeta lleva un icono en la parte superior derecha dentro de un recuadro redondeado con fondo al 10% de opacidad del color del icono.

C. GRÁFICA DE VENTAS (VISUALIZACIÓN):
- Tipo: Gráfico de barras de 30 días.
- Dinamismo: La barra del día actual (día 30) debe ser color rosa (#FF3377) y tener una sombra/glow rosa.
- Interactividad: Debe aparecer un Tooltip negro/oscuro sobre la barra al pasar el ratón (hover) mostrando el valor en $.
- Alineación: Los números de los días (1 al 30) deben estar perfectamente centrados bajo cada barra.

D. FOOTER Y BOTÓN DE REPORTE (CORRECCIÓN IMPORTANTE):
- El botón "REPORTE" o "DESCARGAR REPORTE" debe ser COMPACTO. 
- ERROR A EVITAR: No debe ser tan grande que choque con el número de "Total Estimado General ($100,000.00)". Debe haber espacio suficiente entre el número y el botón para evitar saturación visual o clipping.

5. TIPOGRAFÍA Y ESTÉTICA:
- Fuente Principal: 'Inter' o 'Montserrat'.
- No se permiten textos cortados (clipping). Todo el contenido debe ser legible y centrado.
- Iconografía: Google Material Symbols Outlined.

Sigue estas reglas estrictamente. Si el diseño final no respeta los 40px de redondeo o el espaciado del botón de reporte, se considerará fallido.
        