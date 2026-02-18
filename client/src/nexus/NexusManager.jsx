import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Building2, Package, Users, Wallet, Shield,
  X, Check, AlertCircle, Move, Link2, Trash2,
  MousePointer2, Unlink
} from 'lucide-react';
import { useNexus } from './useNexus';
import { NexusNode } from './NexusNode';
import { NexusGraph, NexusMinimap } from './NexusGraph';
import { NODE_TYPES, NODE_STATUS, VISUAL_CONFIG } from './nexus.types';

// Panel de control para agregar nodos
const AddNodePanel = ({ onAdd, onClose, parentNode }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const availableTypes = parentNode 
    ? NODE_TYPES[parentNode.type?.toUpperCase()]?.allowedChildren || []
    : ['empresa'];

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
      onAdd(selectedType, name);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const typeIcons = {
    empresa: Building2,
    administrador: Shield,
    inventario: Package,
    vendedor: Users,
    caja: Wallet
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="fixed left-4 bottom-4 z-50 w-80 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">
          {parentNode ? `Agregar a ${parentNode.name}` : 'Nueva Empresa'}
        </h3>
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
        <div className="grid grid-cols-3 gap-2">
          {availableTypes.map(type => {
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

// Barra de herramientas con modos
const Toolbar = ({ 
  mode, setMode,
  onZoomIn, onZoomOut, onFitView, 
  showGrid, setShowGrid,
  selectedConnection, onDeleteConnection
}) => (
  <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
    {/* Mode Switcher */}
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-xl">
      <button
        onClick={() => setMode('select')}
        className={`p-2 rounded-md transition-colors ${
          mode === 'select' 
            ? 'bg-blue-600 text-white' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Modo Selección"
      >
        <MousePointer2 size={18} />
      </button>
      <button
        onClick={() => setMode('move')}
        className={`p-2 rounded-md transition-colors ${
          mode === 'move' 
            ? 'bg-blue-600 text-white' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Modo Mover Nodos"
      >
        <Move size={18} />
      </button>
      <button
        onClick={() => setMode('connect')}
        className={`p-2 rounded-md transition-colors ${
          mode === 'connect' 
            ? 'bg-blue-600 text-white' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Modo Conectar"
      >
        <Link2 size={18} />
      </button>
      {selectedConnection && (
        <button
          onClick={onDeleteConnection}
          className="p-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
          title="Eliminar Conexión"
        >
          <Unlink size={18} />
        </button>
      )}
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
const NexusHeader = ({ stats, mode }) => {
  const modeLabels = {
    select: 'Modo: Selección',
    move: 'Modo: Mover',
    connect: 'Modo: Conectar'
  };

  return (
    <div className="absolute top-4 left-4 z-40 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700 p-4 shadow-xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-lg border border-blue-500/30">
          <Grid3X3 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">NexusNode</h1>
          <p className="text-xs text-slate-400">{modeLabels[mode]}</p>
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
};

export const NexusManager = () => {
  const {
    nodes,
    nodeTree,
    selectedNodeId,
    selectedNode,
    expandedNodes,
    stats,
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    selectNode,
    toggleExpand,
    getChildren
  } = useNexus();

  // Modos: 'select' | 'move' | 'connect'
  const [mode, setMode] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addPanelParent, setAddPanelParent] = useState(null);
  
  // Estado para drag de nodos
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Estado para conexiones
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  const containerRef = useRef(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Calcular conexiones
  const connections = nodes
    .filter(n => n.parentId)
    .map(n => ({ parentId: n.parentId, childId: n.id, id: `${n.parentId}-${n.id}` }));

  // Handlers de zoom
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleAddNode = (type, name) => {
    createNode(type, addPanelParent?.id || null, { 
      name,
      position: addPanelParent 
        ? { 
            x: addPanelParent.position.x + (getChildren(addPanelParent.id).length * 300),
            y: addPanelParent.position.y + 200
          }
        : { x: 400, y: 50 }
    });
  };

  // Convertir coordenadas del mouse a coordenadas del canvas
  const screenToCanvas = (screenX, screenY) => ({
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  });

  // Handlers de mouse para pan y drag
  const handleMouseDown = (e) => {
    // Solo pan si clic en el fondo
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX - (rect?.left || 0), e.clientY - (rect?.top || 0));
    setMousePos(canvasPos);

    if (isPanning.current) {
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
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    setDraggingNode(null);
  };

  // Handlers de nodos
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    
    if (mode === 'move') {
      const rect = containerRef.current?.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX - (rect?.left || 0), e.clientY - (rect?.top || 0));
      setDragOffset({
        x: canvasPos.x - node.position.x,
        y: canvasPos.y - node.position.y
      });
      setDraggingNode(node);
    } else if (mode === 'connect') {
      if (!connectingFrom) {
        setConnectingFrom(node);
      } else {
        // Intentar conectar
        if (connectingFrom.id !== node.id) {
          try {
            moveNode(node.id, connectingFrom.id);
          } catch (err) {
            alert(err.message);
          }
        }
        setConnectingFrom(null);
      }
    } else {
      selectNode(node.id);
    }
  };

  const handleConnectionClick = (conn) => {
    setSelectedConnection(selectedConnection?.id === conn.id ? null : conn);
  };

  const handleDeleteConnection = () => {
    if (selectedConnection) {
      const childNode = nodes.find(n => n.id === selectedConnection.childId);
      if (childNode) {
        // Desconectar (mover a raíz)
        moveNode(childNode.id, null);
      }
      setSelectedConnection(null);
    }
  };

  // Renderizar línea temporal de conexión
  const renderTempConnection = () => {
    if (!connectingFrom) return null;
    
    const startX = connectingFrom.position.x + VISUAL_CONFIG.nodeWidth / 2;
    const startY = connectingFrom.position.y + VISUAL_CONFIG.nodeHeight / 2;
    const endX = mousePos.x;
    const endY = mousePos.y;
    
    const midY = (startY + endY) / 2;
    const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
    
    return (
      <path
        d={path}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        opacity="0.8"
      />
    );
  };

  // Renderizar nodos
  const renderNodes = () => {
    return nodes.map(node => (
      <motion.div
        key={node.id}
        className="absolute"
        style={{
          left: node.position.x,
          top: node.position.y,
          zIndex: draggingNode?.id === node.id ? 100 : 10,
          cursor: mode === 'move' ? 'grab' : mode === 'connect' ? 'crosshair' : 'pointer'
        }}
        onMouseDown={(e) => handleNodeMouseDown(e, node)}
        layoutId={node.id}
      >
        <NexusNode
          node={node}
          isSelected={selectedNodeId === node.id}
          isExpanded={expandedNodes.has(node.id)}
          isConnecting={connectingFrom?.id === node.id}
          onSelect={selectNode}
          onExpand={toggleExpand}
          onEdit={(n) => console.log('Edit:', n)}
          onDelete={deleteNode}
        />
      </motion.div>
    ));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[calc(100vh-140px)] bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing rounded-xl border border-slate-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background */}
      {showGrid && (
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(148,163,184,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        />
      )}

      {/* Graph Layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {/* Connections */}
          {connections.map(conn => {
            const parent = nodes.find(n => n.id === conn.parentId);
            const child = nodes.find(n => n.id === conn.childId);
            if (!parent || !child) return null;
            
            const startX = parent.position.x + VISUAL_CONFIG.nodeWidth / 2;
            const startY = parent.position.y + VISUAL_CONFIG.nodeHeight;
            const endX = child.position.x + VISUAL_CONFIG.nodeWidth / 2;
            const endY = child.position.y;
            const midY = (startY + endY) / 2;
            const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
            
            const isSelected = selectedConnection?.id === conn.id;
            
            return (
              <g key={conn.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={isSelected ? '#3b82f6' : 'rgba(148, 163, 184, 0.3)'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleConnectionClick(conn)}
                />
                {isSelected && (
                  <circle cx={endX} cy={endY} r="4" fill="#ef4444" className="pointer-events-auto cursor-pointer" />
                )}
              </g>
            );
          })}
          
          {/* Temp connection while dragging */}
          {renderTempConnection()}
        </svg>
        
        {/* Nodes */}
        <AnimatePresence>
          {renderNodes()}
        </AnimatePresence>
      </div>

      {/* UI Overlay */}
      <NexusHeader stats={stats} mode={mode} />
      
      <Toolbar
        mode={mode}
        setMode={setMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        selectedConnection={selectedConnection}
        onDeleteConnection={handleDeleteConnection}
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
          setPan({ x: -pos.x * zoom + containerRef.current.clientWidth / 2, y: -pos.y * zoom + containerRef.current.clientHeight / 2 });
        }}
      />

      {/* Mode Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-sm rounded-full px-4 py-2 border border-slate-700 shadow-xl">
        <p className="text-xs text-slate-400">
          {mode === 'select' && 'Modo Selección: Click para seleccionar nodos'}
          {mode === 'move' && 'Modo Mover: Arrastra nodos para reubicarlos'}
          {mode === 'connect' && (connectingFrom ? 'Modo Conectar: Click en nodo destino' : 'Modo Conectar: Click en nodo origen')}
        </p>
      </div>

      {/* Add Node Button */}
      <button
        onClick={() => {
          setAddPanelParent(selectedNode);
          setShowAddPanel(true);
        }}
        className="absolute right-4 bottom-16 z-50 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110"
      >
        <Plus size={24} />
      </button>

      {/* Add Node Panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddNodePanel
            onAdd={handleAddNode}
            onClose={() => setShowAddPanel(false)}
            parentNode={addPanelParent}
          />
        )}
      </AnimatePresence>

      {/* Selected Node Info */}
      <AnimatePresence>
        {selectedNode && mode === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-20 z-40 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 p-4 shadow-xl max-w-xs"
          >
            <h4 className="font-semibold text-white mb-1">{selectedNode.name}</h4>
            <p className="text-xs text-slate-400 mb-3">{selectedNode.description}</p>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode('connect');
                  setConnectingFrom(selectedNode);
                }}
                className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Link2 size={14} />
                Conectar
              </button>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NexusManager;
