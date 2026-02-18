import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Crown, Building2, Shield, Package, Users, Store,
  X, Check, AlertCircle, Trash2, GitBranch, Minus
} from 'lucide-react';
import { useNexus } from './useNexus';
import { NexusNode } from './NexusNode';
import { NexusMinimap } from './NexusGraph';
import { NODE_TYPES, NODE_STATUS, VISUAL_CONFIG } from './nexus.types';

// Panel de control para agregar nodos
const AddNodePanel = ({ onAdd, onClose, position }) => {
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
      className="fixed z-50 w-80 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl p-4"
      style={{ left: position?.x || 20, top: position?.y || 20 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Nuevo Nodo</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo de nodo</label>
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
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <Icon 
                  size={20} 
                  style={{ color: config?.color }}
                  className="mx-auto mb-1"
                />
                <span className="text-[10px] text-slate-300 block text-center">
                  {config?.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Almacén Norte"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
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
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
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
  lineStyle, setLineStyle
}) => (
  <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
    {/* Line Style Toggle */}
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-xl">
      <button
        onClick={() => setLineStyle(lineStyle === 'curved' ? 'orthogonal' : 'curved')}
        className={`p-2 rounded-md transition-colors ${lineStyle === 'curved' ? 'text-blue-400 bg-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        title={lineStyle === 'curved' ? 'Líneas curvas' : 'Líneas rectas (90°)'}
      >
        {lineStyle === 'curved' ? <GitBranch size={18} /> : <Minus size={18} />}
      </button>
    </div>

    {/* Zoom Controls */}
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-xl">
      <button
        onClick={onZoomIn}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Acercar"
      >
        <ZoomIn size={18} />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Alejar"
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={onFitView}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Ajustar vista"
      >
        <Maximize2 size={18} />
      </button>
      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-2 rounded-md transition-colors ${showGrid ? 'text-blue-400 bg-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        title="Mostrar grid"
      >
        <Grid3X3 size={18} />
      </button>
    </div>
  </div>
);

// Header con estadísticas
const NexusHeader = ({ stats, lineStyle }) => (
  <div className="absolute top-4 left-4 z-40 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700 p-4 shadow-xl">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-lg border border-blue-500/30">
        <Grid3X3 className="w-5 h-5 text-blue-400" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white">NexusNode</h1>
        <p className="text-xs text-slate-400">
          {lineStyle === 'curved' ? 'Líneas curvas' : 'Líneas rectas (90°)'} • Scroll = Zoom
        </p>
      </div>
    </div>
    
    <div className="flex gap-4 text-xs">
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Nodos</p>
        <p className="text-lg font-bold text-white">{stats.total}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Online</p>
        <p className="text-lg font-bold text-emerald-400">{stats.online}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Offline</p>
        <p className="text-lg font-bold text-red-400">{stats.offline}</p>
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
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addPanelPosition, setAddPanelPosition] = useState({ x: 20, y: 20 });
  const [lineStyle, setLineStyle] = useState('curved'); // 'curved' | 'orthogonal'
  
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
  const NODE_HEIGHT = 160;
  const OUTPUT_OFFSET = 158; // Posición Y del punto de salida (desde top)
  const INPUT_OFFSET = 2;    // Posición Y del punto de entrada (desde top)

  // Convertir coordenadas
  const screenToCanvas = (screenX, screenY) => ({
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  });

  // Handlers de zoom
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  // ZOOM CON SCROLL
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(3, zoom * delta));
    const zoomRatio = newZoom / zoom;
    
    setPan({
      x: mouseX - (mouseX - pan.x) * zoomRatio,
      y: mouseY - (mouseY - pan.y) * zoomRatio
    });
    setZoom(newZoom);
  };

  // PINCH TO ZOOM
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
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
    }
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

    // Línea temporal desde el PUNTO DE SALIDA
    if (connectingFrom) {
      const outputX = connectingFrom.position.x + NODE_WIDTH / 2;
      const outputY = connectingFrom.position.y + OUTPUT_OFFSET;
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
        return canvasPos.x >= nx && canvasPos.x <= nx + NODE_WIDTH &&
               canvasPos.y >= ny && canvasPos.y <= ny + NODE_HEIGHT;
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

  const handleNodeDragStart = (e, node) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
    
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y
    });
    setDraggingNode(node);
  };

  const handleConnectionStart = (e, node) => {
    e.stopPropagation();
    setConnectingFrom(node);
  };

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

  // Renderizar conexiones - DESDE PUNTOS EXACTOS
  const renderConnections = () => {
    return nodes
      .filter(n => n.parentId)
      .map(n => {
        const parent = nodes.find(p => p.id === n.parentId);
        if (!parent) return null;

        // PUNTO DE SALIDA (output) - bottom center del padre
        const startX = parent.position.x + NODE_WIDTH / 2;
        const startY = parent.position.y + OUTPUT_OFFSET;
        
        // PUNTO DE ENTRADA (input) - top center del hijo
        const endX = n.position.x + NODE_WIDTH / 2;
        const endY = n.position.y + INPUT_OFFSET;
        
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
      className="relative w-full h-[calc(100vh-140px)] bg-slate-950 overflow-hidden rounded-xl border border-slate-800 select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Grid Background */}
      {showGrid && (
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.3) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
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
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* UI Overlay */}
      <NexusHeader stats={stats} lineStyle={lineStyle} />
      <Toolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        lineStyle={lineStyle}
        setLineStyle={setLineStyle}
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
      />

      {/* Add Node Panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddNodePanel
            onAdd={handleAddNode}
            onClose={() => setShowAddPanel(false)}
            position={addPanelPosition}
          />
        )}
      </AnimatePresence>

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/80 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-slate-400 text-center">
        {connectingFrom ? 'Suelta sobre otro nodo • ESC para cancelar' : 'Scroll=Zoom • Click icono arriba para líneas rectas/curvas'}
      </div>

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
