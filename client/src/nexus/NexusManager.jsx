import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ZoomIn, ZoomOut, Maximize2, Minimize2, Grid3X3,
  Crown, Building2, Shield, Package, Users, Store,
  X, Check, AlertCircle, Trash2, GitBranch, Minus,
  Scan
} from 'lucide-react';
import { useNexus } from './useNexus';
import { NexusNode } from './NexusNode';
import { NexusMinimap } from './NexusGraph';
import { NODE_TYPES, NODE_STATUS, VISUAL_CONFIG } from './nexus.types';

// Panel de control para agregar nodos
const AddNodePanel = ({ onAdd, onClose, position, isDark }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const allTypes = ['dueño', 'empresa', 'administrador', 'almacén', 'punto_de_venta', 'vendedor'];

  const handleSubmit = () => {
    if (!selectedType) {
      setError('Selecciona un tipo de nodo');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa un nombre');
      return;
    }

    try {
      onAdd(selectedType, name, position);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const typeIcons = {
    dueño: Crown,
    empresa: Building2,
    administrador: Shield,
    almacén: Package,
    punto_de_venta: Store,
    vendedor: Users
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`fixed z-50 w-80 backdrop-blur-xl rounded-xl border shadow-2xl p-4 transition-colors duration-300 ${isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}
      style={{ left: position?.x || 20, top: position?.y || 20 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nuevo Nodo</h3>
        <button onClick={onClose} className={`transition-colors duration-300 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <label className={`text-xs uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tipo de nodo</label>
        <div className="grid grid-cols-2 gap-2">
          {allTypes.map(type => {
            const config = NODE_TYPES[type.toUpperCase()];
            const Icon = typeIcons[type];
            
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === type
                    ? (isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500 bg-blue-500/10')
                    : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300 bg-slate-50')
                }`}
              >
                <Icon 
                  size={20} 
                  style={{ color: config?.color }}
                  className="mx-auto mb-1"
                />
                <span className={`text-[10px] block text-center transition-colors duration-300 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {config?.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <label className={`text-xs uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Almacén Norte"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 focus:outline-none transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
          autoFocus
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Check size={16} />
          Crear
        </button>
        <button
          onClick={onClose}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
};

// Barra de herramientas
const Toolbar = ({ 
  onZoomIn, onZoomOut, onFitView, 
  showGrid, setShowGrid,
  lineStyle, setLineStyle,
  isFullscreen, toggleFullscreen,
  isDark
}) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
    <div className={`backdrop-blur-sm rounded-xl border p-1.5 shadow-2xl flex items-center gap-1 transition-colors duration-300 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
      {/* Line Style Toggle */}
      <button
        onClick={() => setLineStyle(lineStyle === 'curved' ? 'orthogonal' : 'curved')}
        className={`p-2 rounded-lg transition-colors ${lineStyle === 'curved' ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title={lineStyle === 'curved' ? 'Líneas curvas' : 'Líneas rectas (90°)'}
      >
        {lineStyle === 'curved' ? <GitBranch size={18} /> : <Minus size={18} />}
      </button>
      
      <div className={`w-px h-5 mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      
      {/* Zoom Controls */}
      <button
        onClick={onZoomIn}
        className={`p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Acercar"
      >
        <ZoomIn size={18} />
      </button>
      <button
        onClick={onZoomOut}
        className={`p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Alejar"
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={onFitView}
        className={`p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Ajustar a todos los nodos"
      >
        <Scan size={18} />
      </button>
      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-2 rounded-lg transition-colors ${showGrid ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title={showGrid ? 'Ocultar grid' : 'Mostrar grid de fondo'}
      >
        <Grid3X3 size={18} />
      </button>
      
      <div className={`w-px h-5 mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      
      {/* Fullscreen Toggle */}
      <button
        onClick={toggleFullscreen}
        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  </div>
);

// Header con estadísticas
const NexusHeader = ({ stats, lineStyle, isDark }) => (
  <div className={`absolute top-4 left-4 z-40 backdrop-blur-sm rounded-xl border p-4 shadow-xl transition-colors duration-300 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg border transition-colors duration-300 ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/10 border-blue-500/30' : 'bg-gradient-to-br from-blue-500/10 to-purple-500/5 border-blue-500/20'}`}>
        <Grid3X3 className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
      <div>
        <h1 className={`text-lg font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>NexusNode</h1>
        <p className={`text-xs transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {lineStyle === 'curved' ? 'Líneas curvas' : 'Líneas rectas (90°)'} • Scroll = Zoom
        </p>
      </div>
    </div>
    
    <div className="flex gap-4 text-xs">
      <div className="text-center">
        <p className={`uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nodos</p>
        <p className={`text-lg font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.total}</p>
      </div>
      <div className="text-center">
        <p className={`uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Online</p>
        <p className="text-lg font-bold text-emerald-500">{stats.online}</p>
      </div>
      <div className="text-center">
        <p className={`uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Offline</p>
        <p className="text-lg font-bold text-red-500">{stats.offline}</p>
      </div>
    </div>
  </div>
);

export const NexusManager = () => {
  const {
    nodes,
    selectedNodeId,
    selectedNode,
    stats,
    createNode,
    updateNode,
    deleteNode,
    moveNode
  } = useNexus();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [showGrid, setShowGrid] = useState(true);
  
  // Detectar tema oscuro/claro
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addPanelPosition, setAddPanelPosition] = useState({ x: 20, y: 20 });
  const [lineStyle, setLineStyle] = useState('curved'); // 'curved' | 'orthogonal'
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados de interacción
  const [draggingNode, setDraggingNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [tempLine, setTempLine] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef(0);

  // TAMAÑOS DEL NODO
  const NODE_WIDTH = 260;
  // Los nodos ahora tienen altura variable según contenido
  // Usamos refs para medir la altura real de cada nodo en el DOM
  const nodeRefs = useRef({});
  const nodeHeights = useRef({});

  // Convertir coordenadas
  const screenToCanvas = (screenX, screenY) => ({
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  });

  // Handlers de zoom
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleFitView = () => {
    if (nodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Obtener dimensiones del contenedor
    const container = containerRef.current;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calcular bounding box de todos los nodos
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const height = getNodeHeight(node.id);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + height);
    });
    
    // Agregar padding (40px en cada lado)
    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // Calcular dimensiones del bounding box
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calcular zoom para que todo quepa
    const zoomX = containerWidth / contentWidth;
    const zoomY = containerHeight / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 1.5); // Máximo zoom 1.5x para no acercar demasiado
    
    // Calcular pan para centrar el contenido
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    
    const newPan = {
      x: containerCenterX - contentCenterX * newZoom,
      y: containerCenterY - contentCenterY * newZoom
    };
    
    setZoom(newZoom);
    setPan(newPan);
  };

  // FULLSCREEN TOGGLE
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // TOUCH EVENTS - PAN Y PINCH ZOOM
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchStartPan = useRef({ x: 0, y: 0 });
  const isTouchPanning = useRef(false);
  
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1) {
      // Pan con un dedo
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartPan.current = { ...pan };
      isTouchPanning.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      const newZoom = Math.max(0.3, Math.min(3, zoom * delta));
      const rect = containerRef.current?.getBoundingClientRect();
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const zoomRatio = newZoom / zoom;
      
      setPan({
        x: centerX - (centerX - pan.x) * zoomRatio,
        y: centerY - (centerY - pan.y) * zoomRatio
      });
      setZoom(newZoom);
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isTouchPanning.current && !draggingNode) {
      // Pan con un dedo
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      
      setPan({
        x: touchStartPan.current.x + dx,
        y: touchStartPan.current.y + dy
      });
    }
  };

  const handleTouchEnd = () => {
    isTouchPanning.current = false;
    setDraggingNode(null);
  };

  const handleAddNode = (type, name, position) => {
    createNode(type, null, { 
      name,
      position: position || { x: 400, y: 200 }
    });
  };

  const handleDoubleClick = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      const rect = containerRef.current.getBoundingClientRect();
      setAddPanelPosition({ x: e.clientX - rect.left + 20, y: e.clientY - rect.top });
      setShowAddPanel(true);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(mouseX, mouseY);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
    }

    if (draggingNode) {
      updateNode(draggingNode.id, {
        position: {
          x: canvasPos.x - dragOffset.x,
          y: canvasPos.y - dragOffset.y
        }
      });
    }

    // Línea temporal desde el PUNTO DE SALIDA (usa altura real del nodo)
    if (connectingFrom) {
      const parentHeight = getNodeHeight(connectingFrom.id);
      const outputX = connectingFrom.position.x + NODE_WIDTH / 2;
      const outputY = connectingFrom.position.y + parentHeight + 5; // 5px desde el borde inferior real
      setTempLine({
        x1: outputX,
        y1: outputY,
        x2: canvasPos.x,
        y2: canvasPos.y
      });
    }
  };

  const handleMouseUp = (e) => {
    setIsPanning(false);
    setDraggingNode(null);
    
    if (connectingFrom && !draggingNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      
      const targetNode = nodes.find(n => {
        if (n.id === connectingFrom.id) return false;
        const nx = n.position.x;
        const ny = n.position.y;
        const nHeight = getNodeHeight(n.id);
        return canvasPos.x >= nx && canvasPos.x <= nx + NODE_WIDTH &&
               canvasPos.y >= ny && canvasPos.y <= ny + nHeight;
      });

      if (targetNode) {
        try {
          moveNode(targetNode.id, connectingFrom.id);
        } catch (err) {}
      }
    }
    
    setConnectingFrom(null);
    setTempLine(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setTempLine(null);
        setDraggingNode(null);
        setShowAddPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Agregar wheel listener de forma no pasiva para poder usar preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const wheelHandler = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      
      setZoom(prevZoom => {
        const newZoom = Math.max(0.3, Math.min(3, prevZoom * delta));
        const zoomRatio = newZoom / prevZoom;
        
        setPan(prevPan => ({
          x: mouseX - (mouseX - prevPan.x) * zoomRatio,
          y: mouseY - (mouseY - prevPan.y) * zoomRatio
        }));
        
        return newZoom;
      });
    };
    
    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler, { passive: false });
  }, []);

  const handleNodeDragStart = (e, node) => {
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = screenToCanvas(clientX - rect.left, clientY - rect.top);
    
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y
    });
    setDraggingNode(node);
  };

  // Touch handlers específicos para nodos
  const handleNodeTouchStart = (e, node) => {
    e.stopPropagation();
    handleNodeDragStart(e, node);
  };

  const handleNodeTouchMove = (e) => {
    if (!draggingNode) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);
    
    updateNode(draggingNode.id, {
      position: {
        x: canvasPos.x - dragOffset.x,
        y: canvasPos.y - dragOffset.y
      }
    });
  };

  const handleConnectionStart = (e, node) => {
    e.stopPropagation();
    setConnectingFrom(node);
  };

  // Función para registrar la altura de un nodo
  const registerNodeRef = (id, el) => {
    if (el) {
      nodeRefs.current[id] = el;
      // Medir la altura real del elemento
      const height = el.getBoundingClientRect().height / zoom; // Ajustar por zoom
      nodeHeights.current[id] = height;
    }
  };

  // Obtener la altura real de un nodo (con fallback a 160)
  const getNodeHeight = (nodeId) => {
    return nodeHeights.current[nodeId] || 160;
  };

  // Re-medir alturas cuando cambia el zoom o los nodos
  useEffect(() => {
    Object.entries(nodeRefs.current).forEach(([id, el]) => {
      if (el) {
        const height = el.getBoundingClientRect().height / zoom;
        nodeHeights.current[id] = height;
      }
    });
  }, [zoom, nodes]);

  // Generar path según estilo de línea
  const generatePath = (startX, startY, endX, endY) => {
    if (lineStyle === 'curved') {
      // Curva Bezier suave
      const deltaY = endY - startY;
      const controlY1 = startY + deltaY * 0.5;
      const controlY2 = endY - deltaY * 0.5;
      return `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;
    } else {
      // Líneas ortogonales (90°)
      const midY = (startY + endY) / 2;
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    }
  };

  // Renderizar conexiones - DESDE PUNTOS EXACTOS EN LOS BORDES (usa alturas reales)
  const renderConnections = () => {
    return nodes
      .filter(n => n.parentId)
      .map(n => {
        const parent = nodes.find(p => p.id === n.parentId);
        if (!parent) return null;

        // Usar alturas reales medidas del DOM
        const parentHeight = getNodeHeight(parent.id);
        const childHeight = getNodeHeight(n.id);

        // PUNTO DE SALIDA (output) - centro del borde inferior del padre
        const startX = parent.position.x + NODE_WIDTH / 2;
        const startY = parent.position.y + parentHeight + 5; // +5px desde borde inferior real
        
        // PUNTO DE ENTRADA (input) - centro del borde superior del hijo  
        const endX = n.position.x + NODE_WIDTH / 2;
        const endY = n.position.y - 5; // -5px desde borde superior
        
        const path = generatePath(startX, startY, endX, endY);
        const typeConfig = NODE_TYPES[parent.type?.toUpperCase()];

        return (
          <g key={`${parent.id}-${n.id}`}>
            {/* Línea animada */}
            <path
              d={path}
              fill="none"
              stroke={typeConfig?.color || '#64748b'}
              strokeWidth="2"
              strokeDasharray={lineStyle === 'curved' ? "8,4" : "none"}
              opacity="0.7"
            >
              {lineStyle === 'curved' && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="24"
                  to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* Línea de fondo */}
            <path
              d={path}
              fill="none"
              stroke={typeConfig?.color || '#64748b'}
              strokeWidth="4"
              opacity="0.1"
              className="hover:opacity-30 transition-opacity cursor-pointer"
              onClick={() => moveNode(n.id, null)}
            />
          </g>
        );
      });
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[calc(100vh-140px)] overflow-hidden rounded-xl border select-none touch-none transition-colors duration-300 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Grid Background - Grid procedural infinito tipo Figma/Miro/Unity */}
      {showGrid && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            // Grid de puntos que cambian según el tema
            backgroundImage: isDark 
              ? `radial-gradient(circle, rgba(71, 85, 105, 0.6) 1px, transparent 1px)`
              : `radial-gradient(circle, rgba(148, 163, 184, 0.4) 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            // La posición se mueve con el pan (modulo para que sea infinito)
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            zIndex: 0
          }}
        />
      )}

      {/* Canvas Layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* SVG para conexiones */}
        <svg className="absolute inset-0 w-[3000px] h-[3000px] pointer-events-auto overflow-visible">
          {renderConnections()}
          
          {/* Línea temporal */}
          {tempLine && (
            <path
              d={`M ${tempLine.x1} ${tempLine.y1} L ${tempLine.x2} ${tempLine.y2}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.8"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="10"
                to="0"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </path>
          )}
        </svg>

        {/* Nodos */}
        <AnimatePresence>
          {nodes.map(node => (
            <motion.div
              key={node.id}
              ref={(el) => registerNodeRef(node.id, el)}
              className="absolute"
              style={{
                left: node.position.x,
                top: node.position.y,
                zIndex: draggingNode?.id === node.id ? 100 : 10
              }}
              onMouseDown={(e) => handleNodeDragStart(e, node)}
            >
              <NexusNode
                node={node}
                isSelected={selectedNodeId === node.id}
                isConnectingFrom={connectingFrom?.id === node.id}
                onConnectionStart={handleConnectionStart}
                onDelete={() => deleteNode(node.id)}
                onTouchStart={(e) => handleNodeTouchStart(e, node)}
                onTouchMove={handleNodeTouchMove}
                onTouchEnd={handleTouchEnd}
                isDark={isDark}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* UI Overlay */}
      <NexusHeader stats={stats} lineStyle={lineStyle} isDark={isDark} />
      <Toolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        lineStyle={lineStyle}
        setLineStyle={setLineStyle}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isDark={isDark}
      />

      {/* Mini-map */}
      <NexusMinimap
        nodes={nodes}
        viewport={{
          x: -pan.x / zoom,
          y: -pan.y / zoom,
          width: (containerRef.current?.clientWidth || 1000) / zoom,
          height: (containerRef.current?.clientHeight || 800) / zoom
        }}
        onNavigate={(pos) => {
          setPan({ 
            x: -pos.x * zoom + containerRef.current.clientWidth / 2, 
            y: -pos.y * zoom + containerRef.current.clientHeight / 2 
          });
        }}
        isDark={isDark}
      />

      {/* Add Node Panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddNodePanel
            onAdd={handleAddNode}
            onClose={() => setShowAddPanel(false)}
            position={addPanelPosition}
            isDark={isDark}
          />
        )}
      </AnimatePresence>

      {/* Help text - solo visible al conectar */}
      {connectingFrom && (
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-40 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-center transition-colors duration-300 ${isDark ? 'bg-slate-900/80 text-slate-400' : 'bg-white/80 text-slate-500'}`}>
          Suelta sobre otro nodo • ESC para cancelar
        </div>
      )}

      {/* Cancel connection */}
      {connectingFrom && (
        <button
          onClick={() => {
            setConnectingFrom(null);
            setTempLine(null);
          }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white rounded-full shadow-xl text-sm font-medium"
        >
          Cancelar conexión
        </button>
      )}
    </div>
  );
};

export default NexusManager;
