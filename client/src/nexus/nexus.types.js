/**
 * NexusNode - Sistema de Gestión Empresarial Nodal
 * Tipos de nodos y configuraciones
 */

export const NODE_TYPES = {
  EMPRESA: {
    id: 'empresa',
    label: 'Empresa',
    color: '#3b82f6', // azul
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    icon: 'Building2',
    description: 'Entidad principal del sistema. Gestión corporativa y dirección estratégica.',
    canHaveChildren: true,
    allowedChildren: ['administrador', 'inventario', 'vendedor', 'caja'],
    maxChildren: 10,
    metrics: ['sucursales', 'empleados', 'ingresos']
  },
  ADMINISTRADOR: {
    id: 'administrador',
    label: 'Administrador',
    color: '#ef4444', // rojo
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    icon: 'Shield',
    description: 'Control total del sistema. Gestión de usuarios, permisos y configuraciones.',
    canHaveChildren: false,
    allowedChildren: [],
    maxChildren: 0,
    metrics: ['acceso', 'nivel']
  },
  INVENTARIO: {
    id: 'inventario',
    label: 'Inventario',
    color: '#8b5cf6', // morado
    bgColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    icon: 'Package',
    description: 'Gestión de stock, productos, proveedores y movimientos de almacén.',
    canHaveChildren: true,
    allowedChildren: ['inventario'], // Puede tener sub-almacenes
    maxChildren: 5,
    metrics: ['productos', 'stockBajo', 'capacidad', 'pedidos']
  },
  VENDEDOR: {
    id: 'vendedor',
    label: 'Vendedor',
    color: '#10b981', // verde
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    icon: 'Users',
    description: 'Equipo de ventas, atención al cliente y seguimiento de pedidos.',
    canHaveChildren: false,
    allowedChildren: [],
    maxChildren: 0,
    metrics: ['activos', 'ventasHoy', 'clientes']
  },
  CAJA: {
    id: 'caja',
    label: 'Caja',
    color: '#f97316', // naranja
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.5)',
    icon: 'Wallet',
    description: 'Puntos de venta, transacciones, pagos y arqueo de caja.',
    canHaveChildren: false,
    allowedChildren: [],
    maxChildren: 0,
    metrics: ['abiertas', 'ventas', 'efectivo', 'transacciones']
  }
};

// Jerarquía de nodos
export const NODE_HIERARCHY = {
  empresa: 0,      // Nivel 0 - Raíz
  administrador: 1, // Nivel 1
  inventario: 1,   // Nivel 1
  vendedor: 1,     // Nivel 1
  caja: 1          // Nivel 1
};

// Estado de conexión del nodo
export const NODE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  WARNING: 'warning',
  MAINTENANCE: 'maintenance'
};

// Configuración visual
export const VISUAL_CONFIG = {
  nodeWidth: 280,
  nodeHeight: 160,
  nodeGapX: 40,
  nodeGapY: 60,
  connectionStrokeWidth: 2,
  connectionColor: 'rgba(148, 163, 184, 0.3)',
  gridSize: 20,
  gridColor: 'rgba(148, 163, 184, 0.05)'
};

// Plantillas de métricas por tipo
export const DEFAULT_METRICS = {
  empresa: { sucursales: 0, empleados: 0, ingresos: 0 },
  administrador: { acceso: 'Total', nivel: 'Admin' },
  inventario: { productos: 0, stockBajo: 0, capacidad: '0%', pedidos: 0 },
  vendedor: { activos: 0, ventasHoy: 0, clientes: 0 },
  caja: { abiertas: 0, ventas: 0, efectivo: 0, transacciones: 0 }
};

// Iconos disponibles (SVG paths)
export const NODE_ICONS = {
  Building2: 'M3 21h18M5 21V7l8-4 8 4v14M8 21v-6a2 2 0 012-2h4a2 2 0 012 2v6',
  Shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  Package: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  Users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  Wallet: 'M20 12V8H6a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-4h-6a2 2 0 01-2-2 2 2 0 012-2h6zM16 4h-8a2 2 0 00-2 2v2h14V6a2 2 0 00-2-2z'
};
