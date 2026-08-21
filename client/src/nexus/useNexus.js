import { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../api';
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
  const [nodes, setNodes] = useState([]);
  const [archivedNodes, setArchivedNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['empresa_1']));

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        api.get('/nexus/nodes?active=true'),
        api.get('/nexus/nodes?archived=true')
      ]);
      setNodes(activeRes.data || []);
      setArchivedNodes(archivedRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar Nexus.');
    } finally { setLoading(false); }
  }, []);

  const restoreNode = useCallback(async (id) => {
    try {
      await api.post(`/nexus/nodes/${id}/restore`);
      await loadNodes();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo restaurar el nodo.');
    }
  }, [loadNodes]);

  const deletePermanent = useCallback(async (id) => {
    try {
      await api.delete(`/nexus/nodes/${id}`);
      await loadNodes();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar definitivamente el nodo.');
    }
  }, [loadNodes]);

  useEffect(() => { loadNodes(); }, [loadNodes]);

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
    api.post('/nexus/nodes', newNode).then(() => loadNodes()).catch(err => setError(err.response?.data?.error || 'No se pudo guardar el nodo.'));
    
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
    api.patch(`/nexus/nodes/${id}`, updates).catch(err => setError(err.response?.data?.error || 'No se pudo actualizar el nodo.'));
  }, []);

  // Archivar nodo (solo si está completamente desconectado)
  const deleteNode = useCallback((id) => {
    const nodeToDelete = getNodeById(id);
    if (!nodeToDelete) return;

    // Validar si tiene conexiones activas
    const parentList = nodeToDelete.parentIds?.length ? nodeToDelete.parentIds : (nodeToDelete.parentId ? [nodeToDelete.parentId] : []);
    const childrenList = nodeToDelete.children || [];
    
    if (parentList.length > 0 || childrenList.length > 0) {
      alert('⚠️ No podés archivar un nodo que tiene conexiones activas. Desconectá sus cables primero arrastrándolos al vacío.');
      return;
    }

    setNodes(prev => prev.filter(n => n.id !== id));
    api.post(`/nexus/nodes/${id}/archive`).then(() => loadNodes()).catch(err => {
      setError(err.response?.data?.error || 'No se pudo archivar el nodo.');
      loadNodes();
    });
    
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  }, [getNodeById, selectedNodeId, loadNodes]);

  // Conectar nodo (soporta múltiples padres para vendedor cubrefranco)
  const connectNodes = useCallback((parentId, childId) => {
    if (!parentId || !childId || parentId === childId) return;
    
    const childNode = getNodeById(childId);
    const parentNode = getNodeById(parentId);
    if (!childNode || !parentNode) return;

    const childType = (childNode.type || '').toLowerCase();
    const parentType = (parentNode.type || '').toLowerCase();

    // Validaciones de arquitectura de negocio con avisos claros
    if (childType === 'administrador' && parentType !== 'empresa') {
      alert(`⚠️ Conexión no permitida:\nUn Administrador (${childNode.name}) debe conectarse a una Empresa, no a un "${parentType}".`);
      return;
    }

    if (childType === 'vendedor' && parentType !== 'punto_de_venta') {
      alert(`⚠️ Conexión no permitida:\nUn Vendedor (${childNode.name}) debe conectarse a un Punto de Venta (como MCH 1 o MCH 2), no a un "${parentType}".`);
      return;
    }

    if (childType === 'almacén' && parentType !== 'empresa') {
      alert(`⚠️ Conexión no permitida:\nUn Almacén (${childNode.name}) debe conectarse a una Empresa.`);
      return;
    }

    if (childType === 'punto_de_venta' && parentType !== 'almacén') {
      alert(`⚠️ Conexión no permitida:\nUn Punto de Venta (${childNode.name}) debe ser abastecido por un Almacén Central.`);
      return;
    }

    if (childType === 'empresa' && parentType !== 'dueño') {
      alert(`⚠️ Conexión no permitida:\nUna Empresa (${childNode.name}) debe pertenecer a un Dueño.`);
      return;
    }

    // Verificar ciclos
    let current = parentNode;
    while (current) {
      if (current.id === childId) {
        alert('⚠️ No se puede conectar un nodo a su propio descendiente.');
        return;
      }
      current = current.parentId ? getNodeById(current.parentId) : null;
    }

    const currentParents = childNode.parentIds?.length 
      ? [...childNode.parentIds] 
      : (childNode.parentId ? [childNode.parentId] : []);
      
    if (currentParents.includes(parentId)) return; // Ya conectado

    let newParents;
    // Si el nodo es tipo 'vendedor', permite ser cubrefranco (múltiples puntos de venta)
    if (childNode.type === 'vendedor') {
      newParents = [...currentParents, parentId];
    } else {
      // Otros nodos tienen un único padre
      newParents = [parentId];
    }

    setNodes(prev => prev.map(n => {
      if (n.id === childId) {
        return { ...n, parentId: newParents[0], parentIds: newParents };
      }
      if (n.id === parentId) {
        return { ...n, children: Array.from(new Set([...(n.children || []), childId])) };
      }
      return n;
    }));

    api.patch(`/nexus/nodes/${childId}`, { parentIds: newParents, parentId: newParents[0] })
      .then(() => loadNodes())
      .catch(err => {
        console.error('Error al conectar nodos:', err);
        loadNodes();
      });
  }, [getNodeById, loadNodes]);

  // Desconectar nodo de un padre específico o de todos
  const disconnectNode = useCallback((childId, parentIdToRemove = null) => {
    const childNode = getNodeById(childId);
    if (!childNode) return;

    const currentParents = childNode.parentIds?.length 
      ? [...childNode.parentIds] 
      : (childNode.parentId ? [childNode.parentId] : []);

    let newParents;
    if (parentIdToRemove) {
      newParents = currentParents.filter(p => p !== parentIdToRemove);
    } else {
      newParents = [];
    }

    setNodes(prev => prev.map(n => {
      if (n.id === childId) {
        return { ...n, parentId: newParents[0] || null, parentIds: newParents };
      }
      if (parentIdToRemove && n.id === parentIdToRemove) {
        return { ...n, children: (n.children || []).filter(c => c !== childId) };
      }
      if (!parentIdToRemove && currentParents.includes(n.id)) {
        return { ...n, children: (n.children || []).filter(c => c !== childId) };
      }
      return n;
    }));

    api.patch(`/nexus/nodes/${childId}`, { parentIds: newParents, parentId: newParents[0] || null })
      .then(() => loadNodes())
      .catch(err => {
        console.error('Error al desconectar nodos:', err);
        loadNodes();
      });
  }, [getNodeById, loadNodes]);

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

  // Mover nodo (compatibilidad)
  const moveNode = useCallback((nodeId, newParentId) => {
    if (newParentId) {
      connectNodes(newParentId, nodeId);
    } else {
      disconnectNode(nodeId);
    }
  }, [connectNodes, disconnectNode]);

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
    archivedNodes,
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
    restoreNode,
    deletePermanent,
    moveNode,
    connectNodes,
    disconnectNode,
    selectNode,
    toggleExpand,
    getNodeById,
    getChildren,
    loadNodes
  };
};

export default useNexus;
