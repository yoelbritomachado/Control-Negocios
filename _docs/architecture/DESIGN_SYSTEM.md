# 🎨 DESIGN_SYSTEM.md - Sistema de Diseño BizControl

> **Documentación técnica del sistema de diseño visual de BizControl (Miss Chulerías)**
> 
> **Última actualización:** 2026-02-17
> **Versión:** 2.7
> **Autor:** Kimi Claw (Agente Remoto)

---

## 📋 Índice

1. [Filosofía de Diseño](#filosofía-de-diseño)
2. [Paleta de Colores](#paleta-de-colores)
3. [Tipografía](#tipografía)
4. [Componentes Base](#componentes-base)
5. [Patrones de UI](#patrones-de-ui)
6. [Animaciones](#animaciones)
7. [Layout y Estructura](#layout-y-estructura)
8. [Componentes Reutilizables](#componentes-reutilizables)

---

## 🎯 Filosofía de Diseño

### Identidad Visual
- **Nombre:** BizControl Premium System
- **Eslogan:** "Sistema Premium de Gestión Económica"
- **Vibe:** Profesional, moderno, oscuro-premium, glassmorphism

### Principios
1. **Dark First:** El modo oscuro es el predeterminado y principal
2. **Glassmorphism:** Uso extensivo de transparencias y blur
3. **Gradientes Cian:** El cian (#06b6d4) es el color de marca principal
4. **Espaciado Generoso:** Padding y gap consistentes (4, 6, 8 unidades)
5. **Bordes Redondeados:** `rounded-xl` (12px) y `rounded-2xl` (16px) predominantes

---

## 🎨 Paleta de Colores

### Colores Primarios (Tailwind)
| Nombre | Variable CSS | Hex | Uso |
|--------|--------------|-----|-----|
| **Cyan** | `--primary` | `#06b6d4` | Botones, acentos, iconos activos |
| **Cyan Light** | - | `#22d3ee` | Gradientes, hover states |
| **Emerald** | `--success` | `#10b981` | Éxito, ventas, tendencias positivas |
| **Rose** | `--destructive` | `#f43f5e` | Errores, pérdidas, alertas |
| **Violet** | `--purple` | `#8b5cf6` | Fondos de transferencias, acentos secundarios |
| **Amber** | `--warning` | `#f59e0b` | Advertencias, stock bajo |

### Colores de Fondo (Dark Mode)
| Nombre | Variable CSS | Valor HSL | Uso |
|--------|--------------|-----------|-----|
| **Background** | `--background` | `222 47% 6%` | Fondo principal (#08090A) |
| **Card** | `--card` | `222 47% 8%` | Tarjetas, modales |
| **Secondary** | `--secondary` | `222 47% 12%` | Fondos secundarios, hover |
| **Border** | `--border` | `222 47% 14%` | Bordes sutiles |

### Gradientes Predefinidos
```css
/* Texto Gradiente Principal */
.gradient-text {
  background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #10b981 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Texto Gradiente Cian */
.gradient-text-cyan {
  background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Botón Primario */
background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
```

---

## 🔤 Tipografía

### Fuentes
| Uso | Fuente | Fallback |
|-----|--------|----------|
| **UI General** | Inter | system-ui, sans-serif |
| **Código/Monospace** | JetBrains Mono | monospace |

### Importación
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

### Jerarquía de Texto
| Elemento | Tamaño | Peso | Tracking | Color |
|----------|--------|------|----------|-------|
| **H1 (Título Página)** | `text-3xl` (30px) | `font-bold` (700) | `tracking-tight` | `text-foreground` |
| **H2 (Sección)** | `text-2xl` (24px) | `font-bold` (700) | - | `text-foreground` |
| **H3 (Card Title)** | `text-xl` (20px) | `font-semibold` (600) | - | `text-foreground` |
| **Body** | `text-sm` (14px) | `font-normal` (400) | - | `text-foreground` |
| **Caption** | `text-xs` (12px) | `font-medium` (500) | - | `text-muted-foreground` |
| **Label/Tag** | `text-xs` (12px) | `font-semibold` (600) | `uppercase tracking-wider` | `text-muted-foreground` |

---

## 🧩 Componentes Base

### 1. Glass Card (Tarjeta Glassmorphism)
```jsx
// Uso básico
<div className="glass-card p-6">
  {/* Contenido */}
</div>

// CSS equivalente
.glass-card {
  @apply relative overflow-hidden rounded-2xl;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -2px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}
```

### 2. Premium Card (Con borde degradado)
```jsx
<div className="premium-card p-6">
  {/* Contenido */}
</div>
```

### 3. Botón Primario con Glow
```jsx
<button className="btn-primary-glow px-5 py-2.5 rounded-xl text-white font-medium">
  Acción
</button>
```

### 4. Input Estilizado
```jsx
<input 
  className="w-full px-4 py-2 bg-card/50 border border-border/50 rounded-lg 
             focus:outline-none focus:border-cyan-500/50 transition-colors"
  placeholder="Placeholder..."
/>
```

### 5. Badge/Tag
```jsx
// Variantes de badges
<span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
  Éxito
</span>
<span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-500/20 text-rose-400">
  Error
</span>
<span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">
  Info
</span>
```

---

## 📐 Patrones de UI

### Header de Página (Ya implementado en Header.jsx)
```
┌─────────────────────────────────────────────────────────────┐
│  ●  SUBTÍTULO (text-xs, uppercase, tracking-wider)         │
│  🏠 Título: SEDE (text-3xl, gradient-text-cyan)            │
│                                                             │
│  [🔔] [👤 Usuario] [+ Nueva Venta]                         │
└─────────────────────────────────────────────────────────────┘
```

### Tarjeta de Estadística (StatCard)
```
┌──────────────────────────────────────────┐
│  [🔣]              [↑ 12.5%]             │
│  TÍTULO (text-xs, uppercase)             │
│  $4,227.00 (text-3xl, color variant)     │
│  Actualizado ahora                       │
│ ──────────────────────────────────────── │
└──────────────────────────────────────────┘
```

### Sidebar Item
```
┌─────────────────────────────────────┐
│  🏠  Dashboard              ●       │  <- Activo
├─────────────────────────────────────┤
│  🛒  Punto de Venta                 │  <- Inactivo
└─────────────────────────────────────┘
```

### Modal/PaymentModal
- Fondo: `bg-black/60 backdrop-blur-sm`
- Contenedor: `glass-card max-w-lg mx-auto`
- Animación: `framer-motion` con scale y opacity

---

## ✨ Animaciones

### Librería: Framer Motion

#### 1. Fade In Up (Entrada de página)
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
>
  {children}
</motion.div>
```

#### 2. Stagger Children (Lista animada)
```jsx
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {items.map((item, i) => (
    <motion.div
      key={i}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item}
    </motion.div>
  ))}
</motion.div>
```

#### 3. Hover Scale (Botones interactivos)
```jsx
<motion.button
  whileHover={{ scale: 1.02, y: -1 }}
  whileTap={{ scale: 0.98 }}
>
  Acción
</motion.button>
```

### Animaciones CSS

| Nombre | Duración | Uso |
|--------|----------|-----|
| `float` | 6s infinite | Elementos decorativos |
| `pulse-glow` | 2s infinite | Indicadores de estado |
| `shimmer` | 2s infinite | Efecto de carga |
| `gradient-shift` | 15s infinite | Fondos animados |

---

## 📐 Layout y Estructura

### Grid Principal
```
┌──────────────────────────────────────────────────────────────┐
│  SIDEBAR (fijo, 288px)    │  MAIN CONTENT (flex-1)          │
│  ┌─────────────────────┐  │  ┌───────────────────────────┐  │
│  │ Logo                │  │  │ Header                    │  │
│  │ Inventario Activo   │  │  ├───────────────────────────┤  │
│  │ ─────────────────── │  │  │                           │  │
│  │ Dashboard           │  │  │ Content                   │  │
│  │ Punto de Venta      │  │  │                           │  │
│  │ Inventario          │  │  │                           │  │
│  │ Compras             │  │  │                           │  │
│  │ Historial           │  │  │                           │  │
│  └─────────────────────┘  │  └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Breakpoints
| Breakpoint | Ancho | Comportamiento Sidebar |
|------------|-------|------------------------|
| Mobile | < 1024px | Oculto, toggle con botón |
| Desktop | ≥ 1024px | Visible fijo (`lg:ml-72`) |

---

## 🧩 Componentes Reutilizables (Catálogo)

### 1. StatCard - Tarjeta de Estadística
**Ubicación:** `src/components/StatCard.jsx`

**Props:**
```typescript
interface StatCardProps {
  title: string;           // Título de la métrica
  value: number;           // Valor numérico
  prefix?: string;         // Prefijo (ej: "$")
  suffix?: string;         // Sufijo (ej: "%")
  decimals?: number;       // Decimales (default: 0)
  trend?: number;          // Porcentaje de tendencia
  trendLabel?: string;     // Texto descriptivo
  icon: LucideIcon;        // Icono de lucide-react
  variant: 'success' | 'danger' | 'info' | 'warning' | 'purple';
  delay?: number;          // Delay de animación (segundos)
  isCurrency?: boolean;    // Formatear como moneda
}
```

**Uso:**
```jsx
import { DollarSign } from 'lucide-react';
import { StatCard } from '../components/StatCard';

<StatCard
  title="Ventas Totales (CUP)"
  value={4227.00}
  prefix="$"
  decimals={2}
  trend={12.5}
  trendLabel="Actualizado ahora"
  icon={DollarSign}
  variant="success"
  delay={0.1}
  isCurrency
/>
```

---

### 2. ConfirmModal - Modal de Confirmación
**Ubicación:** `src/components/ConfirmModal.jsx`

**Props:**
```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;    // Default: "Confirmar"
  cancelText?: string;     // Default: "Cancelar"
  variant?: 'danger' | 'warning' | 'info';  // Default: 'danger'
}
```

**Uso:**
```jsx
<ConfirmModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDelete}
  title="Eliminar Producto"
  message="¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer."
  confirmText="Eliminar"
  variant="danger"
/>
```

---

### 3. SearchDropdown - Búsqueda Predictiva
**Ubicación:** `src/components/SearchDropdown.jsx`

**Props:**
```typescript
interface SearchDropdownProps {
  items: Array<{ id: string; name: string; code?: string }>;
  onSelect: (item: any) => void;
  placeholder?: string;
  searchFields?: string[];  // Campos a buscar (default: ['name', 'code'])
}
```

**Uso:**
```jsx
<SearchDropdown
  items={products}
  onSelect={(product) => addToCart(product)}
  placeholder="Buscar producto..."
/>
```

---

### 4. ProductThumbnail - Miniatura de Producto
**Ubicación:** `src/components/ProductThumbnail.jsx`

**Props:**
```typescript
interface ProductThumbnailProps {
  product: {
    id: string;
    name: string;
    image?: string;
    code?: string;
  };
  size?: 'sm' | 'md' | 'lg';  // Default: 'md'
  showCode?: boolean;          // Default: true
}
```

---

### 5. InventorySelector - Selector de Inventario
**Ubicación:** `src/components/InventorySelector.jsx`

**Uso:**
```jsx
// Ya está integrado en el Sidebar
// Cambia entre: MCH1, MCH2, Almacén
```

---

### 6. PaymentModal - Modal de Pago
**Ubicación:** `src/components/PaymentModal.jsx`

**Props:**
```typescript
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onPayment: (paymentData: PaymentData) => void;
}

interface PaymentData {
  method: 'cash' | 'transfer';
  amount: number;
  change?: number;
}
```

---

### 7. ProductForm - Formulario de Producto
**Ubicación:** `src/components/ProductForm.jsx`

**Props:**
```typescript
interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: Product) => void;
  initialData?: Product;     // Para edición
  settings?: Settings;
}
```

---

### 8. SalesChart - Gráfico de Ventas
**Ubicación:** `src/components/SalesChart.jsx`

**Uso:**
```jsx
// Componente autónomo, no requiere props
// Muestra gráfico de ventas de los últimos 7 días
<SalesChart />
```

---

## 🔧 Utilidades

### Función `cn()` - Clases condicionales
**Ubicación:** `src/lib/utils.js`

```jsx
import { cn } from '../lib/utils';

// Une clases de Tailwind y maneja condicionales
<div className={cn(
  'base-class',
  condition && 'conditional-class',
  'always-applied'
)}>
```

---

## 📦 Inventario de Iconos (Lucide)

Iconos más usados en el sistema:

| Icono | Import | Uso típico |
|-------|--------|------------|
| LayoutDashboard | `lucide-react` | Dashboard |
| ShoppingCart | `lucide-react` | POS/Ventas |
| Package | `lucide-react` | Inventario |
| ArrowLeftRight | `lucide-react` | Compras |
| Users | `lucide-react` | Usuarios |
| History | `lucide-react` | Historial |
| DollarSign | `lucide-react` | Dinero/Ventas |
| TrendingUp | `lucide-react` | Tendencia positiva |
| TrendingDown | `lucide-react` | Tendencia negativa |
| Plus | `lucide-react` | Agregar |
| Search | `lucide-react` | Búsqueda |
| Bell | `lucide-react` | Notificaciones |
| User | `lucide-react` | Perfil |
| Settings | `lucide-react` | Configuración |

---

## ✅ Checklist para Nuevas Pantallas

Al crear una nueva pantalla, verifica:

- [ ] Usar `MainLayout` como contenedor
- [ ] No duplicar el título (ya está en `Header.jsx`)
- [ ] Usar `glass-card` para contenedores principales
- [ ] Usar `StatCard` para métricas
- [ ] Usar `text-muted-foreground` para textos secundarios
- [ ] Usar `gradient-text-cyan` para acentos importantes
- [ ] Agregar animaciones con `framer-motion`
- [ ] Verificar responsive (mobile/desktop)
- [ ] Usar `cn()` para clases condicionales

---

## 📝 Notas para Desarrolladores

1. **Nunca uses listas desplegables (`<select>`)** para más de 10 items. Usa `SearchDropdown`.

2. **Siempre usa el `Header` existente.** No crees títulos duplicados en las páginas.

3. **Mantén la consistencia de colores:**
   - Éxito/Positivo → Emerald
   - Error/Pérdida → Rose
   - Info/Neutral → Cyan
   - Advertencia → Amber
   - Transferencias → Violet/Purple

4. **Para modales:** Usa `AnimatePresence` y `motion.div` con las variantes estándar.

5. **Para formularios:** Usa los estilos de input definidos en este documento.

---

**Documento mantenido por:** Kimi Claw (Agente Remoto)
**Para:** Antigravity / Yoel Brito
**Proyecto:** BizControl - Miss Chulerías
