import { useState, useCallback, useMemo } from 'react';
import { NODE_TYPES, NODE_STATUS, DEFAULT_METRICS } from './nexus.types';

// Generar ID único
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Datos iniciales de ejemplo
const INITIAL_NODES = [
  {
    id: 'empresa_1',
    type: 'empresa',
    name: 'Miss Chulerías',
    status: NODE_STATUS.ONLINE,
    description: 'Entidad principal del sistema. Gestión corporativa.',
    metrics: { sucursales: 3, empleados: 12, ingresos: 45000 },
    children: ['admin_1', 'inv_1', 'vend_1', 'caja_1'],
    parentId: null,
    position: { x: 400, y: 50 }
  },
  {
    id: 'admin_1',
    type: 'administrador',
    name: 'Administrador Principal',
    status: NODE_STATUS.ONLINE,
    description: 'Control total del sistema.',
    metrics: { acceso: 'Total', nivel: 'Admin' },
    children: [],
    parentId: 'empresa_1',
    position: { x: 400, y: 250 }
  },
  {
    id: 'inv_1',
    type: 'inventario',
    name: 'Almacén Central',
    status: NODE_STATUS.ONLINE,
    description: 'Inventario principal y distribución.',
    metrics: { productos: 2450, stockBajo: 23, capacidad: '85%', pedidos: 12 },
    children: ['inv_2'],
    parentId: 'empresa_1',
    position: { x: 100, y: 450 }
  },
  {
    id: 'inv_2',
    type: 'inventario',
    name: 'Almacén Sucursal',
    status: NODE_STATUS.WARNING,
    description: 'Stock de sucursal - Venta directa.',
    metrics: { productos: 890, stockBajo: 45, capacidad: '62%', pedidos: 5 },
    children: [],
    parentId: 'inv_1',
    position: { x: 100, y: 650 }
  },
  {
    id: 'vend_1',
    type: 'vendedor',
    name: 'Equipo de Ventas',
    status: NODE_STATUS.ONLINE,
    description: 'Equipo de ventas y atención al cliente.',
    metrics: { activos: 5, ventasHoy: 42, clientes: 156 },
    children: [],
    parentId: 'empresa_1',
    position: { x: 400, y: 450 }
  },
  {
    id: 'caja_1',
    type: 'caja',
    name: 'Caja Principal',
    status: NODE_STATUS.ONLINE,
    description: 'Punto de venta principal - Sucursal central.',
    metrics: { abiertas: 2, ventas: 12500, efectivo: 3200, transacciones: 156 },
    children: ['caja_2'],
    parentId: 'empresa_1',
    position: { x: 700, y: 450 }
  },
  {
    id: 'caja_2',
    type: 'caja',
    name: 'Caja Express',
    status: NODE_STATUS.ONLINE,
    description: 'Caja rápida - Solo efectivo.',
    metrics: { abiertas: 1, ventas: 850, efectivo: 850, transacciones: 89 },
    children: [],
    parentId: 'caja_1',
    position: { x: 700, y: 650 }
  }
];

