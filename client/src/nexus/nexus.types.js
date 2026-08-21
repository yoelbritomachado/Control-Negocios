/**
 * NexusNode - Sistema de Gestión Empresarial Nodal
 * Tipos de nodos y configuraciones
 * 
 * JERARQUÍA DEL SISTEMA (de mayor a menor importancia):
 * 1. DUEÑO - Máximo nivel, puede haber varios dueños
 * 2. EMPRESA - Nodo central, se conecta a dueño y administrador
 * 3. ALMACÉN - Pertenecen a la empresa
 * 4. PUNTO_DE_VENTA - Pertenecen al almacén (pueden recibir de múltiples almacenes)
 * 5. VENDEDOR - Pertenecen a puntos de venta (pueden trabajar en múltiples puntos)
 * 
 * RELACIONES:
 * - Dueño → Empresa (el dueño administra la empresa)
 * - Empresa → Dueño, Administrador, Almacén
 * - Almacén → Punto de Venta
 * - Punto de Venta → Almacén, Vendedor
 * - Vendedor → Punto de Venta (si trabaja en múltiples, es "cubrefranco")
 */

export const NODE_TYPES = {
  // NIVEL 0 - MÁXIMO: Dueño del sistema
  DUEÑO: {
    id: 'dueño',
    label: 'Dueño',
    color: '#f59e0b', // ámbar/dorado
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
    icon: 'Crown',
    description: 'Propietario del sistema. Máxima autoridad y control total del negocio.',
    canHaveChildren: true,
    allowedChildren: ['empresa'], // Un dueño puede tener múltiples empresas
    maxChildren: 10,
    metrics: ['empresas', 'ingresosTotales', 'patrimonio']
  },
  
  // NIVEL 1 - CENTRAL: Empresa (nodo principal)
  EMPRESA: {
    id: 'empresa',
    label: 'Empresa',
    color: '#3b82f6', // azul
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    icon: 'Building2',
    description: 'Entidad principal del sistema. Gestión corporativa y dirección estratégica. Nodo central al que se conectan dueño, administrador y almacenes.',
    canHaveChildren: true,
    allowedChildren: ['administrador', 'almacén'],
    maxChildren: 20,
    metrics: ['sucursales', 'empleados', 'ingresos']
  },
  
  // NIVEL 2 - GESTIÓN: Administrador
  ADMINISTRADOR: {
    id: 'administrador',
    label: 'Administrador',
    color: '#ef4444', // rojo
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    icon: 'Shield',
    description: 'Control operativo del sistema. Gestión de usuarios, permisos y configuraciones. Puede ser el mismo dueño o una persona contratada.',
    canHaveChildren: false,
    allowedChildren: [],
    maxChildren: 0,
    metrics: ['acceso', 'nivel', 'salario']
  },
  
  // NIVEL 2 - INFRAESTRUCTURA: Almacén
  ALMACÉN: {
    id: 'almacén',
    label: 'Almacén',
    color: '#8b5cf6', // morado
    bgColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    icon: 'Package',
    description: 'Centro de almacenamiento y distribución. Gestión de stock, productos y proveedores. Los almacenes proveen a los puntos de venta.',
    canHaveChildren: true,
    allowedChildren: ['punto_de_venta'], // Un almacén puede tener múltiples puntos de venta
    maxChildren: 15,
    metrics: ['productos', 'stockBajo', 'capacidad', 'pedidos']
  },
  
  // NIVEL 3 - OPERACIONES: Punto de Venta
  PUNTO_DE_VENTA: {
    id: 'punto_de_venta',
    label: 'Punto de Venta',
    color: '#f97316', // naranja
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.5)',
    icon: 'Store',
    description: 'Lugar físico de venta al público. Puede recibir mercancía de múltiples almacenes. Donde trabajan los vendedores.',
    canHaveChildren: true,
    allowedChildren: ['vendedor'], // Un punto de venta tiene múltiples vendedores
    maxChildren: 30,
    metrics: ['ventasHoy', 'vendedoresActivos', 'cajasAbiertas', 'inventarioLocal']
  },
  
  // NIVEL 4 - PERSONAL: Vendedor
  VENDEDOR: {
    id: 'vendedor',
    label: 'Vendedor',
    color: '#10b981', // verde
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    icon: 'Users',
    description: 'Equipo de ventas y atención al cliente. Puede trabajar en un punto de venta (vendedor) o en múltiples (cubrefranco).',
    canHaveChildren: false,
    allowedChildren: [],
    maxChildren: 0,
    metrics: ['activos', 'ventasHoy', 'clientes', 'comisiones']
  }
};

// Jerarquía de nodos (nivel de importancia)
export const NODE_HIERARCHY = {
  dueño: 0,           // Nivel 0 - Máximo
  empresa: 1,         // Nivel 1 - Central
  administrador: 2,   // Nivel 2 - Gestión
  almacén: 2,         // Nivel 2 - Infraestructura
  punto_de_venta: 3,  // Nivel 3 - Operaciones
  vendedor: 4         // Nivel 4 - Personal
};

// Estado de conexión del nodo
export const NODE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  WARNING: 'warning',
  MAINTENANCE: 'maintenance'
};

// Tipos de relaciones entre nodos
export const NODE_RELATIONSHIPS = {
  // Dueño posee Empresa
  OWNERSHIP: 'ownership',
  // Empresa administra Almacén
  MANAGEMENT: 'management',
  // Almacén provee a Punto de Venta
  SUPPLY: 'supply',
  // Vendedor trabaja en Punto de Venta
  EMPLOYMENT: 'employment',
  // Vendedor cubre múltiples puntos (cubrefranco)
  COVERAGE: 'coverage'
};

// Configuración visual
export const VISUAL_CONFIG = {
  nodeWidth: 260,
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
  dueño: { empresas: 1, ingresosTotales: 0, patrimonio: 0 },
  empresa: { sedes: 3, empleados: 0, ingresos: 0 },
  administrador: { acceso: 'Total', nivel: 'Admin', salario: 0 },
  almacén: { stockTotal: 0, capitalInvertido: 0, ventaProyectada: 0, productos: 0 },
  punto_de_venta: { stockTotal: 0, capitalInvertido: 0, ventaProyectada: 0, ventasHoy: 0 },
  vendedor: { ventasHoy: 0, comisiones: 0, transacciones: 0 }
};

// Iconos disponibles (SVG paths)
export const NODE_ICONS = {
  Crown: 'M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2-2h10v2H7v-2z',
  Building2: 'M3 21h18M5 21V7l8-4 8 4v14M8 21v-6a2 2 0 012-2h4a2 2 0 012 2v6',
  Shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  Package: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  Store: 'M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h4v4H7V7zm0 6h4v4H7v-4zm6-6h4v4h-4V7zm0 6h4v4h-4v-4z',
  Users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'
};

// Reglas de validación de conexiones
export const CONNECTION_RULES = {
  // Un dueño puede tener múltiples empresas
  'dueño': ['empresa'],
  // Una empresa puede tener administradores y almacenes
  'empresa': ['administrador', 'almacén'],
  // Un administrador pertenece a una empresa
  'administrador': [],
  // Un almacén puede tener múltiples puntos de venta
  'almacén': ['punto_de_venta'],
  // Un punto de venta puede tener múltiples vendedores
  'punto_de_venta': ['vendedor'],
  // Un vendedor puede trabajar en múltiples puntos (cubrefranco)
  'vendedor': ['punto_de_venta']
};