export const useNexus = () => {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['empresa_1']));

  // Obtener nodo por ID
  const getNodeById = useCallback((id) => {
    return nodes.find(n => n.id === id);
  }, [nodes]);

  // Obtener hijos de un nodo
  const getChildren = useCallback((parentId) => {
    return nodes.filter(n => n.parentId === parentId);
  }, [nodes]);

  // Obtener árbol de nodos (jerarquía)
  const nodeTree = useMemo(() => {
    const buildTree = (parentId = null) => {
      return nodes
        .filter(n => n.parentId === parentId)
        .map(n => ({
          ...n,
          children: expandedNodes.has(n.id) ? buildTree(n.id) : []
        }));
    };
    return buildTree();
  }, [nodes, expandedNodes]);

  // Nodos raíz (sin padre)
  const rootNodes = useMemo(() => {
    return nodes.filter(n => !n.parentId);
  }, [nodes]);

  // Crear nuevo nodo
  const createNode = useCallback((type, parentId = null, data = {}) => {
    const typeConfig = NODE_TYPES[type.toUpperCase()];
    if (!typeConfig) throw new Error(`Tipo de nodo inválido: ${type}`);

    // Validar si el padre puede tener hijos de este tipo
    if (parentId) {
      const parent = getNodeById(parentId);
      if (parent) {
        const parentConfig = NODE_TYPES[parent.type.toUpperCase()];
        if (!parentConfig.canHaveChildren) {
          throw new Error(`El nodo ${parent.name} no puede tener hijos`);
        }
        if (!parentConfig.allowedChildren.includes(type)) {
          throw new Error(`El nodo ${parent.name} no puede tener hijos de tipo ${type}`);
        }
        
        const currentChildren = getChildren(parentId);
        if (currentChildren.length >= parentConfig.maxChildren) {
          throw new Error(`El nodo ${parent.name} ha alcanzado el máximo de hijos (${parentConfig.maxChildren})`);
        }
      }
    }

    const newNode = {
      id: generateId(),
      type,
      name: data.name || `${typeConfig.label} ${nodes.filter(n => n.type === type).length + 1}`,
      status: NODE_STATUS.ONLINE,
      description: data.description || typeConfig.description,
      metrics: { ...DEFAULT_METRICS[type], ...data.metrics },
      children: [],
      parentId,
      position: data.position || { x: 0, y: 0 }
    };

    setNodes(prev => [...prev, newNode]);
    
    // Actualizar children del padre
    if (parentId) {
      setNodes(prev => prev.map(n => 
        n.id === parentId 
          ? { ...n, children: [...n.children, newNode.id] }
          : n
      ));
    }

    return newNode;
  }, [nodes, getNodeById, getChildren]);

  // Actualizar nodo
  const updateNode = useCallback((id, updates) => {
    setNodes(prev => prev.map(n => 
      n.id === id ? { ...n, ...updates } : n
    ));
  }, []);

  // Eliminar nodo (y sus hijos recursivamente)
  const deleteNode = useCallback((id) => {
    const nodeToDelete = getNodeById(id);
    if (!nodeToDelete) return;

    // Eliminar de children del padre
    if (nodeToDelete.parentId) {
      setNodes(prev => prev.map(n => 
        n.id === nodeToDelete.parentId
          ? { ...n, children: n.children.filter(c => c !== id) }
          : n
      ));
    }

    // Eliminar nodo y sus hijos recursivamente
    const idsToDelete = new Set();
    const collectIds = (nodeId) => {
      idsToDelete.add(nodeId);
      const node = getNodeById(nodeId);
      if (node?.children) {
        node.children.forEach(collectIds);
      }
    };
    collectIds(id);

    setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
    
    // Limpiar selección si es necesario
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  }, [getNodeById, selectedNodeId]);

  // Expandir/colapsar nodo
  const toggleExpand = useCallback((id) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Mover nodo (cambiar padre)
  const moveNode = useCallback((nodeId, newParentId) => {
    if (nodeId === newParentId) return;
    
    const node = getNodeById(nodeId);
    if (!node) return;

    // Verificar que no se cree ciclo
    let current = getNodeById(newParentId);
    while (current) {
      if (current.id === nodeId) {
        throw new Error('No se puede mover un nodo a su propio descendiente');
      }
      current = getNodeById(current.parentId);
    }

    // Quitar de children del padre anterior
    if (node.parentId) {
      setNodes(prev => prev.map(n => 
        n.id === node.parentId
          ? { ...n, children: n.children.filter(c => c !== nodeId) }
          : n
      ));
    }

    // Agregar a children del nuevo padre
    if (newParentId) {
      setNodes(prev => prev.map(n => 
        n.id === newParentId
          ? { ...n, children: [...n.children, nodeId] }
          : n
      ));
    }

    // Actualizar parentId del nodo
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, parentId: newParentId } : n
    ));
  }, [getNodeById]);

  // Seleccionar nodo
  const selectNode = useCallback((id) => {
    setSelectedNodeId(id);
  }, []);

  // Estadísticas
  const stats = useMemo(() => ({
    total: nodes.length,
    byType: {
      empresa: nodes.filter(n => n.type === 'empresa').length,
      administrador: nodes.filter(n => n.type === 'administrador').length,
      inventario: nodes.filter(n => n.type === 'inventario').length,
      vendedor: nodes.filter(n => n.type === 'vendedor').length,
      caja: nodes.filter(n => n.type === 'caja').length
    },
    online: nodes.filter(n => n.status === NODE_STATUS.ONLINE).length,
    offline: nodes.filter(n => n.status === NODE_STATUS.OFFLINE).length
  }), [nodes]);

  return {
    nodes,
    nodeTree,
    rootNodes,
    selectedNodeId,
    selectedNode: getNodeById(selectedNodeId),
    expandedNodes,
    stats,
    
    // Acciones
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    selectNode,
    toggleExpand,
    getNodeById,
    getChildren
  };
};

export default useNexus;
